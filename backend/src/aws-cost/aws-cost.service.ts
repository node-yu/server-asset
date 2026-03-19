import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { generate } from 'otplib';
import * as XLSX from 'xlsx';
import { CreateAwsCostDto } from './dto/create-aws-cost.dto';
import { UpdateAwsCostDto } from './dto/update-aws-cost.dto';
import { CreateAwsAccountDto } from './dto/create-aws-account.dto';
import { UpdateAwsAccountDto } from './dto/update-aws-account.dto';

@Injectable()
export class AwsCostService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  async findAll(year?: number, month?: number, accountId?: number) {
    const where: { year?: number; month?: number; accountId?: number } = {};
    if (year != null) where.year = year;
    if (month != null) where.month = month;
    if (accountId != null) where.accountId = accountId;
    return this.prisma.awsCost.findMany({
      where,
      include: { account: { select: { id: true, name: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { account: { name: 'asc' } }, { project: 'asc' }],
    });
  }

  async findOne(id: number) {
    return this.prisma.awsCost.findUniqueOrThrow({
      where: { id },
      include: { account: { select: { id: true, name: true } } },
    });
  }

  async create(dto: CreateAwsCostDto) {
    const project = (dto.project ?? '').toString().trim() || '';
    const accountId = Number(dto.accountId);
    if (!accountId || accountId < 1) throw new Error('请选择账号');
    const year = Number(dto.year) || new Date().getFullYear();
    const month = Number(dto.month) || new Date().getMonth() + 1;
    if (!year || !month) throw new Error('年月不能为空');
    return this.prisma.awsCost.create({
      data: {
        year,
        month,
        accountId,
        project,
        usage: (dto.usage ?? '') ? String(dto.usage).trim() : null,
        amount: Number(dto.amount ?? 0),
      },
      include: { account: { select: { id: true, name: true } } },
    });
  }

  async update(id: number, dto: UpdateAwsCostDto) {
    const data: { project?: string; usage?: string | null; amount?: number } = {};
    if (dto.project != null) data.project = (dto.project ?? '').toString().trim();
    if (dto.usage !== undefined) data.usage = (dto.usage ?? '') ? String(dto.usage).trim() : null;
    if (dto.amount != null) {
      const amt = Number(dto.amount);
      data.amount = Number.isFinite(amt) ? amt : 0;
    }
    if (Object.keys(data).length === 0) {
      throw new Error('至少需要提供一个要更新的字段');
    }
    return this.prisma.awsCost.update({
      where: { id },
      data,
      include: { account: { select: { id: true, name: true } } },
    });
  }

  async remove(id: number) {
    await this.prisma.awsCost.delete({ where: { id } });
    return { deleted: true };
  }

  async getDailyCostJobLogs(params?: { page?: number; pageSize?: number }) {
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, params?.pageSize ?? 5));
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.awsDailyCostJobLog.findMany({
        orderBy: { startedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.awsDailyCostJobLog.count(),
    ]);
    return { items, total, page, pageSize };
  }

  async getAccounts() {
    const list = await this.prisma.awsAccount.findMany({
      orderBy: { name: 'asc' },
    });
    return list.map((a) => ({
      ...a,
      password: a.password ? '********' : null,
      secretAccessKey: a.secretAccessKey ? '********' : null,
    }));
  }

