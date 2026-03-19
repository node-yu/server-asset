import { Controller, Get, Post, Body, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('api/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('monthly')
  getMonthlyStats(
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
  ) {
    return this.statsService.getMonthlyStats(year, month);
  }

  @Get('cost-breakdown')
  getCostBreakdown(
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
    @Query('groupIds') groupIdsParam?: string | string[],
  ) {
    let groupIds: number[] | undefined;
    if (groupIdsParam != null) {
      const raw = Array.isArray(groupIdsParam) ? groupIdsParam.join(',') : String(groupIdsParam);
      groupIds = raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
    }
    return this.statsService.getCostBreakdown(year, month, groupIds?.length ? groupIds : undefined);
  }

  @Post('save-snapshot')
  saveSnapshot(
    @Body() dto: { year: number; month: number; items: { project: string; platform: string; usage: string; quantity: number; cost: number }[] },
  ) {
    return this.statsService.saveSnapshot(dto.year, dto.month, dto.items);
  }

  @Get('multi-month')
  getMultiMonthStats(
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
    @Query('count', new DefaultValuePipe(6), ParseIntPipe) count: number,
  ) {
    return this.statsService.getMultiMonthStats(year, month, Math.min(Math.max(count, 1), 24));
  }

  @Post('idc-region-cost')
  saveIdcRegionCost(
    @Body() dto: { year: number; month: number; platform: string; region: string; project: string; cost: number },
  ) {
    return this.statsService.saveIdcRegionCost(
      dto.year,
      dto.month,
      dto.platform ?? '',
      dto.region ?? '',
      dto.project ?? '',
      dto.cost ?? 0,
    );
  }

  @Post('idc-region-cost/delete')
  deleteIdcRegionCost(
    @Body() dto: { year: number; month: number; platform: string; region: string; project: string },
  ) {
    return this.statsService.deleteIdcRegionCost(
      dto.year,
      dto.month,
      dto.platform ?? '',
      dto.region ?? '',
      dto.project ?? '',
    );
  }
}
