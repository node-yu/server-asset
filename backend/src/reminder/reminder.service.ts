import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ReminderUrgency = 'safe' | 'warning' | 'urgent' | 'critical' | 'expired';

export interface ReminderItem {
  id: string;
  type: 'server' | 'domain' | 'custom';
  name: string;
  expireAt: string;
  daysLeft: number;
  urgency: ReminderUrgency;
  extra?: {
    serverId?: number;
    domainId?: number;
    platform?: string;
    provider?: string;
    project?: string;
    category?: string;
    linkUrl?: string;
    notes?: string;
  };
}

export type RenewalType = 'calendar_month' | 'day_of_month' | 'cycle_30' | 'cycle_31';

export interface ProviderRenewalConfigDto {
  id: number;
  provider: string;
  renewalType: RenewalType;
  dayOfMonth: number | null;
}

@Injectable()
export class ReminderService {
  constructor(private readonly prisma: PrismaService) {}

  /** 根据供应商续费配置，从基准日期推算下次续费日（>= today） */
  computeNextRenewalDate(baseDate: Date, config: { renewalType: string; dayOfMonth: number | null }, now: Date): Date | null {
    const base = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (config.renewalType) {
      case 'calendar_month': {
        // 按自然月：每月【基准日】的日期续费（如 3月22日创建，每月22日续费）
        const day = base.getDate();
        let y = today.getFullYear();
        let m = today.getMonth();
        let lastDay = new Date(y, m + 1, 0).getDate();
        let d = Math.min(day, lastDay);
        let next = new Date(y, m, d);
        if (next < today) {
          m += 1;
          if (m > 11) {
            m = 0;
            y += 1;
          }
          lastDay = new Date(y, m + 1, 0).getDate();
          d = Math.min(day, lastDay);
          next = new Date(y, m, d);
        }
        return next;
      }
      case 'day_of_month': {
        // 每月固定 X 号续费（1-31，2月等短月取当月最后一天）
        const wantDay = Math.min(31, Math.max(1, config.dayOfMonth ?? 1));
        const y = today.getFullYear();
        const m = today.getMonth();
        const lastDay = new Date(y, m + 1, 0).getDate();
        const day = Math.min(wantDay, lastDay);
        let next = new Date(y, m, day);
        if (next < today) {
          next.setMonth(next.getMonth() + 1);
          const nextLast = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
          next.setDate(Math.min(wantDay, nextLast));
        }
        return next;
      }
      case 'cycle_30': {
        let next = new Date(base);
        while (next < today) next.setDate(next.getDate() + 30);
        return next;
      }
      case 'cycle_31': {
        let next = new Date(base);
        while (next < today) next.setDate(next.getDate() + 31);
        return next;
      }
      default:
        return null;
    }
  }

  /** 获取即将到期的提醒项（服务器、域名、自定义），默认 30 天内。仅包含未过期的项，排除已设置不提醒的供应商、已标记续费的项 */
  async getUpcomingReminders(withinDays = 30): Promise<ReminderItem[]> {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + withinDays);
    const excluded = await this.getExcludedProviders();
    const renewedSet = await this.getRenewedSet();
    const renewalConfigs = await this.getRenewalConfigMap();
    const items: ReminderItem[] = [];

    // 1. 服务器：优先用 cancelAt；若无则根据供应商续费配置从 createdAt 推算
    const allServers = await this.prisma.server.findMany({
      where: { status: { notIn: ['已取消', '已过期'] } },
      include: { platformAccount: { select: { accountName: true, platform: { select: { name: true } } } } },
    });
    for (const s of allServers) {
      const platform = s.platformAccount?.platform?.name ?? s.platform;
      if (excluded.includes(platform)) continue;

      let expireAt: Date | null = null;
      if (s.cancelAt) {
        const d = new Date(s.cancelAt);
        if (d >= now && d <= cutoff) expireAt = d;
      }
      if (!expireAt && s.createdAt) {
        const config = renewalConfigs.get(platform) ?? renewalConfigs.get('__default__') ?? { renewalType: 'calendar_month', dayOfMonth: null };
        const computed = this.computeNextRenewalDate(s.createdAt, config, now);
        if (computed && computed >= now && computed <= cutoff) expireAt = computed;
      }
      if (!expireAt) continue;

      const expireKey = expireAt.toISOString().slice(0, 10);
      if (renewedSet.has(`server:${s.id}:${expireKey}`)) continue;
      const daysLeft = this.daysBetween(now, expireAt);
      items.push({
        id: `server-${s.id}`,
        type: 'server',
        name: s.hostname,
        expireAt: expireAt.toISOString(),
        daysLeft,
        urgency: this.getUrgency(daysLeft),
        extra: {
          serverId: s.id,
          platform,
          project: s.project,
        },
      });
    }

