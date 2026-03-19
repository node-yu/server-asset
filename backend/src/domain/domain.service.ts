import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UnifiedDomain {
  id: number;
  domain: string;
  provider: 'porkbun' | 'namecheap' | 'godaddy';
  createDate: string;
  expireDate: string;
  autoRenew: boolean;
  isExpired: boolean;
  status?: string;
  renewalPrice?: string;
  project?: string;
  usage?: string;
}

export interface DomainSummaryStats {
  total: number;
  inUseTotal: number; // 正在使用 = 未过期且未取消
  filteredTotal: number;
  byPlatform: { provider: string; label: string; total: number; inUse: number; autoRenew: number; expired: number; cancelled: number }[];
  autoRenewTotal: number;
  expiredTotal: number;
  cancelledTotal: number;
}

interface PorkbunDomain {
  domain: string;
  status: string;
  tld: string;
  createDate: string;
  expireDate: string;
  autoRenew: number;
}

interface PorkbunPricing {
  [tld: string]: { registration: string; renewal: string; transfer: string };
}

/** 各后缀参考续费价格（USD/年），用于 API 未返回价格时的填充。来源：Porkbun/Namecheap/GoDaddy 等 2024 年价格 */
const TLD_RENEWAL_PRICE_FALLBACK: Record<string, number> = {
  com: 12, net: 14, org: 12, co: 29, io: 39, xyz: 13, info: 21, biz: 16,
  me: 25, dev: 15, app: 15, cc: 25, tv: 30, cn: 8, top: 10, online: 25,
  site: 25, store: 25, tech: 25, space: 25, website: 25, club: 12,
  shop: 25, work: 25, fun: 25, live: 25, world: 25, today: 25, link: 25,
  cloud: 25, ai: 80, gq: 25, ml: 25, ga: 25, cf: 25, tk: 0,
  us: 8, uk: 12, de: 8, fr: 12, it: 12, es: 12, nl: 12, ca: 12,
  au: 15, jp: 25, in: 12, ru: 8, br: 12, mx: 12, eu: 12,
  // 更多常见后缀
  asia: 18, mobi: 15, tel: 15, name: 12, pro: 18, aero: 25,
  edu: 15, gov: 15, int: 25, mil: 15, post: 25, travel: 25,
  ltd: 25, inc: 25, company: 25, network: 25, digital: 25,
  solutions: 25, systems: 25, technology: 25, consulting: 25,
  agency: 25, studio: 25, design: 25, photography: 25,
  restaurant: 25, cafe: 25, pizza: 25, yoga: 25, fitness: 25,
  health: 25, dental: 25, legal: 25, finance: 25, insurance: 25,
  realestate: 25, properties: 25, house: 25, land: 25,
  construction: 25, plumbing: 25, electrician: 25, cleaning: 25,
  catering: 25, events: 25, wedding: 25,
  academy: 25, school: 25, university: 25, college: 25,
  blog: 25, news: 25, press: 25, media: 25, social: 25,
  email: 25, mail: 25, chat: 25, video: 25, stream: 25,
  game: 25, games: 25, play: 25, cool: 25,
  wtf: 25, lol: 25, sexy: 25, adult: 25,
  // 国别域名
  kr: 25, tw: 25, hk: 25, sg: 25, my: 25, th: 25, vn: 25, ph: 25,
  id: 25, nz: 15, za: 15, pl: 12, cz: 12, hu: 12, ro: 12,
  gr: 12, pt: 12, tr: 12, se: 12, no: 12, dk: 12, fi: 12,
  ie: 12, be: 12, at: 12, ch: 12, lu: 12,
};

@Injectable()
export class DomainService {
  private readonly porkbunApi = 'https://api.porkbun.com/api/json/v3';
  private readonly namecheapApi = 'https://api.namecheap.com/xml.response';
  private get godaddyApi(): string {
    return process.env.GODADDY_API_BASE || 'https://api.godaddy.com';
  }

  constructor(private readonly prisma: PrismaService) {}

