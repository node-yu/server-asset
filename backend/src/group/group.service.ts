import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.group.findMany({
      orderBy: { name: 'asc' },
      include: { projects: { orderBy: { name: 'asc' } } },
    });
  }

  async create(name: string) {
    const existing = await this.prisma.group.findUnique({ where: { name } });
    if (existing) throw new ConflictException('分组已存在');
    return this.prisma.group.create({ data: { name } });
  }

  async update(id: number, name: string) {
    await this.prisma.group.findUniqueOrThrow({ where: { id } });
    const existing = await this.prisma.group.findFirst({ where: { name, NOT: { id } } });
    if (existing) throw new ConflictException('分组名称已存在');
    return this.prisma.group.update({ where: { id }, data: { name } });
  }

  async remove(id: number) {
    await this.prisma.group.findUniqueOrThrow({ where: { id } });
    return this.prisma.group.delete({ where: { id } });
  }
}