  private toAccountData(dto: CreateAwsAccountDto | UpdateAwsAccountDto, encrypt = true) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = (dto.name ?? '').toString().trim();
    if (dto.awsAccountId !== undefined) data.awsAccountId = (dto.awsAccountId ?? '').toString().trim() || null;
    if (dto.loginAccount !== undefined) data.loginAccount = (dto.loginAccount ?? '').toString().trim() || null;
    if (dto.supplier !== undefined) data.supplier = (dto.supplier ?? '').toString().trim() || null;
    if (dto.loginMethod !== undefined) data.loginMethod = (dto.loginMethod ?? '').toString().trim() || null;
    if (dto.accountType !== undefined) data.accountType = (dto.accountType ?? '').toString().trim() || null;
    if (dto.accessKeyId !== undefined) data.accessKeyId = (dto.accessKeyId ?? '').toString().trim() || null;
    if (dto.proxy !== undefined) data.proxy = (dto.proxy ?? '').toString().trim() || null;
    if (dto.mfa !== undefined) data.mfa = (dto.mfa ?? '').toString().trim() || null;
    if (dto.notes !== undefined) data.notes = (dto.notes ?? '').toString().trim() || null;
    if (dto.password !== undefined && (dto.password ?? '').toString().trim()) {
      data.password = encrypt ? this.crypto.encrypt((dto.password ?? '').toString().trim()) : dto.password;
    }
    if (dto.secretAccessKey !== undefined && (dto.secretAccessKey ?? '').toString().trim()) {
      data.secretAccessKey = encrypt ? this.crypto.encrypt((dto.secretAccessKey ?? '').toString().trim()) : dto.secretAccessKey;
    }
    const udto = dto as UpdateAwsAccountDto;
    if (udto.costQueryStatus !== undefined) data.costQueryStatus = (udto.costQueryStatus ?? '').toString().trim() || null;
    if (udto.costQueryEnabled !== undefined) data.costQueryEnabled = !!udto.costQueryEnabled;
    if (udto.costQuerySortOrder !== undefined) data.costQuerySortOrder = Number(udto.costQuerySortOrder) ?? 0;
    return data;
  }

  async updateCostQueryOrder(accountIds: number[]) {
    const ids = accountIds.filter((n) => Number.isInteger(n) && n > 0);
    await this.prisma.awsAccount.updateMany({ data: { costQueryEnabled: false } });
    for (let i = 0; i < ids.length; i++) {
      await this.prisma.awsAccount.update({
        where: { id: ids[i] },
        data: { costQueryEnabled: true, costQuerySortOrder: i },
      });
    }
    return { updated: ids.length };
  }

  async createAccount(dto: CreateAwsAccountDto) {
    const name = (dto.name ?? '').toString().trim();
    if (!name) throw new Error('账号名称不能为空');
    const data = this.toAccountData(dto) as Record<string, unknown>;
    const created = await this.prisma.awsAccount.create({
      data: { ...data, name },
    });
    return { ...created, password: created.password ? '********' : null, secretAccessKey: created.secretAccessKey ? '********' : null };
  }

  async updateAccount(id: number, dto: UpdateAwsAccountDto) {
    const name = (dto.name ?? '').toString().trim();
    if (dto.name !== undefined && !name) throw new Error('账号名称不能为空');
    const data = this.toAccountData(dto) as Record<string, unknown>;
    if (dto.name !== undefined) (data as { name?: string }).name = name;
    const updated = await this.prisma.awsAccount.update({
      where: { id },
      data,
    });
    return { ...updated, password: updated.password ? '********' : null, secretAccessKey: updated.secretAccessKey ? '********' : null };
  }

  async removeAccount(id: number) {
    await this.prisma.awsAccount.delete({ where: { id } });
    return { deleted: true };
  }

  async getAccountPassword(id: number) {
    const acc = await this.prisma.awsAccount.findUnique({ where: { id }, select: { password: true } });
    if (!acc?.password) return { password: '' };
    return { password: this.crypto.decrypt(acc.password) };
  }

  async getAccountSecretKey(id: number) {
    const acc = await this.prisma.awsAccount.findUnique({ where: { id }, select: { secretAccessKey: true } });
    if (!acc?.secretAccessKey) return { secretAccessKey: '' };
    return { secretAccessKey: this.crypto.decrypt(acc.secretAccessKey) };
  }

  /** 批量获取 TOTP 验证码（MFA seed 转 6 位） */
  async getTotpBatch(ids: number[]): Promise<Record<number, string>> {
    if (ids.length === 0) return {};
    const accounts = await this.prisma.awsAccount.findMany({
      where: { id: { in: ids }, mfa: { not: null } },
      select: { id: true, mfa: true },
    });
    const result: Record<number, string> = {};
    for (const a of accounts) {
      const secret = (a.mfa ?? '').trim().replace(/\s/g, '');
      if (secret) {
        try {
          result[a.id] = await generate({ secret });
        } catch {
          result[a.id] = '';
        }
      }
    }
    return result;
  }

  /** 从 Excel 导入账号 */
  async importFromExcel(buffer: Buffer | undefined): Promise<{ imported: number; failed: number; errors: string[] }> {
    if (!buffer || buffer.length === 0) throw new Error('请上传文件');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as (string | number)[][];
    const headers = (rows[0] ?? []).map((h) => String(h ?? '').trim());
    const col = (names: string[]) => {
      for (const n of names) {
        const i = headers.findIndex((h) => String(h).includes(n) || String(h) === n);
        if (i >= 0) return i;
      }
      return -1;
    };
    const idx = {
      name: col(['账号名称', 'name']),
      awsAccountId: col(['账号ID', 'awsAccountId']),
      loginAccount: col(['账号', 'loginAccount']),
      password: col(['密码', 'password']),
      supplier: col(['供应商', 'supplier']),
      loginMethod: col(['登录方式', 'loginMethod']),
      accountType: col(['账号性质', 'accountType']),
      accessKeyId: col(['Access Key', 'accessKeyId']),
      secretAccessKey: col(['Secret', 'Secret Access Key', 'secretAccessKey']),
      proxy: col(['代理', 'proxy']),
      mfa: col(['MFA', 'mfa']),
      notes: col(['备注', 'notes']),
    };
    if (idx.name < 0) throw new Error('Excel 缺少「账号名称」列');
    let imported = 0;
    const errors: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const get = (k: keyof typeof idx) => (idx[k] >= 0 ? String(row[idx[k]] ?? '').trim() : '');
      const name = get('name');
      if (!name) continue;
      try {
        await this.prisma.awsAccount.create({
          data: {
            name,
            awsAccountId: get('awsAccountId') || null,
            loginAccount: get('loginAccount') || null,
            password: get('password') ? this.crypto.encrypt(get('password')) : null,
            supplier: get('supplier') || null,
            loginMethod: get('loginMethod') || null,
            accountType: get('accountType') || null,
            accessKeyId: get('accessKeyId') || null,
            secretAccessKey: get('secretAccessKey') ? this.crypto.encrypt(get('secretAccessKey')) : null,
            proxy: get('proxy') || null,
            mfa: get('mfa') || null,
            notes: get('notes') || null,
          },
        });
        imported++;
      } catch (e) {
        errors.push(`第 ${i + 1} 行「${name}」: ${e instanceof Error ? e.message : '导入失败'}`);
      }
    }
    return { imported, failed: errors.length, errors };
  }

  /** 获取某月 AWS 费用总和（按项目聚合，用于统计） */
  async getAwsCostsForMonth(year: number, month: number): Promise<{ project: string; amount: number }[]> {
    const rows = await this.prisma.awsCost.findMany({
      where: { year, month },
      select: { project: true, amount: true },
    });
    const byProject = new Map<string, number>();
    for (const r of rows) {
      const proj = (r.project || '').trim() || '未分类';
      byProject.set(proj, (byProject.get(proj) || 0) + r.amount);
    }
    return Array.from(byProject.entries()).map(([project, amount]) => ({ project, amount }));
  }

  /** 获取某月 AWS 费用总和 */
  async getAwsTotalForMonth(year: number, month: number): Promise<number> {
    const result = await this.prisma.awsCost.aggregate({
      where: { year, month },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }
}