  async getSyncConfig(): Promise<{ syncIntervalDays: number; lastSyncAt: string | null }> {
    let config = await this.prisma.domainSyncConfig.findFirst();
    if (!config) {
      config = await this.prisma.domainSyncConfig.create({
        data: { syncIntervalDays: 7 },
      });
    }
    return {
      syncIntervalDays: config.syncIntervalDays,
      lastSyncAt: config.lastSyncAt?.toISOString() ?? null,
    };
  }

  async updateSyncConfig(syncIntervalDays: number): Promise<{ syncIntervalDays: number }> {
    let config = await this.prisma.domainSyncConfig.findFirst();
    if (!config) {
      config = await this.prisma.domainSyncConfig.create({
        data: { syncIntervalDays },
      });
    } else {
      config = await this.prisma.domainSyncConfig.update({
        where: { id: config.id },
        data: { syncIntervalDays },
      });
    }
    return { syncIntervalDays: config.syncIntervalDays };
  }

  async getAllDomains(forceSync = false): Promise<UnifiedDomain[]> {
    const config = await this.getSyncConfig();
    const needsSync =
      forceSync ||
      !config.lastSyncAt ||
      this.daysSince(config.lastSyncAt) >= config.syncIntervalDays;

    if (needsSync) {
      await this.syncFromApi();
    }

    const rows = await this.prisma.domain.findMany({
      orderBy: [{ isExpired: 'asc' }, { expireDate: 'asc' }, { domain: 'asc' }],
    });

    return rows.map((r) => ({
      id: r.id,
      domain: r.domain,
      provider: r.provider as 'porkbun' | 'namecheap' | 'godaddy',
      createDate: r.createDate,
      expireDate: r.expireDate,
      autoRenew: r.autoRenew,
      isExpired: r.isExpired,
      status: r.status ?? undefined,
      renewalPrice: r.renewalPrice ?? undefined,
      project: r.project ?? undefined,
      usage: r.usage ?? undefined,
    }));
  }

  async syncFromApi(platform: 'all' | 'porkbun' | 'namecheap' | 'godaddy' = 'all'): Promise<{ synced: number }> {
    const results: Omit<UnifiedDomain, 'id'>[] = [];

    if (platform === 'all' || platform === 'porkbun') {
      const porkbun = await this.fetchPorkbunDomains().catch((e) => {
        console.warn('[Domain] Porkbun fetch failed:', e.message);
        return [];
      });
      const porkbunPricing = (await this.fetchPorkbunPricing().catch(() => ({}))) as PorkbunPricing;
      for (const d of porkbun) {
        const tld = d.tld?.toLowerCase() || this.getTldFromDomain(d.domain);
        const apiPrice = porkbunPricing[tld]?.renewal;
        const renewalPrice = apiPrice ? `$${apiPrice}` : this.getRenewalPriceFallback(tld);
        results.push({
          domain: d.domain,
          provider: 'porkbun',
          createDate: this.normalizeDate(d.createDate),
          expireDate: this.normalizeDate(d.expireDate),
          autoRenew: d.autoRenew === 1,
          isExpired: this.isExpired(d.expireDate),
          renewalPrice,
        });
      }
    }

    if (platform === 'all' || platform === 'namecheap') {
      const namecheap = await this.fetchNamecheapDomains();
      for (const d of namecheap) {
        const tld = this.getTldFromDomain(d.name);
        const renewalPrice = this.getRenewalPriceFallback(tld);
        results.push({
          domain: d.name,
          provider: 'namecheap',
          createDate: this.normalizeDate(d.created),
          expireDate: this.normalizeDate(d.expires),
          autoRenew: d.autoRenew === 'true',
          isExpired: d.isExpired === 'true',
          renewalPrice,
        });
      }
    }

    if (platform === 'all' || platform === 'godaddy') {
      const godaddy = await this.fetchGoDaddyDomains().catch((e) => {
        console.warn('[Domain] GoDaddy fetch failed:', e.message);
        return [];
      });
      for (const d of godaddy) {
        const tld = this.getTldFromDomain(d.domain);
        const renewalPrice = this.getRenewalPriceFallback(tld);
        results.push({
          domain: d.domain,
          provider: 'godaddy',
          createDate: this.normalizeDate(d.createdAt),
          expireDate: this.normalizeDate(d.expires),
          autoRenew: d.renewAuto ?? false,
          isExpired: this.isExpired(d.expires),
          status: d.status ?? undefined,
          renewalPrice,
        });
      }
    }

    await this.prisma.$transaction(
      async (tx) => {
        for (const r of results) {
          await tx.domain.upsert({
            where: {
              domain_provider: { domain: r.domain, provider: r.provider },
            },
            create: {
              domain: r.domain,
              provider: r.provider,
              createDate: r.createDate,
              expireDate: r.expireDate,
              autoRenew: r.autoRenew,
              isExpired: r.isExpired,
              status: 'status' in r ? r.status : null,
              renewalPrice: r.renewalPrice,
            },
            update: {
              createDate: r.createDate,
              expireDate: r.expireDate,
              autoRenew: r.autoRenew,
              isExpired: r.isExpired,
              status: 'status' in r ? r.status : null,
              renewalPrice: r.renewalPrice,
            },
          });
        }
        const resultKeys = new Set(results.map((r) => `${r.domain}::${r.provider}`));
        const allDb = await tx.domain.findMany({
          where: platform === 'all' ? {} : { provider: platform },
        });
        for (const d of allDb) {
          const key = `${d.domain}::${d.provider}`;
          if (!resultKeys.has(key)) {
            await tx.domain.delete({ where: { id: d.id } });
          }
        }
        const cfg = await tx.domainSyncConfig.findFirst();
        if (!cfg) {
          await tx.domainSyncConfig.create({
            data: { syncIntervalDays: 7, lastSyncAt: new Date() },
          });
        } else {
          await tx.domainSyncConfig.update({
            where: { id: cfg.id },
            data: { lastSyncAt: new Date() },
          });
        }
      },
      { timeout: 60000 },
    );

    return { synced: results.length };
  }

