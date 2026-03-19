import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.platform.findMany({ orderBy: { name: 'asc' } });
  }

  /** 按名称查找（大小写不敏感） */
  async findByNameIgnoreCase(name: string) {
    const list = await this.prisma.platform.findMany();
    return list.find((p) => p.name.toLowerCase() === (name || '').toLowerCase()) ?? null;
  }

  async create(name: string, isIdcSupplier?: boolean) {
    const existing = await this.findByNameIgnoreCase(name);
    if (existing) throw new ConflictException(`平台已存在（请使用已有名称：${existing.name}）`);
    return this.prisma.platform.create({
      data: { name, isIdcSupplier: isIdcSupplier ?? false },
    });
  }

  async update(id: number, name: string, isIdcSupplier?: boolean) {
    await this.prisma.platform.findUniqueOrThrow({ where: { id } });
    const existing = await this.findByNameIgnoreCase(name);
    if (existing && existing.id !== id) throw new ConflictException(`平台名称已存在（请使用已有名称：${existing.name}）`);
    const data: { name?: string; isIdcSupplier?: boolean } = { name };
    if (isIdcSupplier !== undefined) data.isIdcSupplier = isIdcSupplier;
    return this.prisma.platform.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.prisma.platform.findUniqueOrThrow({ where: { id } });
    return this.prisma.platform.delete({ where: { id } });
  }
}
