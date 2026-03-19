import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { NodeHttpHandler } from '@smithy/node-http-handler';

@Injectable()
export class AwsDailyCostService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  /** 创建带代理的 Cost Explorer 客户端 */
  private createClient(accessKeyId: string, secretAccessKey: string, proxy?: string | null) {
    const creds = { accessKeyId, secretAccessKey };
    const clientConfig: { region: string; credentials: { accessKeyId: string; secretAccessKey: string }; requestHandler?: NodeHttpHandler } = {
      region: 'us-east-1',
      credentials: creds,
    };
    if (proxy && proxy.trim()) {
      const agent = new HttpsProxyAgent(proxy.trim());
      clientConfig.requestHandler = new NodeHttpHandler({
        connectionTimeout: 15000,
        requestTimeout: 30000,
        httpAgent: agent,
        httpsAgent: agent,
      });
    }
    return new CostExplorerClient(clientConfig);
  }

  /** 查询并保存单个账号的每日费用 */
  async queryAndSaveOne(params: { startDate: string; endDate: string; accountId: number }) {
    const { startDate, endDate, accountId } = params;
    const endExclusive = this.addDays(endDate, 1);
    const acc = await this.prisma.awsAccount.findUnique({ where: { id: accountId }, select: { name: true } });
    if (!acc) throw new BadRequestException(`账号 ID ${accountId} 不存在`);

    const client = await this.getClientForAccount(accountId);
    const cmd = new GetCostAndUsageCommand({
      TimePeriod: { Start: startDate, End: endExclusive },
      Granularity: 'DAILY',
      Metrics: ['UnblendedCost'],
    });
    const res = await client.send(cmd);
    const results: { accountId: number; accountName: string; date: string; amount: number; saved: boolean }[] = [];
    for (const result of res.ResultsByTime ?? []) {
      const timeStart = result.TimePeriod?.Start;
      if (!timeStart) continue;
      const amt = result.Total?.UnblendedCost?.Amount;
      const amount = amt != null ? parseFloat(String(amt)) : 0;
      const date = new Date(timeStart);
      await this.prisma.awsDailyCost.upsert({
        where: { accountId_date: { accountId, date } },
        create: { accountId, date, amount },
        update: { amount },
      });
      results.push({ accountId, accountName: acc.name, date: timeStart, amount, saved: true });
    }
    return { results };
  }

  /** 查询并保存每日费用（每个账号一次 API 调用，按日保存） */
  async queryAndSave(params: { startDate: string; endDate: string; accountIds: number[] }) {
    const { startDate, endDate, accountIds } = params;
    const endExclusive = this.addDays(endDate, 1);
    const results: { accountId: number; accountName: string; date: string; amount: number; saved: boolean }[] = [];

    for (const accountId of accountIds) {
      const acc = await this.prisma.awsAccount.findUnique({ where: { id: accountId }, select: { name: true } });
      if (!acc) continue;

      try {
        const client = await this.getClientForAccount(accountId);
        const cmd = new GetCostAndUsageCommand({
          TimePeriod: { Start: startDate, End: endExclusive },
          Granularity: 'DAILY',
          Metrics: ['UnblendedCost'],
        });
        const res = await client.send(cmd);
        for (const result of res.ResultsByTime ?? []) {
          const timeStart = result.TimePeriod?.Start;
          if (!timeStart) continue;
          const amt = result.Total?.UnblendedCost?.Amount;
          const amount = amt != null ? parseFloat(String(amt)) : 0;
          const date = new Date(timeStart);
          await this.prisma.awsDailyCost.upsert({
            where: { accountId_date: { accountId, date } },
            create: { accountId, date, amount },
            update: { amount },
          });
          results.push({ accountId, accountName: acc.name, date: timeStart, amount, saved: true });
        }
      } catch (e) {
        results.push({ accountId, accountName: acc.name, date: startDate, amount: 0, saved: false });
        throw e;
      }
    }
    return { results };
  }

  private async getClientForAccount(accountId: number) {
    const acc = await this.prisma.awsAccount.findUniqueOrThrow({
      where: { id: accountId },
      select: { name: true, accessKeyId: true, secretAccessKey: true, proxy: true },
    });
    const label = acc.name ? `账号「${acc.name}」` : `账号 ID ${accountId}`;
    if (!acc.accessKeyId?.trim() || !acc.secretAccessKey) throw new BadRequestException(`${label}未配置 Access Key`);
    const secretKey = this.crypto.decrypt(acc.secretAccessKey);
    if (!secretKey) throw new BadRequestException(`${label} Secret Key 解密失败`);
    return this.createClient(acc.accessKeyId.trim(), secretKey, acc.proxy);
  }

  private getDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    let d = new Date(start);
    const endD = new Date(end);
    while (d <= endD) {
      dates.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }

  addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /** 获取每日费用列表，按账号一行：每行一个账号，列为查询日期范围内的各天费用 */
  async getDailyCosts(params: { accountIds?: number[]; startDate?: string; endDate?: string }) {
    const { accountIds, startDate, endDate } = params;
    if (!startDate || !endDate) return { dates: [] as string[], rows: [] as { accountId: number; accountName: string; byDate: Record<string, { amount: number; changePct: number | null }> }[] };

    const dates = this.getDateRange(startDate, endDate).reverse();
    const where: { accountId?: { in: number[] }; date?: { gte?: Date; lte?: Date } } = {};
    if (accountIds?.length) where.accountId = { in: accountIds };
    where.date = { gte: new Date(startDate), lte: new Date(endDate) };

    const list = await this.prisma.awsDailyCost.findMany({
      where,
      include: { account: { select: { id: true, name: true, costQuerySortOrder: true } } },
      orderBy: [{ account: { costQuerySortOrder: 'asc' } }, { account: { name: 'asc' } }, { date: 'asc' }],
    });

    const byKey = (accountId: number, date: string) => `${accountId}-${date}`;
    const map = new Map<string, number>();
    for (const row of list) {
      const d = row.date.toISOString().slice(0, 10);
      map.set(byKey(row.accountId, d), row.amount);
    }

    const accountMap = new Map<number, { name: string; sortOrder: number }>();
    for (const row of list) {
      if (!accountMap.has(row.accountId)) {
        accountMap.set(row.accountId, { name: row.account.name, sortOrder: row.account.costQuerySortOrder ?? 0 });
      }
    }

    let accountIdsSeen = [...new Set(list.map((r) => r.accountId))];
    if (accountIds?.length) {
      const fromDb = new Set(accountIdsSeen);
      for (const id of accountIds) {
        if (!fromDb.has(id)) {
          const acc = await this.prisma.awsAccount.findUnique({
            where: { id },
            select: { name: true, costQuerySortOrder: true },
          });
          if (acc) {
            accountMap.set(id, { name: acc.name, sortOrder: acc.costQuerySortOrder ?? 0 });
            accountIdsSeen.push(id);
          }
        }
      }
      accountIdsSeen = accountIdsSeen.filter((id) => accountIds.includes(id));
    }
    accountIdsSeen.sort((a, b) => {
      const oa = accountMap.get(a)?.sortOrder ?? 0;
      const ob = accountMap.get(b)?.sortOrder ?? 0;
      if (oa !== ob) return oa - ob;
      return (accountMap.get(a)?.name ?? '').localeCompare(accountMap.get(b)?.name ?? '');
    });

    const rows = accountIdsSeen.map((accountId) => {
      const byDate: Record<string, { amount: number; changePct: number | null }> = {};
      for (let i = 0; i < dates.length; i++) {
        const d = dates[i];
        const amount = map.get(byKey(accountId, d)) ?? 0;
        const prevDate = i < dates.length - 1 ? dates[i + 1] : null;
        const prevAmount = prevDate != null ? map.get(byKey(accountId, prevDate)) ?? null : null;
        const changePct =
          prevAmount != null && prevAmount > 0 ? Math.round(((amount - prevAmount) / prevAmount) * 10000) / 100 : null;
        byDate[d] = { amount, changePct };
      }
      return {
        accountId,
        accountName: accountMap.get(accountId)?.name ?? '',
        byDate,
      };
    });

    return { dates, rows };
  }

  /** 获取指定月份每个账号的每日费用总和（按账号分组） */
  async getMonthTotal(params: { year: number; month: number; accountIds?: number[] }) {
    const { year, month, accountIds } = params;
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const where: { accountId?: { in: number[] }; date: { gte: Date; lte: Date } } = {
      date: { gte: new Date(start), lte: new Date(end) },
    };
    if (accountIds?.length) where.accountId = { in: accountIds };

    const list = await this.prisma.awsDailyCost.findMany({
      where,
      include: { account: { select: { name: true } } },
    });

    const byAccount = new Map<number, { accountName: string; total: number }>();
    for (const row of list) {
      const cur = byAccount.get(row.accountId) ?? { accountName: row.account.name, total: 0 };
      cur.total += row.amount;
      byAccount.set(row.accountId, cur);
    }

    const byAccountList = [...byAccount.entries()].map(([accountId, { accountName, total }]) => ({
      accountId,
      accountName,
      total,
    }));

    return { year, month, byAccount: byAccountList };
  }

  /** 将每日费用月度汇总同步到费用登记（AwsCost），project 固定为「AWS每日汇总」便于识别和修改 */
  async syncMonthlyToCostRegistration(params: { year: number; month: number; accountIds?: number[] }) {
    const { year, month, byAccount } = await this.getMonthTotal(params);
    const PROJECT = 'AWS每日汇总';

    for (const { accountId, total } of byAccount) {
      if (total <= 0) continue;
      const existing = await this.prisma.awsCost.findFirst({
        where: { accountId, year, month, project: PROJECT },
      });
      if (existing) {
        await this.prisma.awsCost.update({
          where: { id: existing.id },
          data: { amount: total },
        });
      } else {
        await this.prisma.awsCost.create({
          data: { accountId, year, month, project: PROJECT, usage: null, amount: total },
        });
      }
    }
  }
}

