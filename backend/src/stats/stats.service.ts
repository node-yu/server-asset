import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AwsCostService } from '../aws-cost/aws-cost.service';
import { DomainService } from '../domain/domain.service';
import { Prisma } from '@prisma/client';

/**
 * 费用统计逻辑（按实际使用天数比例计费）：
 * - 当月有效服务器 = createdAt <= 当月底 且 (cancelAt 为空 或 cancelAt >= 当月初)
 * - 仅排除 status=「未使用」的服务器（从未使用的不计费）
 * - 「已过期」「已取消」的服务器在有效期内仍计入费用，避免漏统
 * - 支持项目转移：服务器若在某月内从 A 组转到 B 组，费用按天数拆分到 A、B
 * - 比例费用 = 月费 × (当月实际使用天数 / 当月总天数)
 */
@Injectable()
export class StatsService {
  constructor(
    private prisma: PrismaService,
    private awsCostService: AwsCostService,
    private domainService: DomainService,
  ) {}

  /**
   * 获取服务器在某月的项目归属时间段（考虑转移记录）
   * 返回 [{ project, start, end }]，每个段按天数比例计费
   */
  private getProjectSegmentsForMonth(
    serverProject: string,
    transfers: { fromProject: string; toProject: string; transferDate: Date }[],
    createdAt: Date,
    cancelAt: Date | null,
    year: number,
    month: number,
  ): { project: string; start: Date; end: Date; days: number }[] {
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    const daysInMonth = new Date(year, month, 0).getDate();

    const effStart = createdAt > startOfMonth ? createdAt : startOfMonth;
    const effEnd = cancelAt && cancelAt < endOfMonth ? cancelAt : endOfMonth;
    if (effStart > effEnd) return [];

    const projectAt = (date: Date): string => {
      const sorted = [...transfers].sort((a, b) => a.transferDate.getTime() - b.transferDate.getTime());
      if (sorted.length === 0) return serverProject;
      const before = sorted.filter((t) => t.transferDate <= date);
      if (before.length === 0) return sorted[0].fromProject;
      return before[before.length - 1].toProject;
    };

    const boundaries: Date[] = [effStart];
    for (const t of transfers) {
      if (t.transferDate > effStart && t.transferDate <= effEnd) {
        boundaries.push(t.transferDate);
      }
    }
    boundaries.push(effEnd);
    boundaries.sort((a, b) => a.getTime() - b.getTime());

    const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const segments: { project: string; start: Date; end: Date; days: number }[] = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      const segStart = boundaries[i];
      const segEnd = boundaries[i + 1];
      const proj = projectAt(segStart);
      const s = toDateOnly(segStart);
      const e = toDateOnly(segEnd);
      const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
      segments.push({ project: proj, start: segStart, end: segEnd, days });
    }
    return segments;
  }

  /**
   * 按当月实际使用天数比例计算费用
   * - 有效开始 = max(创建时间, 当月1日)
   * - 有效结束 = min(取消时间, 当月最后一天)，无取消则到月底
   * - 费用 = 月费 × (有效天数 / 当月总天数)，有效天数含首尾两天
   */
  private calcProportionalCost(
    monthlyCost: number,
    createdAt: Date,
    cancelAt: Date | null,
    year: number,
    month: number,
  ): number {
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    const daysInMonth = new Date(year, month, 0).getDate();

    const effectiveStart = createdAt > startOfMonth ? createdAt : startOfMonth;
    const effectiveEnd = cancelAt && cancelAt < endOfMonth ? cancelAt : endOfMonth;

    if (effectiveStart > effectiveEnd) return 0;

    const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const startDate = toDateOnly(effectiveStart);
    const endDate = toDateOnly(effectiveEnd);
    const diffMs = endDate.getTime() - startDate.getTime();
    const activeDays = Math.max(1, Math.min(daysInMonth, Math.round(diffMs / 86400000) + 1));

    return monthlyCost * (activeDays / daysInMonth);
  }

  /** 解析项目：共用格式 "A&B" 拆成 [A,B]，单独项目为 [A] */
  private parseProjectNames(project: string): string[] {
    const s = (project || '').trim();
    if (!s) return [];
    if (s.includes('&')) {
      return s.split('&').map((p) => p.trim()).filter(Boolean);
    }
    return [s];
  }

  /** 是否共用项目（含 &） */
  private isSharedProject(project: string): boolean {
    return (project || '').trim().includes('&');
  }

  async getMonthlyStats(year: number, month: number) {
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const where: Prisma.ServerWhereInput = {
      createdAt: { lte: endOfMonth },
      OR: [{ cancelAt: null }, { cancelAt: { gte: startOfMonth } }],
      status: { notIn: ['未使用'] },
    };

    const servers = await this.prisma.server.findMany({
      where,
      select: {
        id: true,
        project: true,
        platform: true,
        monthlyCost: true,
        createdAt: true,
        cancelAt: true,
        projectTransfers: { select: { fromProject: true, toProject: true, transferDate: true } },
      },
    });

    const projects = await this.prisma.project.findMany({
      include: { group: { select: { id: true, name: true } } },
    });
    const projectByNameLower = new Map(projects.map((p) => [p.name.toLowerCase(), p]));

    const projectAliases: Record<string, string> = { Speed: 'SPEEDTOP', speed: 'SPEEDTOP' };

    const resolveGroupAndCanonical = (projectName: string): { group: { id: number; name: string } | null; canonicalName: string } => {
      const normalized = projectAliases[projectName] ?? projectName;
      const pExact = projects.find((p) => p.name === normalized || p.name === projectName);
      if (pExact) return { group: pExact.group, canonicalName: pExact.name };
      const pLower = projectByNameLower.get(normalized.toLowerCase()) ?? projectByNameLower.get(projectName.toLowerCase());
      if (pLower) return { group: pLower.group, canonicalName: pLower.name };
      return { group: null, canonicalName: projectName };
    };

    const totalByProject: Record<string, number> = {};
    const totalByPlatform: Record<string, number> = {};
    const totalByGroup: Record<string, number> = {};
    const byGroupAndProject: Record<string, Record<string, number>> = {};
    let total = 0;
    let totalSingle = 0;
    let totalShared = 0;

    const daysInMonth = new Date(year, month, 0).getDate();

    for (const s of servers) {
      const totalCost = this.calcProportionalCost(
        s.monthlyCost,
        s.createdAt,
        s.cancelAt,
        year,
        month,
      );
      total += totalCost;
      totalByPlatform[s.platform] = (totalByPlatform[s.platform] || 0) + totalCost;

      const segments = this.getProjectSegmentsForMonth(
        s.project,
        s.projectTransfers,
        s.createdAt,
        s.cancelAt,
        year,
        month,
      );

      if (segments.length === 0) {
        const names = this.parseProjectNames(s.project);
        const isShared = this.isSharedProject(s.project);
        if (isShared) {
          totalShared += totalCost;
          const sharePerProject = names.length > 0 ? totalCost / names.length : totalCost;
          for (const n of names) {
            const { group, canonicalName } = resolveGroupAndCanonical(n);
            totalByProject[canonicalName] = (totalByProject[canonicalName] || 0) + sharePerProject;
            const groupName = group?.name ?? '未分组';
            totalByGroup[groupName] = (totalByGroup[groupName] || 0) + sharePerProject;
            if (!byGroupAndProject[groupName]) byGroupAndProject[groupName] = {};
            byGroupAndProject[groupName][canonicalName] = (byGroupAndProject[groupName][canonicalName] || 0) + sharePerProject;
          }
        } else {
          totalSingle += totalCost;
          const n = names[0] || s.project;
          const { group, canonicalName } = resolveGroupAndCanonical(n);
          totalByProject[canonicalName] = (totalByProject[canonicalName] || 0) + totalCost;
          const groupName = group?.name ?? '未分组';
          totalByGroup[groupName] = (totalByGroup[groupName] || 0) + totalCost;
          if (!byGroupAndProject[groupName]) byGroupAndProject[groupName] = {};
          byGroupAndProject[groupName][canonicalName] = (byGroupAndProject[groupName][canonicalName] || 0) + totalCost;
        }
        continue;
      }

      for (const seg of segments) {
        const segCost = s.monthlyCost * (seg.days / daysInMonth);
        const names = this.parseProjectNames(seg.project);
        const isShared = this.isSharedProject(seg.project);
        if (isShared) {
          totalShared += segCost;
          const sharePerProject = names.length > 0 ? segCost / names.length : segCost;
          for (const n of names) {
            const { group, canonicalName } = resolveGroupAndCanonical(n);
            totalByProject[canonicalName] = (totalByProject[canonicalName] || 0) + sharePerProject;
            const groupName = group?.name ?? '未分组';
            totalByGroup[groupName] = (totalByGroup[groupName] || 0) + sharePerProject;
            if (!byGroupAndProject[groupName]) byGroupAndProject[groupName] = {};
            byGroupAndProject[groupName][canonicalName] = (byGroupAndProject[groupName][canonicalName] || 0) + sharePerProject;
          }
        } else {
          totalSingle += segCost;
          const n = names[0] || seg.project;
          const { group, canonicalName } = resolveGroupAndCanonical(n);
          totalByProject[canonicalName] = (totalByProject[canonicalName] || 0) + segCost;
          const groupName = group?.name ?? '未分组';
          totalByGroup[groupName] = (totalByGroup[groupName] || 0) + segCost;
          if (!byGroupAndProject[groupName]) byGroupAndProject[groupName] = {};
          byGroupAndProject[groupName][canonicalName] = (byGroupAndProject[groupName][canonicalName] || 0) + segCost;
        }
      }
    }

    const { idcTotal, idcRegionCosts, platformOptions, regionOptionsByPlatform } =
      await this.getIdcRegionCostsForMonth(year, month);
    const awsCosts = await this.awsCostService.getAwsCostsForMonth(year, month);
    const awsTotal = await this.awsCostService.getAwsTotalForMonth(year, month);
    const domainTotal = await this.domainService.getDomainMonthlyCost();
    const totalWithIdc = total + idcTotal + awsTotal + domainTotal;

    for (const ac of awsCosts) {
      if (ac.amount > 0 && ac.project) {
        const proj = this.getCostBreakdownProject(ac.project);
        totalByProject[proj] = (totalByProject[proj] || 0) + ac.amount;
        totalByPlatform['AWS'] = (totalByPlatform['AWS'] || 0) + ac.amount;
        const p = projects.find((x) => x.name === proj) ?? projectByNameLower.get(proj.toLowerCase());
        const groupName = p?.group?.name ?? '未分组';
        totalByGroup[groupName] = (totalByGroup[groupName] || 0) + ac.amount;
        if (!byGroupAndProject[groupName]) byGroupAndProject[groupName] = {};
        byGroupAndProject[groupName][proj] = (byGroupAndProject[groupName][proj] || 0) + ac.amount;
      }
    }

    for (const rc of idcRegionCosts) {
      if (rc.cost > 0 && rc.project) {
        const proj = this.getCostBreakdownProject(rc.project);
        totalByProject[proj] = (totalByProject[proj] || 0) + rc.cost;
        const plat = rc.platform || 'IDC';
        totalByPlatform[plat] = (totalByPlatform[plat] || 0) + rc.cost;
        const p = projects.find((x) => x.name === proj) ?? projectByNameLower.get(proj.toLowerCase());
        const groupName = p?.group?.name ?? '未分组';
        totalByGroup[groupName] = (totalByGroup[groupName] || 0) + rc.cost;
        if (!byGroupAndProject[groupName]) byGroupAndProject[groupName] = {};
        byGroupAndProject[groupName][proj] = (byGroupAndProject[groupName][proj] || 0) + rc.cost;
      }
    }

    if (domainTotal > 0) {
      totalByPlatform['域名'] = (totalByPlatform['域名'] || 0) + domainTotal;
    }

    return {
      year,
      month,
      total: totalWithIdc,
      serverTotal: total,
      idcTotal,
      awsTotal,
      domainTotal,
      idcRegionCosts,
      platformOptions,
      regionOptionsByPlatform,
      totalSingle,
      totalShared,
      totalByProject: Object.entries(totalByProject).map(([name, amount]) => ({ name, amount })),
      totalByPlatform: Object.entries(totalByPlatform).map(([name, amount]) => ({ name, amount })),
      totalByGroup: Object.entries(totalByGroup).map(([name, amount]) => ({ name, amount })),
      byGroupAndProject: Object.entries(byGroupAndProject).map(([groupName, projs]) => ({
        groupName,
        total: Object.values(projs).reduce((a, b) => a + b, 0),
        projects: Object.entries(projs).map(([name, amount]) => ({ name, amount })),
      })),
    };
  }

  /** 获取某月 IDC 费用（供应商+地区+项目+费用，用户手动填写） */
  async getIdcRegionCostsForMonth(year: number, month: number): Promise<{
    idcTotal: number;
    idcRegionCosts: { platform: string; region: string; project: string; cost: number }[];
    platformOptions: string[];
    regionOptionsByPlatform: Record<string, string[]>;
  }> {
    const platforms = await this.prisma.platform.findMany({
      where: { isIdcSupplier: true },
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    const idcRegs = await this.prisma.iDCRegistration.findMany({
      select: { region: true, platformAccount: { select: { platform: { select: { name: true } } } } },
    });
    const saved = await this.prisma.idcRegionCost.findMany({
      where: { year, month },
      orderBy: [{ platform: 'asc' }, { region: 'asc' }],
    });

    const idcRegionCosts = saved.map((s) => ({
      platform: s.platform,
      region: s.region,
      project: s.project,
      cost: Math.round(s.cost * 100) / 100,
    }));

    const idcTotal = idcRegionCosts.reduce((sum, c) => sum + c.cost, 0);
    const regionOptionsByPlatform: Record<string, string[]> = {};
    for (const r of idcRegs) {
      const plat = r.platformAccount?.platform?.name ?? '';
      if (plat) {
        if (!regionOptionsByPlatform[plat]) regionOptionsByPlatform[plat] = [];
        if (!regionOptionsByPlatform[plat].includes(r.region)) {
          regionOptionsByPlatform[plat].push(r.region);
        }
      }
    }
    for (const plat of Object.keys(regionOptionsByPlatform)) {
      regionOptionsByPlatform[plat].sort();
    }
    return {
      idcTotal,
      idcRegionCosts,
      platformOptions: platforms.map((p) => p.name),
      regionOptionsByPlatform,
    };
  }

  /** 保存 IDC 某月费用（供应商+地区+项目+费用） */
  async saveIdcRegionCost(
    year: number,
    month: number,
    platform: string,
    region: string,
    project: string,
    cost: number,
  ) {
    if (cost <= 0 && !project) {
      await this.prisma.idcRegionCost.deleteMany({
        where: { year, month, platform, region, project },
      });
      return { saved: true };
    }
    await this.prisma.idcRegionCost.upsert({
      where: {
        year_month_platform_region_project: { year, month, platform, region, project },
      },
      create: { year, month, platform, region, project, cost },
      update: { cost },
    });
    return { saved: true };
  }

  /** 删除 IDC 某月某条费用 */
  async deleteIdcRegionCost(
    year: number,
    month: number,
    platform: string,
    region: string,
    project: string,
  ) {
    await this.prisma.idcRegionCost.deleteMany({
      where: { year, month, platform, region, project },
    });
    return { deleted: true };
  }

  /** 费用详情中的项目显示名：中台/资源组->JUMP，Speed->SPEEDTOP */
  private getCostBreakdownProject(project: string): string {
    const p = (project || '').trim();
    if (p === '中台' || p === '资源组') return 'JUMP';
    if (p === 'Speed' || p.toLowerCase() === 'speed') return 'SPEEDTOP';
    return p;
  }

  /** 用途简化：含「节点」的为会员/免费/广告节点，不含「节点」的均为核心 */
  private simplifyUsage(raw: string): { usage: string; isCore: boolean } {
    const u = (raw || '').trim();
    if (u === '会员节点') return { usage: '会员节点', isCore: false };
    if (u === '免费节点') return { usage: '免费节点', isCore: false };
    if (u === '广告节点') return { usage: '广告节点', isCore: false };
    return { usage: '核心', isCore: true };
  }

  /** 费用统计表：按分组筛选（支持多选），用途简化为会员/免费/核心，核心加备注 */
  async getCostBreakdown(year: number, month: number, groupIds?: number | number[]) {
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    const baseWhere: Prisma.ServerWhereInput = {
      createdAt: { lte: endOfMonth },
      OR: [{ cancelAt: null }, { cancelAt: { gte: startOfMonth } }],
      status: { notIn: ['未使用'] },
    };

    let projectFilter: ((p: string) => boolean) | null = null;
    let projectNames = new Set<string>();

    const ids = groupIds == null ? [] : Array.isArray(groupIds) ? groupIds : [groupIds];
    if (ids.length > 0) {
      const selectedGroups = await this.prisma.group.findMany({
        where: { id: { in: ids } },
        include: { projects: { select: { name: true } } },
      });
      for (const g of selectedGroups) {
        for (const p of g.projects) {
          projectNames.add(p.name);
          projectNames.add(this.getCostBreakdownProject(p.name));
        }
      }
      if (projectNames.size === 0) {
        return {
          year,
          month,
          rows: [],
          totalCurrent: 0,
          totalLast: 0,
          totalChange: null,
          hasManualLast: false,
        };
      }
      projectFilter = (p: string) => {
        const names = this.parseProjectNames(p);
        return names.some((n) => projectNames.has(n) || projectNames.has(this.getCostBreakdownProject(n)));
      };
    }

    const allServers = await this.prisma.server.findMany({
      where: baseWhere,
      select: {
        project: true,
        platform: true,
        usage: true,
        monthlyCost: true,
        createdAt: true,
        cancelAt: true,
        projectTransfers: { select: { fromProject: true, toProject: true, transferDate: true } },
      },
    });
    const servers = projectFilter
      ? allServers.filter((s) => {
          const segs = this.getProjectSegmentsForMonth(s.project, s.projectTransfers, s.createdAt, s.cancelAt, year, month);
          if (segs.length === 0) return projectFilter!(s.project);
          return segs.some((seg) => projectFilter!(seg.project));
        })
      : allServers;

    const lastYear = month === 1 ? year - 1 : year;
    const lastMonth = month === 1 ? 12 : month - 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysLastMonth = new Date(lastYear, lastMonth, 0).getDate();

    const groupKey = (proj: string, plat: string, u: string) => `${proj}::${plat}::${u}`;
    const groups: Record<string, { project: string; type: string; platform: string; usage: string; note: string; quantity: number; cost: number; lastCost: number }> = {};

    for (const s of servers) {
      const { usage: simplified, isCore } = this.simplifyUsage(s.usage || '');
      const rawUsage = (s.usage || '').trim() || '未分类';

      const segsCur = this.getProjectSegmentsForMonth(s.project, s.projectTransfers, s.createdAt, s.cancelAt, year, month);
      const segsLast = this.getProjectSegmentsForMonth(s.project, s.projectTransfers, s.createdAt, s.cancelAt, lastYear, lastMonth);

      const addToGroups = (displayProj: string, costCur: number, costLast: number, qty: number) => {
        const key = groupKey(displayProj, s.platform, simplified);
        if (!groups[key]) {
          groups[key] = {
            project: displayProj,
            type: '服务器',
            platform: s.platform,
            usage: simplified,
            note: '',
            quantity: 0,
            cost: 0,
            lastCost: 0,
          };
        }
        groups[key].quantity += qty;
        groups[key].cost += costCur;
        groups[key].lastCost += costLast;
        if (isCore && rawUsage !== '核心') {
          const notes = groups[key].note ? groups[key].note.split('、') : [];
          if (!notes.includes(rawUsage)) notes.push(rawUsage);
          groups[key].note = notes.join('、');
        }
      };

      if (segsCur.length === 0) {
        const costCur = this.calcProportionalCost(s.monthlyCost, s.createdAt, s.cancelAt, year, month);
        const costLast = this.calcProportionalCost(s.monthlyCost, s.createdAt, s.cancelAt, lastYear, lastMonth);
        const names = this.parseProjectNames(s.project);
        const isShared = this.isSharedProject(s.project);
        const shareCount = isShared && names.length > 0 ? names.length : 1;
        const projectsToAdd = isShared && names.length > 0
          ? names.map((n) => this.getCostBreakdownProject(n))
          : [this.getCostBreakdownProject(s.project)];
        if (ids.length > 0 && isShared) {
          addToGroups('共用', costCur, costLast, 1);
        } else {
          for (const displayProj of projectsToAdd) {
            addToGroups(displayProj, costCur / shareCount, costLast / shareCount, 1 / shareCount);
          }
        }
      } else {
        for (const seg of segsCur) {
          const costCur = s.monthlyCost * (seg.days / daysInMonth);
          const matchingLast = segsLast.filter((sl) => sl.project === seg.project);
          const costLast = matchingLast.length > 0
            ? matchingLast.reduce((sum, sl) => sum + s.monthlyCost * (sl.days / daysLastMonth), 0)
            : 0;
          const names = this.parseProjectNames(seg.project);
          const isShared = this.isSharedProject(seg.project);
          const shareCount = isShared && names.length > 0 ? names.length : 1;
          const projectsToAdd = isShared && names.length > 0
            ? names.map((n) => this.getCostBreakdownProject(n))
            : [this.getCostBreakdownProject(seg.project)];
          if (ids.length > 0 && isShared) {
            addToGroups('共用', costCur, costLast, 1);
          } else {
            for (const displayProj of projectsToAdd) {
              addToGroups(displayProj, costCur / shareCount, costLast / shareCount, 1 / shareCount);
            }
          }
        }
      }
    }

    const rows = Object.values(groups).sort((a, b) => {
      if (a.project === '共用' && b.project !== '共用') return 1;
      if (a.project !== '共用' && b.project === '共用') return -1;
      if (a.project === '共用' && b.project === '共用') {
        return a.platform.localeCompare(b.platform) || a.usage.localeCompare(b.usage);
      }
      return a.project.localeCompare(b.project) || a.platform.localeCompare(b.platform) || a.usage.localeCompare(b.usage);
    });

    const result = rows.map((r) => {
      const lastCost = Math.round(r.lastCost * 100) / 100;
      const currentCost = Math.round(r.cost * 100) / 100;
      const change =
        lastCost > 0
          ? ((currentCost - lastCost) / lastCost) * 100
          : null;
      return {
        project: r.project,
        type: r.type,
        platform: r.platform,
        usage: r.usage,
        note: r.note,
        quantity: r.quantity,
        currentCost,
        lastCost,
        change: change != null ? Math.round(change * 100) / 100 : null,
      };
    });

    const { idcRegionCosts: idcCur } = await this.getIdcRegionCostsForMonth(year, month);
    const { idcRegionCosts: idcLast } = await this.getIdcRegionCostsForMonth(lastYear, lastMonth);
    const awsCur = await this.awsCostService.getAwsCostsForMonth(year, month);
    const awsLast = await this.awsCostService.getAwsCostsForMonth(lastYear, lastMonth);
    const awsCurMap = new Map(awsCur.map((c) => [c.project, c.amount]));
    const awsLastMap = new Map(awsLast.map((c) => [c.project, c.amount]));
    const awsProjects = new Set([...awsCurMap.keys(), ...awsLastMap.keys()]);
    for (const proj of awsProjects) {
      const currentCost = awsCurMap.get(proj) ?? 0;
      const lastCost = awsLastMap.get(proj) ?? 0;
      const change = lastCost > 0 ? ((currentCost - lastCost) / lastCost) * 100 : null;
      const displayProj = this.getCostBreakdownProject(proj);
      if (projectFilter && !projectFilter(displayProj)) continue;
      if (currentCost > 0 || lastCost > 0) {
        result.push({
          project: displayProj,
          type: 'AWS',
          platform: 'AWS',
          usage: '账单',
          note: '',
          quantity: 1,
          currentCost: Math.round(currentCost * 100) / 100,
          lastCost: Math.round(lastCost * 100) / 100,
          change: change != null ? Math.round(change * 100) / 100 : null,
        });
      }
    }

    const key = (c: { platform: string; region: string; project: string }) =>
      `${c.platform}::${c.region}::${c.project}`;
    const idcCurMap = new Map(idcCur.map((c) => [key(c), c]));
    const idcLastMap = new Map(idcLast.map((c) => [key(c), c]));
    const allKeys = new Set([...idcCurMap.keys(), ...idcLastMap.keys()]);
    for (const k of allKeys) {
      const cur = idcCurMap.get(k);
      const last = idcLastMap.get(k);
      const currentCost = cur?.cost ?? 0;
      const lastCost = last?.cost ?? 0;
      const change = lastCost > 0 ? ((currentCost - lastCost) / lastCost) * 100 : null;
      const proj = cur?.project || last?.project || '';
      const plat = cur?.platform || last?.platform || 'IDC';
      const region = cur?.region || last?.region || '';
      if (currentCost > 0 || lastCost > 0) {
        const displayProj = proj || 'IDC';
        if (projectFilter && !projectFilter(displayProj)) continue;
        result.push({
          project: displayProj,
          type: 'IDC',
          platform: plat,
          usage: 'IDC费用',
          note: region,
          quantity: 1,
          currentCost,
          lastCost,
          change: change != null ? Math.round(change * 100) / 100 : null,
        });
      }
    }

    const domainTotalCur = await this.domainService.getDomainMonthlyCost();
    const domainTotalLast = domainTotalCur;
    if (domainTotalCur > 0) {
      result.push({
        project: '未分配',
        type: '域名',
        platform: '域名',
        usage: '续费',
        note: '',
        quantity: 1,
        currentCost: Math.round(domainTotalCur * 100) / 100,
        lastCost: Math.round(domainTotalLast * 100) / 100,
        change: null,
      });
    }

    const totalCurrent = result.reduce((s, r) => s + r.currentCost, 0);
    const totalLast = result.reduce((s, r) => s + r.lastCost, 0);
    const hasManualLast = false;
    const totalChange =
      totalLast > 0 ? Math.round(((totalCurrent - totalLast) / totalLast) * 10000) / 100 : null;

    if (ids.length === 0) {
      await this.saveSnapshot(
        year,
        month,
        rows.map((r) => ({
          project: r.project,
          platform: r.platform,
          usage: r.usage,
          quantity: r.quantity,
          cost: r.cost,
        })),
      );
    }

    return {
      year,
      month,
      rows: result,
      totalCurrent,
      totalLast,
      totalChange,
      hasManualLast,
      filterProjectNames: ids.length > 0 ? [...projectNames].sort() : null,
    };
  }

  /** 保存上月手动填写（首月用）或保存当月快照 */
  async saveSnapshot(
    year: number,
    month: number,
    items: { project: string; platform: string; usage: string; quantity: number; cost: number }[],
  ) {
    for (const item of items) {
      await this.prisma.monthlyStatsSnapshot.upsert({
        where: {
          year_month_project_platform_usage: {
            year,
            month,
            project: item.project,
            platform: item.platform,
            usage: item.usage,
          },
        },
        create: {
          year,
          month,
          project: item.project,
          platform: item.platform,
          usage: item.usage,
          quantity: item.quantity,
          cost: item.cost,
        },
        update: { quantity: item.quantity, cost: item.cost },
      });
    }
  }

  /** 获取多个月份数据，用于折线图等对比 */
  async getMultiMonthStats(year: number, month: number, monthsCount: number = 6) {
    const result: {
      label: string;
      year: number;
      month: number;
      total: number;
      byProject: Record<string, number>;
      byPlatform: Record<string, number>;
      byGroup: Record<string, number>;
    }[] = [];

    for (let i = 0; i < monthsCount; i++) {
      let y = year;
      let m = month - i;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      const stats = await this.getMonthlyStats(y, m);
      result.push({
        label: `${y}年${m}月`,
        year: y,
        month: m,
        total: stats.total,
        byProject: Object.fromEntries(stats.totalByProject.map((x) => [x.name, x.amount])),
        byPlatform: Object.fromEntries(stats.totalByPlatform.map((x) => [x.name, x.amount])),
        byGroup: Object.fromEntries((stats.totalByGroup || []).map((x) => [x.name, x.amount])),
      });
    }

    return result.reverse();
  }
}
