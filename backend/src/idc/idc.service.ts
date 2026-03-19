import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIdcDto } from './dto/create-idc.dto';
import { UpdateIdcDto } from './dto/update-idc.dto';
import { AddAdjustmentDto } from './dto/add-adjustment.dto';

@Injectable()
export class IdcService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.iDCRegistration.findMany({
      include: {
        platformAccount: {
          include: { platform: { select: { name: true } } },
        },
      },
      orderBy: [
        { platformAccount: { platform: { name: 'asc' } } },
        { platformAccount: { accountName: 'asc' } },
        { region: 'asc' },
      ],
    });
  }

  async findOne(id: number) {
    const reg = await this.prisma.iDCRegistration.findUnique({
      where: { id },
      include: {
        platformAccount: {
          include: { platform: { select: { name: true } } },
        },
        adjustments: { orderBy: { adjustmentDate: 'desc' } },
      },
    });
    if (!reg) throw new NotFoundException('IDC 登记不存在');
    return reg;
  }

  async create(dto: CreateIdcDto) {
    return this.prisma.iDCRegistration.create({
      data: {
        platformAccountId: dto.platformAccountId,
        region: dto.region,
        config: dto.config,
        serverCount: dto.serverCount,
        bandwidth: dto.bandwidth,
        configCost: dto.configCost,
        bandwidthCost: dto.bandwidthCost,
        notes: dto.notes,
      },
      include: {
        platformAccount: {
          include: { platform: { select: { name: true } } },
        },
      },
    });
  }

  async update(id: number, dto: UpdateIdcDto) {
    await this.findOne(id);
    return this.prisma.iDCRegistration.update({
      where: { id },
      data: dto,
      include: {
        platformAccount: {
          include: { platform: { select: { name: true } } },
        },
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.iDCRegistration.delete({ where: { id } });
  }

  async addAdjustment(id: number, dto: AddAdjustmentDto) {
    const reg = await this.findOne(id);
    const adjustmentDate = new Date(dto.adjustmentDate);
    await this.prisma.iDCAdjustment.create({
      data: {
        idcRegistrationId: id,
        adjustmentDate,
        serverCountDelta: dto.serverCountDelta,
        bandwidthDelta: dto.bandwidthDelta,
        note: dto.note,
      },
    });
    const newServerCount = reg.serverCount + dto.serverCountDelta;
    const newBandwidth = reg.bandwidth + dto.bandwidthDelta;
    await this.prisma.iDCRegistration.update({
      where: { id },
      data: {
        serverCount: Math.max(0, newServerCount),
        bandwidth: Math.max(0, newBandwidth),
      },
    });
    return this.findOne(id);
  }

  async getAdjustments(id: number) {
    await this.findOne(id);
    return this.prisma.iDCAdjustment.findMany({
      where: { idcRegistrationId: id },
      orderBy: { adjustmentDate: 'desc' },
    });
  }
}