  async updateDomain(id: number, project?: string, usage?: string): Promise<UnifiedDomain> {
    const existing = await this.prisma.domain.findUnique({ where: { id } });
    if (!existing) throw new Error('域名不存在');

    const oldProject = existing.project ?? '';
    const oldUsage = existing.usage ?? '';
    const newProject = project ?? '';
    const newUsage = usage ?? '';

    if (oldProject !== newProject || oldUsage !== newUsage) {
      await this.prisma.domainUsageHistory.create({
        data: {
          domainId: id,
          project: oldProject || null,
          usage: oldUsage || null,
        },
      });
    }

    const updated = await this.prisma.domain.update({
      where: { id },
      data: { project: newProject || null, usage: newUsage || null },
    });

    return {
      id: updated.id,
      domain: updated.domain,
      provider: updated.provider as 'porkbun' | 'namecheap' | 'godaddy',
      createDate: updated.createDate,
      expireDate: updated.expireDate,
      autoRenew: updated.autoRenew,
      isExpired: updated.isExpired,
      status: updated.status ?? undefined,
      renewalPrice: updated.renewalPrice ?? undefined,
      project: updated.project ?? undefined,
      usage: updated.usage ?? undefined,
    };
  }

  async getDomainHistory(id: number): Promise<{ project: string | null; usage: string | null; changedAt: string }[]> {
    const rows = await this.prisma.domainUsageHistory.findMany({
      where: { domainId: id },
      orderBy: { changedAt: 'desc' },
    });
    return rows.map((r) => ({
      project: r.project,
      usage: r.usage,
      changedAt: r.changedAt.toISOString(),
    }));
  }

