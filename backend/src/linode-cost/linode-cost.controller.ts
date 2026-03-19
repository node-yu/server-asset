import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LinodeCostService } from './linode-cost.service';
import { LinodeDailyCostService } from './linode-daily-cost.service';

@Controller('api/linode-costs')
export class LinodeCostController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly linodeCostService: LinodeCostService,
    private readonly linodeDailyCostService: LinodeDailyCostService,
  ) {}

  @Get('accounts')
  getAccounts() {
    return this.linodeCostService.getAccounts();
  }

  @Post('accounts')
  createAccount(@Body() body: { name: string; token: string; notes?: string }) {
    if (!body?.name?.trim()) throw new Error('账号名称必填');
    if (!body?.token?.trim()) throw new Error('Token 必填');
    return this.linodeCostService.createAccount({
      name: body.name.trim(),
      token: body.token.trim(),
      notes: body.notes?.trim(),
    });
  }

  @Put('accounts/cost-query-order')
  updateCostQueryOrder(@Body() body: { accountIds: number[] }) {
    return this.linodeCostService.updateCostQueryOrder(body.accountIds ?? []);
  }

  @Put('accounts/:id')
  updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: {
      name?: string;
      token?: string;
      notes?: string;
      costQueryEnabled?: boolean;
      costQuerySortOrder?: number;
    },
  ) {
    return this.linodeCostService.updateAccount(id, body);
  }

  @Delete('accounts/:id')
  removeAccount(@Param('id', ParseIntPipe) id: number) {
    return this.linodeCostService.deleteAccount(id);
  }

  @Post('daily/query')
  async queryDailyCosts(@Body() body: { startDate: string; endDate: string; accountIds?: number[] }) {
    const { startDate, endDate, accountIds } = body;
    if (!startDate || !endDate) throw new Error('请选择日期范围');
    let ids = Array.isArray(accountIds) ? accountIds.filter((n) => Number.isInteger(n) && n > 0) : [];
    if (ids.length === 0) {
      const accounts = await this.prisma.linodeAccount.findMany({
        where: { costQueryEnabled: true },
        select: { id: true },
        orderBy: { costQuerySortOrder: 'asc' },
      });
      ids = accounts.map((a) => a.id);
    }
    if (ids.length === 0) throw new Error('请先添加账号并启用费用查询');
    return Promise.all(
      ids.map((accountId) =>
        this.linodeDailyCostService.queryAndSaveOne({ startDate, endDate, accountId }),
      ),
    );
  }

  @Get('daily/month-total')
  getMonthTotal(
    @Query('year') yearParam?: string,
    @Query('month') monthParam?: string,
    @Query('accountIds') accountIdsParam?: string,
  ) {
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : new Date().getMonth() + 1;
    const ids = (accountIdsParam ?? '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
    return this.linodeDailyCostService.getMonthTotal({
      year,
      month,
      accountIds: ids.length > 0 ? ids : undefined,
    });
  }

  @Post('daily/sync-to-cost')
  async syncDailyToCost(@Body() body?: { year?: number; month?: number; accountIds?: number[] }) {
    const now = new Date();
    const year = body?.year ?? now.getFullYear();
    const month = body?.month ?? now.getMonth() + 1;
    const accountIds = Array.isArray(body?.accountIds) ? body.accountIds : undefined;
    await this.linodeDailyCostService.syncMonthlyToCostRegistration({ year, month, accountIds });
    return { success: true };
  }

  @Get()
  findAll(
    @Query('year') yearParam?: string,
    @Query('month') monthParam?: string,
    @Query('accountId') accountIdParam?: string,
  ) {
    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    const month = monthParam ? parseInt(monthParam, 10) : undefined;
    const accountId = accountIdParam ? parseInt(accountIdParam, 10) : undefined;
    return this.linodeCostService.getCosts(year, month, accountId);
  }

  @Post()
  createCost(@Body() body: { year: number; month: number; accountId: number; project?: string; usage?: string; amount: number }) {
    return this.linodeCostService.createCost(body);
  }

  @Put(':id')
  updateCost(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { project?: string; usage?: string; amount?: number },
  ) {
    return this.linodeCostService.updateCost(id, body);
  }

  @Delete(':id')
  deleteCost(@Param('id', ParseIntPipe) id: number) {
    return this.linodeCostService.deleteCost(id);
  }
}
