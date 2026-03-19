import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';

const DO_BALANCE_URL = 'https://api.digitalocean.com/v2/customers/my/balance';

/** DigitalOcean 仅提供 MTD（当月至今）费用，每日费用 = MTD今日 - 本月已存储的每日费用总和 */
@Injectable()
export class DoDailyCostService {
  private readonly logger = new Logger(DoDailyCostService.name);

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  /** 调试用：获取 DO Balance API 原始响应 */
  async getRawBalanceResponse(accountId: number) {
    const acc = await this.prisma.doAccount.findUnique({ where: { id: accountId }, select: { name: true, token: true } });
    if (!acc) throw new BadRequestException(`DO 账号 ID ${accountId} 不存在`);
    if (!acc.token?.trim()) throw new BadRequestException(`账号「${acc.name}」未配置 Token`);
    const token = this.crypto.decrypt(acc.token);
    if (!token) throw new BadRequestException(`账号「${acc.name}」Token 解密失败`);
    const res = await fetch(DO_BALANCE_URL, { headers: { Authorization: `Bearer ${token.trim()}` } });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`DO API 请求失败: ${res.status} ${text}`);
    }
    const json = (await res.json()) as Record<string, unknown>;
    return { accountName: acc.name, rawResponse: json };
  }

  /** 查询单个账号的 MTD 费用并计算当日费用，保存到 DoDailyCost。DO API 仅返回当月至今累计，故始终查询并保存「今天」 */
  async queryAndSaveOne(params: { startDate: string; endDate: string; accountId: number }) {
    const { accountId } = params;
    const acc = await this.prisma.doAccount.findUnique({ where: { id: accountId }, select: { name: true, token: true } });
    if (!acc) throw new BadRequestException(`DO 账号 ID ${accountId} 不存在`);
    if (!acc.token?.trim()) throw new BadRequestException(`账号「${acc.name}」未配置 Token`);

    const token = this.crypto.decrypt(acc.token);
    if (!token) throw new BadRequestException(`账号「${acc.name}」Token 解密失败`);

    const res = await fetch(DO_BALANCE_URL, {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`DO API 请求失败: ${res.status} ${text}`);
    }
    const json = (await res.json()) as Record<string, unknown>;
    // DO 官方 API 返回顶层 snake_case: month_to_date_usage (见 OpenAPI spec)，可能为 string 或 number
    const balance = json?.balance as Record<string, unknown> | undefined;
    const mtdRaw =
      json?.month_to_date_usage ??
      balance?.month_to_date_usage ??
      balance?.MonthToDateUsage ??
      json?.MonthToDateUsage ??
      0;
    const mtdToday = typeof mtdRaw === 'number' ? mtdRaw : parseFloat(String(mtdRaw)) || 0;
    if (mtdToday === 0) {
      this.logger.warn(`[DO] 账号 ${acc.name} MTD 解析为 0，原始响应: ${JSON.stringify(json)}`);
    }

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const [year, month] = dateStr.split('-').map(Number);
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const date = new Date(dateStr);

    const prevInMonth = await this.prisma.doDailyCost.findMany({
      where: {
        accountId,
        date: { gte: new Date(firstDay), lt: date },
      },
      select: { amount: true },
    });
    const sumPrev = prevInMonth.reduce((s, r) => s + r.amount, 0);
    const dailyAmount = Math.max(0, mtdToday - sumPrev);

    await this.prisma.doDailyCost.upsert({
      where: { accountId_date: { accountId, date } },
      create: { accountId, date, amount: dailyAmount },
      update: { amount: dailyAmount },
    });

    return { accountId, accountName: acc.name, date: dateStr, amount: dailyAmount, mtd: mtdToday };
  }

  /** 获取指定月份每个账号的每日费用总和 */
  async getMonthTotal(params: { year: number; month: number; accountIds?: number[] }) {
    const { year, month, accountIds } = params;
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const where: { accountId?: { in: number[] }; date: { gte: Date; lte: Date } } = {
      date: { gte: new Date(start), lte: new Date(end) },
    };
    if (accountIds?.length) where.accountId = { in: accountIds };

    const list = await this.prisma.doDailyCost.findMany({
      where,
      include: { account: { select: { name: true } } },
    });

    const byAccount = new Map<number, { accountName: string; total: number }>();
    for (const row of list) {
      const cur = byAccount.get(row.accountId) ?? { accountName: row.account.name, total: 0 };
      cur.total += row.amount;
      byAccount.set(row.accountId, cur);
    }

    return {
      year,
      month,
      byAccount: [...byAccount.entries()].map(([accountId, { accountName, total }]) => ({
        accountId,
        accountName,
        total,
      })),
    };
  }

  /** 将每日费用月度汇总同步到 DoCost（project 固定为「DO每日汇总」） */
  async syncMonthlyToCostRegistration(params: { year: number; month: number; accountIds?: number[] }) {
    const { year, month, byAccount } = await this.getMonthTotal(params);
    const PROJECT = 'DO每日汇总';

    for (const { accountId, total } of byAccount) {
      if (total <= 0) continue;
      const existing = await this.prisma.doCost.findFirst({
        where: { accountId, year, month, project: PROJECT },
      });
      if (existing) {
        await this.prisma.doCost.update({
          where: { id: existing.id },
          data: { amount: total },
        });
      } else {
        await this.prisma.doCost.create({
          data: { accountId, year, month, project: PROJECT, usage: null, amount: total },
        });
      }
    }
  }
}