  /** 域名统计摘要：各平台总数、自动续费、已过期、已取消 */
  async getDomainSummaryStats(filters?: {
    provider?: string;
    status?: string;
    domain?: string;
  }): Promise<DomainSummaryStats> {
    const all = await this.prisma.domain.findMany();
    let filtered = all;
    if (filters?.provider) filtered = filtered.filter((d) => d.provider === filters.provider);
    if (filters?.status === 'expired') filtered = filtered.filter((d) => d.isExpired);
    if (filters?.status === 'normal') filtered = filtered.filter((d) => !d.isExpired);
    if (filters?.domain?.trim()) {
      const q = filters.domain.trim().toLowerCase();
      filtered = filtered.filter((d) => d.domain.toLowerCase().includes(q));
    }

    const isCancelled = (d: { status?: string | null }) => {
      const s = (d.status ?? '').toUpperCase();
      return s.includes('CANCELLED') || s.includes('TRANSFERRED') || s.includes('CONFISCATED');
    };

    const byPlatform = [
      { provider: 'porkbun', label: 'Porkbun' },
      { provider: 'namecheap', label: 'Namecheap' },
      { provider: 'godaddy', label: 'GoDaddy' },
    ].map(({ provider, label }) => {
      const list = all.filter((d) => d.provider === provider);
      const expired = list.filter((d) => d.isExpired).length;
      const cancelled = list.filter((d) => isCancelled(d)).length;
      const inUse = list.filter((d) => !d.isExpired && !isCancelled(d)).length;
      return {
        provider,
        label,
        total: list.length,
        inUse,
        autoRenew: list.filter((d) => d.autoRenew).length,
        expired,
        cancelled,
      };
    });

    const inUseTotal = all.filter((d) => !d.isExpired && !isCancelled(d)).length;

    return {
      total: all.length,
      inUseTotal,
      filteredTotal: filtered.length,
      byPlatform,
      autoRenewTotal: all.filter((d) => d.autoRenew).length,
      expiredTotal: all.filter((d) => d.isExpired).length,
      cancelledTotal: all.filter((d) => isCancelled(d)).length,
    };
  }

  /** 为没有价格的域名填充参考价格（基于 TLD 后缀） */
  async fillMissingRenewalPrices(): Promise<{ updated: number }> {
    const domains = await this.prisma.domain.findMany({
      where: { renewalPrice: null },
      select: { id: true, domain: true },
    });
    let updated = 0;
    for (const d of domains) {
      const tld = this.getTldFromDomain(d.domain);
      const price = this.getRenewalPriceFallback(tld);
      if (price) {
        await this.prisma.domain.update({
          where: { id: d.id },
          data: { renewalPrice: price },
        });
        updated++;
      }
    }
    return { updated };
  }

  /** 域名月均费用（年费/12），用于费用看板 */
  async getDomainMonthlyCost(): Promise<number> {
    const rows = await this.prisma.domain.findMany({
      where: { isExpired: false, renewalPrice: { not: null } },
      select: { renewalPrice: true },
    });
    let sum = 0;
    for (const r of rows) {
      if (!r.renewalPrice) continue;
      const num = parseFloat(r.renewalPrice.replace(/[^0-9.]/g, ''));
      if (!Number.isNaN(num)) sum += num / 12;
    }
    return Math.round(sum * 100) / 100;
  }

