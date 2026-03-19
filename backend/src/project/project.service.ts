import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.project.findMany({
      orderBy: [{ group: { name: 'asc' } }, { name: 'asc' }],
      include: { group: { select: { id: true, name: true } } },
    });
  }

  async create(groupId: number, name: string, color?: string) {
    await this.prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    const existing = await this.prisma.project.findFirst({ where: { groupId, name } });
    if (existing) throw new ConflictException('该分组下项目名称已存在');
    return this.prisma.project.create({ data: { groupId, name, color: color || null } });
  }

  async update(id: number, name: string, color?: string) {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id } });
    const existing = await this.prisma.project.findFirst({
      where: { groupId: project.groupId, name, NOT: { id } },
    });
    if (existing) throw new ConflictException('该分组下项目名称已存在');
    const data: { name: string; color?: string | null } = { name };
    if (color !== undefined) data.color = color || null;
    return this.prisma.project.update({ where: { id }, data });
  }

  async move(id: number, targetGroupId: number) {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id } });
    await this.prisma.group.findUniqueOrThrow({ where: { id: targetGroupId } });
    const existing = await this.prisma.project.findFirst({
      where: { groupId: targetGroupId, name: project.name },
    });
    if (existing) throw new ConflictException('目标分组下已存在同名项目');
    return this.prisma.project.update({
      where: { id },
      data: { groupId: targetGroupId },
      include: { group: { select: { id: true, name: true } } },
    });
  }

  async remove(id: number) {
    await this.prisma.project.findUniqueOrThrow({ where: { id } });
    return this.prisma.project.delete({ where: { id } });
  }
}
