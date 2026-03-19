import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class DoCostService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  async getAccounts() {
    try {
      const list = await this.prisma.doAccount.findMany({
        orderBy: [{ costQuerySortOrder: 'asc' }, { name: 'asc' }],
      });
      return list.map((a) => ({
        ...a,
        token: a.token ? '********' : null,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("doesn't exist") || msg.includes('Unknown table') || msg.includes('do_accounts')) {
        throw new BadRequestException('DO 相关数据库表未创建，请执行: npx prisma migrate deploy');
      }
      throw e;
    }
  }

  async createAccount(data: { name: string; token: string; notes?: string }) {
    const encrypted = this.crypto.encrypt(data.token.trim());
    return this.prisma.doAccount.create({
      data: {
        name: data.name.trim(),
        token: encrypted,
        notes: data.notes?.trim() || null,
      },
    });
  }

  async updateAccount(
    id: number,
    data: {
      name?: string;
      token?: string;
      notes?: string;
      costQueryEnabled?: boolean;
      costQuerySortOrder?: number;
    },
  ) {
    const update: Record<string, unknown> = {};
    if (data.name != null) update.name = data.name.trim();
    if (data.notes !== undefined) update.notes = data.notes?.trim() || null;
    if (data.costQueryEnabled !== undefined) update.costQueryEnabled = data.costQueryEnabled;
    if (data.costQuerySortOrder !== undefined) update.costQuerySortOrder = data.costQuerySortOrder;
    if (data.token != null && data.token.trim()) update.token = this.crypto.encrypt(data.token.trim());
    return this.prisma.doAccount.update({ where: { id }, data: update });
  }

  async deleteAccount(id: number) {
    await this.prisma.doAccount.delete({ where: { id } });
    return { deleted: true };
  }

  async updateCostQueryOrder(accountIds: number[]) {
    const ids = accountIds.filter((n) => Number.isInteger(n) && n > 0);
    await this.prisma.doAccount.updateMany({ data: { costQueryEnabled: false } });
    for (let i = 0; i < ids.length; i++) {
      await this.prisma.doAccount.update({
        where: { id: ids[i] },
        data: { costQueryEnabled: true, costQuerySortOrder: i },
      });
    }
    return { updated: ids.length };
  }

  async getCosts(year?: number, month?: number, accountId?: number) {
    const where: { year?: number; month?: number; accountId?: number } = {};
    if (year != null) where.year = year;
    if (month != null) where.month = month;
    if (accountId != null) where.accountId = accountId;
    return this.prisma.doCost.findMany({
      where,
      include: { account: { select: { id: true, name: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { account: { name: 'asc' } }, { project: 'asc' }],
    });
  }

  async createCost(data: { year: number; month: number; accountId: number; project?: string; usage?: string; amount: number }) {
    return this.prisma.doCost.create({
      data: {
        year: data.year,
        month: data.month,
        accountId: data.accountId,
        project: (data.project ?? '').trim() || '未分类',
        usage: (data.usage ?? '').trim() || null,
        amount: Number(data.amount) || 0,
      },
      include: { account: { select: { id: true, name: true } } },
    });
  }

  async updateCost(id: number, data: { project?: string; usage?: string; amount?: number }) {
    const update: Record<string, unknown> = {};
    if (data.project !== undefined) update.project = (data.project ?? '').trim() || '未分类';
    if (data.usage !== undefined) update.usage = (data.usage ?? '').trim() || null;
    if (data.amount != null) update.amount = Number.isFinite(Number(data.amount)) ? Number(data.amount) : 0;
    if (Object.keys(update).length === 0) throw new Error('至少需要提供一个要更新的字段');
    return this.prisma.doCost.update({
      where: { id },
      data: update,
      include: { account: { select: { id: true, name: true } } },
    });
  }

  async deleteCost(id: number) {
    await this.prisma.doCost.delete({ where: { id } });
    return { deleted: true };
  }
}