  async setAutoRenew(domain: string, provider: string, enabled: boolean): Promise<{ success: boolean; message?: string }> {
    if (provider !== 'porkbun') {
      return { success: false, message: 'Namecheap 暂不支持通过 API 设置自动续费，请前往控制台操作' };
    }

    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;
    if (!apiKey || !secretKey) {
      return { success: false, message: '未配置 Porkbun API 密钥' };
    }

    const res = await fetch(`${this.porkbunApi}/domain/updateAutoRenew/${encodeURIComponent(domain)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: apiKey,
        secretapikey: secretKey,
        status: enabled ? 'on' : 'off',
      }),
    });
    const data = await res.json();

    if (data.status !== 'SUCCESS') {
      return { success: false, message: data.message || 'Porkbun API 调用失败' };
    }

    await this.prisma.domain.updateMany({
      where: { domain, provider: 'porkbun' },
      data: { autoRenew: enabled },
    });

    return { success: true };
  }

  private daysSince(isoDate: string): number {
    const d = new Date(isoDate);
    return (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
  }

  private getTldFromDomain(domain: string): string {
    const parts = domain?.split('.') || [];
    return (parts[parts.length - 1] || '').toLowerCase();
  }

  private getRenewalPriceFallback(tld: string): string | undefined {
    if (!tld) return undefined;
    const price = TLD_RENEWAL_PRICE_FALLBACK[tld];
    return price != null ? `$${price}` : undefined;
  }

  private async fetchPorkbunDomains(): Promise<PorkbunDomain[]> {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;
    if (!apiKey || !secretKey) return [];

    const all: PorkbunDomain[] = [];
    let start = 0;
    while (true) {
      const res = await fetch(`${this.porkbunApi}/domain/listAll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: apiKey,
          secretapikey: secretKey,
          start: String(start),
        }),
      });
      const data = await res.json();
      if (data.status !== 'SUCCESS') {
        throw new Error(data.message || 'Porkbun API error');
      }
      const domains = data.domains || [];
      all.push(...domains);
      if (domains.length < 1000) break;
      start += 1000;
    }
    return all;
  }

  private async fetchPorkbunPricing(): Promise<PorkbunPricing> {
    const res = await fetch(`${this.porkbunApi}/pricing/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = await res.json();
    return data.pricing || {};
  }

  /** Namecheap API 有频率限制，连续请求会返回 500000 Too many requests。请求间隔（毫秒），默认 3500ms ≈ 17 次/分钟 */
  private get namecheapRequestDelayMs(): number {
    const v = process.env.NAMECHEAP_API_DELAY_MS;
    const n = v ? parseInt(v, 10) : 3500;
    return Number.isNaN(n) || n < 0 ? 3500 : Math.min(n, 60000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async fetchNamecheapDomains(): Promise<
    { name: string; created: string; expires: string; isExpired: string; autoRenew: string }[]
  > {
    const apiUser = process.env.NAMECHEAP_API_USER;
    const apiKey = process.env.NAMECHEAP_API_KEY;
    const username = process.env.NAMECHEAP_USERNAME;
    const clientIp = process.env.NAMECHEAP_CLIENT_IP;
    if (!apiUser || !apiKey || !username || !clientIp) return [];

    const url = new URL(this.namecheapApi);
    url.searchParams.set('ApiUser', apiUser);
    url.searchParams.set('ApiKey', apiKey);
    url.searchParams.set('UserName', username);
    url.searchParams.set('ClientIp', clientIp);
    url.searchParams.set('Command', 'namecheap.domains.getList');
    url.searchParams.set('PageSize', '100');

    const delayMs = this.namecheapRequestDelayMs;
    const maxRetries = 3;

    const all: { name: string; created: string; expires: string; isExpired: string; autoRenew: string }[] = [];
    let page = 1;
    while (true) {
      if (page > 1) await this.sleep(delayMs);

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        url.searchParams.set('Page', String(page));
        const res = await fetch(url.toString());
        const xml = await res.text();
        const err = this.parseNamecheapError(xml);
        if (!err) {
          const batch = this.parseNamecheapXml(xml);
          all.push(...batch);
          const totalMatch = /<TotalItems>(\d+)<\/TotalItems>/.exec(xml);
          const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
          if (all.length >= total || batch.length < 100) return all;
          page++;
          break;
        }
        const isRateLimit = err.includes('500000') || err.toLowerCase().includes('too many requests');
        if (isRateLimit && attempt < maxRetries - 1) {
          const backoff = (attempt + 1) * 5000;
          console.warn(`[Domain] Namecheap rate limit, retry in ${backoff}ms (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(backoff);
        } else {
          throw new Error(err);
        }
      }
    }
    return all;
  }

  private async fetchGoDaddyDomains(): Promise<
    { domain: string; createdAt: string; expires: string; renewAuto: boolean; status?: string }[]
  > {
    const apiKey = process.env.GODADDY_API_KEY;
    const apiSecret = process.env.GODADDY_API_SECRET;
    if (!apiKey || !apiSecret) return [];

    const auth = `sso-key ${apiKey}:${apiSecret}`;
    const url = `${this.godaddyApi}/v1/domains?limit=1000`;

    const res = await fetch(url, {
      headers: {
        Authorization: auth,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || `GoDaddy API ${res.status}`);
    }

    const batch = (await res.json()) as { domain: string; createdAt?: string; expires?: string; renewAuto?: boolean; status?: string }[];
    return batch.map((d) => ({
      domain: d.domain,
      createdAt: d.createdAt ?? '',
      expires: d.expires ?? '',
      renewAuto: d.renewAuto ?? false,
      status: d.status,
    }));
  }

  private parseNamecheapError(xml: string): string | null {
    const statusMatch = /<ApiResponse[^>]*Status="([^"]*)"/.exec(xml);
    if (statusMatch && statusMatch[1].toUpperCase() !== 'OK') {
      const errMatch = /<Error[^>]*>([^<]*)<\/Error>/.exec(xml);
      const numMatch = /<Error\s+Number="(\d+)"/.exec(xml);
      const errMsg = errMatch ? errMatch[1].trim() : 'Unknown error';
      const num = numMatch ? numMatch[1] : '';
      return `Namecheap API (${num}): ${errMsg}`;
    }
    return null;
  }

  async getGoDaddyDebug(): Promise<{
    configured: boolean;
    status: string;
    error: string | null;
    domainCount: number;
    rawPreview: string;
    hint: string;
    apiBase: string;
  }> {
    const apiKey = process.env.GODADDY_API_KEY;
    const apiSecret = process.env.GODADDY_API_SECRET;
    if (!apiKey || !apiSecret) {
      return {
        configured: false,
        status: 'not_configured',
        error: '未配置 GODADDY_API_KEY / GODADDY_API_SECRET',
        domainCount: 0,
        rawPreview: '',
        hint: '请在 .env 中配置 GoDaddy API 密钥。注意：生产环境用 api.godaddy.com，OTE 测试环境用 api.ote-godaddy.com',
        apiBase: 'unknown',
      };
    }

    const apiBase = process.env.GODADDY_API_BASE || 'https://api.godaddy.com';
    const auth = `sso-key ${apiKey}:${apiSecret}`;
    const url = `${apiBase}/v1/domains?limit=1000`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: auth, Accept: 'application/json' },
      });
      const data = (await res.json()) as unknown;
      const rawPreview = JSON.stringify(data, null, 2).slice(0, 3000) + (JSON.stringify(data).length > 3000 ? '...' : '');

      if (!res.ok) {
        const err = (data as { message?: string }).message || `HTTP ${res.status}`;
        let hint = '';
        if (res.status === 401) hint = 'API Key 或 Secret 可能错误，请检查 .env 配置';
        else if (res.status === 403) hint = '权限不足，请确认 API 密钥是否有域名列表权限';
        else if (apiBase.includes('ote')) hint = '当前使用 OTE 测试环境，返回的域名与生产环境不同。若要在生产环境验证，请将 GODADDY_API_BASE 设为 https://api.godaddy.com';
        return {
          configured: true,
          status: 'error',
          error: err,
          domainCount: 0,
          rawPreview,
          hint: hint || '请查看 rawPreview 中的错误详情',
          apiBase,
        };
      }

      const list = Array.isArray(data) ? data : [];
      const domains = list.map((d: { domain?: string }) => d.domain).filter(Boolean);
      let hint = '';
      if (apiBase.includes('ote')) {
        hint = '当前使用 OTE 测试环境 (api.ote-godaddy.com)，返回的域名与 GoDaddy 生产环境不同。若 186.co、256.co、chd.co 等域名在 GoDaddy 控制台找不到，可能是 OTE 测试数据。请将 GODADDY_API_BASE 设为 https://api.godaddy.com 使用生产环境。';
      } else if (domains.length === 0) {
        hint = 'API 调用成功但返回 0 个域名，可能是账号下确实没有域名';
      }

      return {
        configured: true,
        status: 'ok',
        error: null,
        domainCount: domains.length,
        rawPreview,
        hint,
        apiBase,
      };
    } catch (e: unknown) {
      return {
        configured: true,
        status: 'error',
        error: (e as Error).message,
        domainCount: 0,
        rawPreview: '',
        hint: '网络请求失败，请检查网络或 GoDaddy API 是否可访问',
        apiBase: process.env.GODADDY_API_BASE || 'https://api.godaddy.com',
      };
    }
  }

  async getNamecheapDebug(): Promise<{
    configured: boolean;
    status: string;
    error: string | null;
    domainCount: number;
    rawPreview: string;
    hint: string;
  }> {
    const apiUser = process.env.NAMECHEAP_API_USER;
    const apiKey = process.env.NAMECHEAP_API_KEY;
    const username = process.env.NAMECHEAP_USERNAME;
    const clientIp = process.env.NAMECHEAP_CLIENT_IP;
    if (!apiUser || !apiKey || !username || !clientIp) {
      return {
        configured: false,
        status: 'not_configured',
        error: '未配置 NAMECHEAP_API_USER / API_KEY / USERNAME / CLIENT_IP',
        domainCount: 0,
        rawPreview: '',
        hint: '请在 .env 中配置 Namecheap API 相关变量',
      };
    }

    const url = new URL(this.namecheapApi);
    url.searchParams.set('ApiUser', apiUser);
    url.searchParams.set('ApiKey', apiKey);
    url.searchParams.set('UserName', username);
    url.searchParams.set('ClientIp', clientIp);
    url.searchParams.set('Command', 'namecheap.domains.getList');
    url.searchParams.set('PageSize', '10');

    try {
      const res = await fetch(url.toString());
      const xml = await res.text();
      const err = this.parseNamecheapError(xml);
      const domains = this.parseNamecheapXml(xml);

      let hint = '';
      if (err) {
        if (err.includes('1011') || err.toLowerCase().includes('permission') || err.toLowerCase().includes('denied')) {
          hint = '常见原因：1) Client IP 未在 Namecheap 后台白名单；2) 需满足 20+ 域名或 $50+ 消费才能开通 API';
        } else if (err.toLowerCase().includes('ip')) {
          hint = 'Client IP 必须与发起请求的出口 IP 一致，且已在 Namecheap 白名单中。若用本地运行，请填写你当前的公网 IP';
        }
      } else if (domains.length === 0) {
        const totalMatch = /<TotalItems>(\d+)<\/TotalItems>/.exec(xml);
        const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
        if (total === 0) {
          hint = 'API 调用成功但返回 0 个域名，可能是账号下确实没有域名';
        }
      }

      return {
        configured: true,
        status: err ? 'error' : 'ok',
        error: err,
        domainCount: domains.length,
        rawPreview: xml.slice(0, 1500) + (xml.length > 1500 ? '...' : ''),
        hint,
      };
    } catch (e: unknown) {
      return {
        configured: true,
        status: 'error',
        error: (e as Error).message,
        domainCount: 0,
        rawPreview: '',
        hint: '网络请求失败，请检查网络或 Namecheap API 是否可访问',
      };
    }
  }

  private parseNamecheapXml(
    xml: string,
  ): { name: string; created: string; expires: string; isExpired: string; autoRenew: string }[] {
    const domains: { name: string; created: string; expires: string; isExpired: string; autoRenew: string }[] = [];
    const domainRegex = /<Domain\s+([^>]+)\/?\s*\/?>/g;
    let m;
    while ((m = domainRegex.exec(xml)) !== null) {
      const attrs = m[1];
      const get = (name: string) => {
        const r = new RegExp(`${name}="([^"]*)"`).exec(attrs);
        return r ? r[1] : '';
      };
      const name = get('Name');
      if (name) {
        domains.push({
          name,
          created: get('Created'),
          expires: get('Expires'),
          isExpired: get('IsExpired'),
          autoRenew: get('AutoRenew'),
        });
      }
    }
    return domains;
  }

  private normalizeDate(s: string): string {
    if (!s) return '-';
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
  }

  private isExpired(expireDate: string): boolean {
    const d = new Date(expireDate);
    return !isNaN(d.getTime()) && d.getTime() < Date.now();
  }
}
