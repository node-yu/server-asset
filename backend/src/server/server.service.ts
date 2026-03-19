import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { PlatformService } from '../platform/platform.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';

@Injectable()
export class ServerService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private platformService: PlatformService,
  ) {}

  async create(dto: CreateServerDto) {
    const canonicalPlatform = (await this.platformService.findByNameIgnoreCase(dto.platform))?.name ?? dto.platform;
    const encryptedPassword = this.crypto.encrypt(dto.password);
    const { platformAccountId, platform: _p, ...rest } = dto;
    const data: Prisma.ServerCreateInput = {
      ...rest,
      platform: canonicalPlatform,
      password: encryptedPassword,
      platformAccount: platformAccountId ? { connect: { id: platformAccountId } } : undefined,
      createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
      cancelAt: dto.cancelAt ? new Date(dto.cancelAt) : null,
    };
    return this.prisma.server.create({
      data,
      include: { platformAccount: { select: { id: true, accountName: true } } },
    });
  }

  async findAll(params?: { project?: string; platform?: string; status?: string; usage?: string; search?: string; platformAccountId?: number }) {
    const where: Prisma.ServerWhereInput = {};
    if (params?.project) where.project = params.project;
    if (params?.platform) where.platform = params.platform;
    if (params?.platformAccountId != null) where.platformAccountId = params.platformAccountId;
    if (params?.status) where.status = params.status;
    if (params?.usage) {
      if (params.usage === '核心') {
        where.AND = [
          {
            OR: [
              { usage: { startsWith: '核心' } },
              { usage: { notIn: ['会员节点', '免费节点', '广告节点'] } },
            ],
          },
        ];
      } else {
        where.usage = params.usage;
      }
    }
    if (params?.search && params.search.trim()) {
      const raw = params.search.trim();
      const terms = raw
        .split(/[\s,，\n;；]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const searchCond =
        terms.length === 1
          ? {
              OR: [
                { hostname: { contains: terms[0] } },
                { ip: { contains: terms[0] } },
                { manager: { contains: terms[0] } },
                { usage: { contains: terms[0] } },
              ],
            }
          : {
              OR: terms.map((kw) => ({
                OR: [
                  { hostname: { contains: kw } },
                  { ip: { contains: kw } },
                  { manager: { contains: kw } },
                  { usage: { contains: kw } },
                ],
              })),
            };
      const existingAnd = Array.isArray(where.AND) ? where.AND : (where.AND ? [where.AND] : []);
      where.AND = [...existingAnd, searchCond];
    }

    const list = await this.prisma.server.findMany({
      where,
      include: { platformAccount: { select: { id: true, accountName: true, platform: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    const sorted = this.sortByAvailability(list);
    return sorted.map((s) => this.maskPassword(s));
  }

  private sortByAvailability<T extends { status?: string; cancelAt: Date | string | null; createdAt: Date | string }>(
    list: T[],
  ): T[] {
    const now = new Date();
    const group = (s: T): number => {
      const status = (s.status || '').trim();
      const cancelAt = s.cancelAt ? new Date(s.cancelAt) : null;
      const isExpiredByStatus = status === '已过期' || status === '已取消' || status === '未使用';
      const isExpiredByDate = cancelAt !== null && cancelAt < now;
      if (isExpiredByStatus || isExpiredByDate) return 2; // 已过期 -> 最下
      if (cancelAt !== null) return 1; // 有取消时间但未到期 -> 中间
      return 0; // 可用 -> 最上
    };
    return [...list].sort((a, b) => {
      const ga = group(a);
      const gb = group(b);
      if (ga !== gb) return ga - gb;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  async findOne(id: number) {
    const server = await this.prisma.server.findUnique({ where: { id } });
    if (!server) throw new NotFoundException('服务器不存在');
    return this.maskPassword(server);
  }

  async getDecryptedPassword(id: number): Promise<{ password: string }> {
    const server = await this.prisma.server.findUnique({ where: { id } });
    if (!server) throw new NotFoundException('服务器不存在');
    const password = this.crypto.decrypt(server.password);
    return { password };
  }

  async update(id: number, dto: UpdateServerDto) {
    await this.findOne(id);
    const { platformAccountId, ...rest } = dto;
    const data: Prisma.ServerUpdateInput = { ...rest };
    if (dto.platform) {
      const canonical = (await this.platformService.findByNameIgnoreCase(dto.platform))?.name ?? dto.platform;
      data.platform = canonical;
    }
    if (dto.password) {
      data.password = this.crypto.encrypt(dto.password);
    }
    if (dto.createdAt !== undefined) {
      data.createdAt = dto.createdAt ? new Date(dto.createdAt) : undefined;
    }
    if (dto.cancelAt !== undefined) {
      data.cancelAt = dto.cancelAt ? new Date(dto.cancelAt) : null;
    }
    if (platformAccountId !== undefined) {
      data.platformAccount = platformAccountId
        ? { connect: { id: platformAccountId } }
        : { disconnect: true };
    }
    return this.prisma.server.update({
      where: { id },
      data,
      include: { platformAccount: { select: { accountName: true } } },
    });
  }

  async batchUpdate(ids: number[], dto: Partial<UpdateServerDto>) {
    if (!ids?.length) return [];
    const { platformAccountId, platform: platformName, password, createdAt, cancelAt, ...rest } = dto;
    const data: Prisma.ServerUpdateInput = { ...rest };
    if (platformName !== undefined) {
      const canonical =
        (await this.platformService.findByNameIgnoreCase(platformName))?.name ?? platformName;
      data.platform = canonical;
    }
    if (password !== undefined) data.password = this.crypto.encrypt(password);
    if (createdAt !== undefined) data.createdAt = createdAt ? new Date(createdAt) : undefined;
    if (cancelAt !== undefined) data.cancelAt = cancelAt ? new Date(cancelAt) : null;
    if (platformAccountId !== undefined) {
      data.platformAccount =
        platformAccountId != null && platformAccountId > 0
          ? { connect: { id: platformAccountId } }
          : { disconnect: true };
    }
    const results = await Promise.all(
      ids.map((id) =>
        this.prisma.server.update({
          where: { id },
          data,
          include: { platformAccount: { select: { accountName: true } } },
        }),
      ),
    );
    return results.map((s) => this.maskPassword(s));
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.server.delete({ where: { id } });
  }

  async findAllForExport() {
    return this.prisma.server.findMany({
      include: { platformAccount: { select: { accountName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async importFromExcel(buffer: Buffer | undefined, options?: { overwrite?: boolean }) {
    if (!buffer) throw new Error('请上传文件');
    const overwrite = options?.overwrite === true;
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

    if (data.length < 2) return { imported: 0, failed: 0, errors: [] };

    const headers = data[0] as string[];
    const created: number[] = [];
    const errors: string[] = [];

    const platformCache = new Map<string, { id: number; name: string }>();
    const projectCache = new Map<string, string>();
    const accountCache = new Map<string, number>();
    let allProjects: { id: number; name: string }[] | null = null;

    const ensurePlatform = async (name: string): Promise<string> => {
      const key = name.toLowerCase();
      if (platformCache.has(key)) return platformCache.get(key)!.name;
      const all = await this.prisma.platform.findMany();
      const existing = all.find((p) => p.name.toLowerCase() === key);
      let p: { id: number; name: string };
      if (existing) {
        p = { id: existing.id, name: existing.name };
      } else {
        const created = await this.prisma.platform.create({ data: { name } });
        p = { id: created.id, name: created.name };
      }
      platformCache.set(key, p);
      return p.name;
    };

    const projectImportAliases: Record<string, string> = { Speed: 'SPEEDTOP', speed: 'SPEEDTOP' };
    const ensureProject = async (name: string): Promise<string> => {
      const normalizedName = projectImportAliases[name] ?? name;
      const key = normalizedName.toLowerCase();
      if (projectCache.has(key)) return projectCache.get(key)!;
      if (projectCache.has(name.toLowerCase())) return projectCache.get(name.toLowerCase())!;
      if (!allProjects) allProjects = await this.prisma.project.findMany({ select: { id: true, name: true } });
      const existing = allProjects.find((p) => p.name.toLowerCase() === key || p.name.toLowerCase() === name.toLowerCase());
      let canonicalName: string;
      if (existing) {
        canonicalName = existing.name;
      } else {
        const defaultGroup = await this.prisma.group.findFirst({ where: { name: '默认组' } });
        const groupId = defaultGroup?.id ?? (await this.prisma.group.create({ data: { name: '默认组' } })).id;
        const created = await this.prisma.project.create({ data: { groupId, name: normalizedName } });
        canonicalName = created.name;
        allProjects.push(created);
      }
      projectCache.set(key, canonicalName);
      if (name.toLowerCase() !== key) projectCache.set(name.toLowerCase(), canonicalName);
      return canonicalName;
    };

    const ensurePlatformAccount = async (
      platformName: string,
      accountName: string,
    ): Promise<number> => {
      const key = `${platformName.toLowerCase()}::${accountName}`;
      if (accountCache.has(key)) return accountCache.get(key)!;
      const canonicalPlatform = await ensurePlatform(platformName);
      const platformId = platformCache.get(platformName.toLowerCase())!.id;
      let acc = await this.prisma.platformAccount.findFirst({
        where: { platformId, accountName },
      });
      if (!acc) {
        acc = await this.prisma.platformAccount.create({
          data: {
            platformId,
            accountName,
            password: this.crypto.encrypt('imported'),
          },
        });
      }
      accountCache.set(key, acc.id);
      return acc.id;
    };

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every((c: any) => c == null || c === '')) continue;

      const get = (name: string) => {
        const idx = headers.indexOf(name);
        return idx >= 0 ? String(row[idx] ?? '').trim() : '';
      };

      const normalizeUsage = (raw: string): string => {
        const s = (raw || '').trim();
        if (!s) return '核心';
        if (s.includes('会员')) return '会员节点';
        if (s.includes('广告')) return '广告节点';
        if (s.includes('免费')) return '免费节点';
        if (s.includes('节点')) return '免费节点';
        if (s.startsWith('核心') || s.includes('核心-')) return s;
        return s;
      };

      const normalizeStatus = (raw: string): string => {
        const s = (raw || '').trim();
        if (!s) return '运行中';
        const lower = s.toLowerCase();
        if (s.includes('已过期') || s.includes('已取消') || s === '过期' || s === '取消' || lower === 'expired' || lower === 'cancelled') {
          return '已过期';
        }
        if (s.includes('未使用') || lower === 'unused') return '未使用';
        if (['运行中', '在用', '正常'].some((k) => s.includes(k))) return '运行中';
        if (['已停止', '停止'].some((k) => s.includes(k))) return '已停止';
        return s;
      };

      const parseDate = (val: unknown): string | undefined => {
        if (val == null || val === '') return undefined;
        const s = String(val).trim();
        if (!s) return undefined;
        const n = Number(val);
        if (!Number.isNaN(n) && n > 0 && n < 100000) {
          const jsDate = new Date((n - 25569) * 86400 * 1000);
          if (!Number.isNaN(jsDate.getTime())) {
            return jsDate.toISOString().slice(0, 16);
          }
        }
        const normalized = s.replace(/\//g, '-');
        const d = new Date(normalized);
        return !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 16) : undefined;
      };

      const platform = get('平台');
      const hostname = get('主机名');
      const ip = get('IP');
      const password = get('密码');
      const project = get('所属项目');
      const accountName = get('关联账号');

      if (!platform || !ip || !project) {
        errors.push(`第${i + 1}行: 缺少必填字段（平台、IP、所属项目）`);
        continue;
      }

      try {
        const canonicalPlatform = await ensurePlatform(platform);
        let canonicalProject: string;
        if (project.includes('&')) {
          for (const p of project.split('&').map((x) => x.trim()).filter(Boolean)) {
            await ensureProject(p);
          }
          canonicalProject = project.split('&').map((x) => x.trim()).filter(Boolean).join('&');
        } else {
          canonicalProject = await ensureProject(project);
        }

        const existingByHost = hostname ? await this.prisma.server.findFirst({ where: { hostname } }) : null;
        const existingByIp = ip ? await this.prisma.server.findFirst({ where: { ip } }) : null;
        const existing = overwrite ? (existingByHost ?? existingByIp) : null;

        if (existing && !overwrite) {
          continue;
        }

        const hostnameForDb = hostname || ip;

        let platformAccountId: number | undefined;
        if (accountName) {
          platformAccountId = await ensurePlatformAccount(platform, accountName);
        }

        const createdAtIdx = headers.indexOf('创建时间');
        const cancelAtIdx = headers.indexOf('取消时间');
        const createdAtRaw = createdAtIdx >= 0 ? row[createdAtIdx] : undefined;
        const cancelAtRaw = cancelAtIdx >= 0 ? row[cancelAtIdx] : undefined;

        const createDto = {
          platform: canonicalPlatform,
          hostname: hostnameForDb,
          ip,
          password: password || 'imported',
          project: canonicalProject,
          status: normalizeStatus(get('状态')),
          usage: normalizeUsage(get('用途')),
          platformAccountId,
          region: get('地区') || undefined,
          bandwidthType: get('流量类型') || undefined,
          serverType: get('服务器类型') || undefined,
          manager: get('管理者') || undefined,
          createdAt: parseDate(createdAtRaw) || undefined,
          cancelAt: parseDate(cancelAtRaw) ?? undefined,
          monthlyCost: parseFloat(get('每月费用')) || 0,
          config: get('配置') || undefined,
          notes: get('备注') || undefined,
        };

        if (existing && overwrite) {
          const { password: _p, ...rest } = createDto;
          const updateDto: import('./dto/update-server.dto').UpdateServerDto = {
            ...rest,
            cancelAt: parseDate(cancelAtRaw) ?? undefined,
          };
          if (password) (updateDto as Record<string, unknown>).password = password || 'imported';
          await this.update(existing.id, updateDto);
          created.push(existing.id);
        } else {
          const server = await this.create(createDto as Parameters<typeof this.create>[0]);
          created.push(server.id);
        }
      } catch (e) {
        errors.push(`第${i + 1}行: ${(e as Error).message}`);
      }
    }

    const ipCountInFile = new Map<string, number>();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every((c: any) => c == null || c === '')) continue;
      const idx = (data[0] as string[]).indexOf('IP');
      const ip = idx >= 0 ? String(row[idx] ?? '').trim() : '';
      if (ip) ipCountInFile.set(ip, (ipCountInFile.get(ip) || 0) + 1);
    }
    const duplicateIps = [...ipCountInFile.entries()]
      .filter(([, c]) => c > 1)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count);
    return { imported: created.length, failed: errors.length, errors, duplicateIps };
  }

  /** 获取重复的 IP 列表（出现次数 > 1） */
  async getDuplicateIps(): Promise<{ ip: string; count: number }[]> {
    const servers = await this.prisma.server.findMany({ select: { ip: true } });
    const countByIp = new Map<string, number>();
    for (const s of servers) {
      const ip = (s.ip || '').trim();
      if (ip) countByIp.set(ip, (countByIp.get(ip) || 0) + 1);
    }
    return [...countByIp.entries()]
      .filter(([, c]) => c > 1)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getTransfers(serverId: number) {
    await this.findOne(serverId);
    return this.prisma.serverProjectTransfer.findMany({
      where: { serverId },
      orderBy: { transferDate: 'asc' },
    });
  }

  async addTransfer(
    serverId: number,
    body: { fromProject: string; toProject: string; transferDate: string },
  ) {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) throw new NotFoundException('服务器不存在');
    const fromProject = (body.fromProject || '').trim();
    const toProject = (body.toProject || '').trim();
    if (!fromProject || !toProject) throw new Error('来源项目和目标项目不能为空');
    const transferDate = new Date(body.transferDate);
    if (Number.isNaN(transferDate.getTime())) throw new Error('转移日期格式无效');
    if (fromProject === toProject) throw new Error('来源项目与目标项目不能相同');

    const transfer = await this.prisma.serverProjectTransfer.create({
      data: {
        serverId,
        fromProject,
        toProject,
        transferDate,
      },
    });
    await this.prisma.server.update({
      where: { id: serverId },
      data: { project: toProject },
    });
    return transfer;
  }

  async removeTransfer(serverId: number, transferId: number) {
    const transfer = await this.prisma.serverProjectTransfer.findFirst({
      where: { id: transferId, serverId },
    });
    if (!transfer) throw new NotFoundException('转移记录不存在');
    await this.prisma.serverProjectTransfer.delete({ where: { id: transferId } });
    const remaining = await this.prisma.serverProjectTransfer.findMany({
      where: { serverId },
      orderBy: { transferDate: 'desc' },
      take: 1,
    });
    const newProject = remaining.length > 0 ? remaining[0].toProject : transfer.fromProject;
    await this.prisma.server.update({
      where: { id: serverId },
      data: { project: newProject },
    });
    return { deleted: true };
  }

  private maskPassword(server: { password?: string; [k: string]: unknown }) {
    const { password, ...rest } = server;
    return { ...rest, password: '********' };
  }
}