    // 2. 域名：expireDate 在 [今天, 今天+withinDays] 范围内（未过期），且未标记为已取消
    const domains = await this.prisma.domain.findMany({
      where: { isExpired: false },
    });
    for (const d of domains) {
      if (this.isDomainCancelled(d.status)) continue;
      if (excluded.includes(d.provider)) continue;
      const expireAt = this.parseDomainDate(d.expireDate);
      if (!expireAt || expireAt < now || expireAt > cutoff) continue;
      const expireKey = expireAt.toISOString().slice(0, 10);
      if (renewedSet.has(`domain:${d.id}:${expireKey}`)) continue;
      const daysLeft = this.daysBetween(now, expireAt);
      items.push({
        id: `domain-${d.id}`,
        type: 'domain',
        name: d.domain,
        expireAt: expireAt.toISOString(),
        daysLeft,
        urgency: this.getUrgency(daysLeft),
        extra: {
          domainId: d.id,
          provider: d.provider,
          project: d.project ?? undefined,
        },
      });
    }

    // 3. 自定义提醒：expireAt 在 [今天, 今天+withinDays] 范围内（未过期）
    const customs = await this.prisma.customReminder.findMany({
      where: { expireAt: { gte: now, lte: cutoff } },
    });
    for (const c of customs) {
      const expireKey = c.expireAt.toISOString().slice(0, 10);
      if (renewedSet.has(`custom:${c.id}:${expireKey}`)) continue;
      const daysLeft = this.daysBetween(now, c.expireAt);
      items.push({
        id: `custom-${c.id}`,
        type: 'custom',
        name: c.name,
        expireAt: c.expireAt.toISOString(),
        daysLeft,
        urgency: this.getUrgency(daysLeft),
        extra: {
          category: c.category ?? undefined,
          linkUrl: c.linkUrl ?? undefined,
          notes: c.notes ?? undefined,
        },
      });
    }

