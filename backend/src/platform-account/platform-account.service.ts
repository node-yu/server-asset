import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class PlatformAccountService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  async findAll(platformId?: number, idcOnly?: boolean) {
    const where: { platformId?: number; platform?: { isIdcSupplier: boolean } } = {};
    if (platformId) where.platformId = platformId;
    if (idcOnly) where.platform = { isIdcSupplier: true };
    const list = await this.prisma.platformAccount.findMany({
      where,
      include: { platform: { select: { name: true } } },
      orderBy: [{ platform: { name: 'asc' } }, { accountName: 'asc' }],
    });
    return list.map((a) => ({ ...a, password: '********' }));
  }

  async getStatsByPlatform() {
    const accounts = await this.prisma.platformAccount.groupBy({
      by: ['platformId'],
      _count: { id: true },
    });
    const platformIds = accounts.map((a) => a.platformId);
    const platforms = await this.prisma.platform.findMany({
      where: { id: { in: platformIds } },
    });
    const platformMap = Object.fromEntries(platforms.map((p) => [p.id, p.name]));
    return accounts.map((a) => ({
      platformId: a.platformId,
      platformName: platformMap[a.platformId] || '未知',
      count: a._count.id,
    }));
  }

  async create(platformId: number, accountName: string, password: string, notes?: string) {
    return this.prisma.platformAccount.create({
      data: {
        platformId,
        accountName,
        password: this.crypto.encrypt(password),
        notes,
      },
      include: { platform: { select: { name: true } } },
    }).then((a) => ({ ...a, password: '********' }));
  }

  async getPassword(id: number) {
    const acc = await this.prisma.platformAccount.findUnique({ where: { id } });
    if (!acc) throw new NotFoundException('账号不存在');
    return { password: this.crypto.decrypt(acc.password) };
  }

  async update(id: number, data: { accountName?: string; password?: string; notes?: string }) {
    await this.prisma.platformAccount.findUniqueOrThrow({ where: { id } });
    const update: Record<string, unknown> = {};
    if (data.accountName !== undefined) update.accountName = data.accountName;
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.password?.trim()) update.password = this.crypto.encrypt(data.password);
    return this.prisma.platformAccount.update({
      where: { id },
      data: update,
      include: { platform: { select: { name: true } } },
    }).then((a) => ({ ...a, password: '********' }));
  }

  async remove(id: number) {
    await this.prisma.platformAccount.findUniqueOrThrow({ where: { id } });
    return this.prisma.platformAccount.delete({ where: { id } });
  }
}