    // 按到期日升序
    items.sort((a, b) => new Date(a.expireAt).getTime() - new Date(b.expireAt).getTime());
    return items;
  }

  async getExcludedProviders(): Promise<string[]> {
    const rows = await this.prisma.reminderExcludedProvider.findMany({
      orderBy: { provider: 'asc' },
    });
    return rows.map((r) => r.provider);
  }

  async addExcludedProvider(provider: string): Promise<{ id: number; provider: string }> {
    const trimmed = provider.trim();
    if (!trimmed) throw new Error('供应商名称不能为空');
    return this.prisma.reminderExcludedProvider.upsert({
      where: { provider: trimmed },
      create: { provider: trimmed },
      update: {},
    });
  }

  async removeExcludedProvider(provider: string): Promise<void> {
    await this.prisma.reminderExcludedProvider.deleteMany({
      where: { provider: provider.trim() },
    });
  }

  private async getRenewalConfigMap(): Promise<Map<string, { renewalType: string; dayOfMonth: number | null }>> {
    const rows = await this.prisma.providerRenewalConfig.findMany();
    const map = new Map<string, { renewalType: string; dayOfMonth: number | null }>();
    for (const r of rows) {
      map.set(r.provider, { renewalType: r.renewalType, dayOfMonth: r.dayOfMonth });
    }
    return map;
  }

  /** 返回有服务器（无 cancelAt）且使用默认续费方式的平台，供用户参考是否需单独配置 */
  async getPlatformsNeedingRenewalConfig(): Promise<string[]> {
    const servers = await this.prisma.server.findMany({
      where: {
        cancelAt: null,
        status: { notIn: ['已取消', '已过期'] },
      },
      select: { platform: true, platformAccount: { select: { platform: { select: { name: true } } } } },
    });
    const excluded = await this.getExcludedProviders();
    const configs = await this.getRenewalConfigMap();
    const platforms = new Set<string>();
    for (const s of servers) {
      const platform = s.platformAccount?.platform?.name ?? s.platform;
      if (!platform || excluded.includes(platform) || configs.has(platform)) continue;
      platforms.add(platform);
    }
    return Array.from(platforms).sort();
  }

  async getRenewalConfigs(): Promise<ProviderRenewalConfigDto[]> {
    const rows = await this.prisma.providerRenewalConfig.findMany({
      where: { provider: { not: '__default__' } },
      orderBy: { provider: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      renewalType: r.renewalType as RenewalType,
      dayOfMonth: r.dayOfMonth,
    }));
  }

  async getDefaultRenewalConfig(): Promise<ProviderRenewalConfigDto | null> {
    const row = await this.prisma.providerRenewalConfig.findUnique({
      where: { provider: '__default__' },
    });
    if (!row) return null;
    return { id: row.id, provider: row.provider, renewalType: row.renewalType as RenewalType, dayOfMonth: row.dayOfMonth };
  }

  async upsertDefaultRenewalConfig(data: { renewalType: RenewalType; dayOfMonth?: number }): Promise<ProviderRenewalConfigDto> {
    const validTypes = ['calendar_month', 'day_of_month', 'cycle_30', 'cycle_31'];
    if (!validTypes.includes(data.renewalType)) throw new Error('无效的续费方式');
    const dayOfMonth = data.renewalType === 'day_of_month' ? Math.min(31, Math.max(1, data.dayOfMonth ?? 1)) : null;
    const row = await this.prisma.providerRenewalConfig.upsert({
      where: { provider: '__default__' },
      create: { provider: '__default__', renewalType: data.renewalType, dayOfMonth },
      update: { renewalType: data.renewalType, dayOfMonth },
    });
    return { id: row.id, provider: row.provider, renewalType: row.renewalType as RenewalType, dayOfMonth: row.dayOfMonth };
  }

  async upsertRenewalConfig(data: { provider: string; renewalType: RenewalType; dayOfMonth?: number }): Promise<ProviderRenewalConfigDto> {
    const provider = data.provider.trim();
    if (!provider || provider === '__default__') throw new Error('供应商名称不能为空');
    const validTypes = ['calendar_month', 'day_of_month', 'cycle_30', 'cycle_31'];
    if (!validTypes.includes(data.renewalType)) throw new Error('无效的续费方式');
    const dayOfMonth = data.renewalType === 'day_of_month' ? Math.min(31, Math.max(1, data.dayOfMonth ?? 1)) : null;
    const row = await this.prisma.providerRenewalConfig.upsert({
      where: { provider },
      create: { provider, renewalType: data.renewalType, dayOfMonth },
      update: { renewalType: data.renewalType, dayOfMonth },
    });
    return { id: row.id, provider: row.provider, renewalType: row.renewalType as RenewalType, dayOfMonth: row.dayOfMonth };
  }

  async deleteRenewalConfig(provider: string): Promise<void> {
    await this.prisma.providerRenewalConfig.deleteMany({ where: { provider: provider.trim() } });
  }

  private toDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** 按日历日计算剩余天数，避免时区导致同一天显示不同 */
  private daysBetween(from: Date, to: Date): number {
    const fromDate = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const toDate = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
  }

  private async getRenewedSet(): Promise<Set<string>> {
    const rows = await this.prisma.reminderRenewedRecord.findMany();
    const set = new Set<string>();
    for (const r of rows) {
      const dateKey = r.expireAt.toISOString().slice(0, 10);
      set.add(`${r.type}:${r.refId}:${dateKey}`);
    }
    return set;
  }

  async markAsRenewed(records: { type: string; refId: number; expireAt: string }[]): Promise<{ count: number }> {
    let count = 0;
    for (const r of records) {
      const expireAt = new Date(r.expireAt);
      if (isNaN(expireAt.getTime())) continue;
      try {
        await this.prisma.reminderRenewedRecord.create({
          data: { type: r.type, refId: r.refId, expireAt },
        });
        count++;
      } catch {
        // ignore duplicate (unique constraint)
      }
    }
    return { count };
  }

  private getUrgency(daysLeft: number): ReminderUrgency {
    if (daysLeft < 0) return 'expired';
    if (daysLeft <= 1) return 'critical';
    if (daysLeft <= 3) return 'urgent';
    if (daysLeft <= 7) return 'warning';
    return 'safe';
  }

  private parseDomainDate(s: string): Date | null {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  private isDomainCancelled(status: string | null): boolean {
    const s = (status ?? '').toUpperCase();
    return s.includes('CANCELLED') || s.includes('TRANSFERRED') || s.includes('CONFISCATED');
  }

  // 自定义提醒 CRUD
  async createCustomReminder(data: { name: string; expireAt: string; category?: string; notes?: string; linkUrl?: string }) {
    return this.prisma.customReminder.create({
      data: {
        name: data.name,
        expireAt: new Date(data.expireAt),
        category: data.category ?? null,
        notes: data.notes ?? null,
        linkUrl: data.linkUrl ?? null,
      },
    });
  }

  async updateCustomReminder(id: number, data: { name?: string; expireAt?: string; category?: string; notes?: string; linkUrl?: string }) {
    const update: Record<string, unknown> = {};
    if (data.name != null) update.name = data.name;
    if (data.expireAt != null) update.expireAt = new Date(data.expireAt);
    if (data.category != null) update.category = data.category;
    if (data.notes != null) update.notes = data.notes;
    if (data.linkUrl != null) update.linkUrl = data.linkUrl;
    return this.prisma.customReminder.update({
      where: { id },
      data: update,
    });
  }

  async deleteCustomReminder(id: number) {
    return this.prisma.customReminder.delete({ where: { id } });
  }
}
