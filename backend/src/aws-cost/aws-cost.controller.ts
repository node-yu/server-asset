import { Controller, Get, Post, Put, Delete, Body, Param, Query, Res, ParseIntPipe, UseInterceptors, UploadedFile } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import * as XLSX from 'xlsx';
import { AwsCostService } from './aws-cost.service';
import { AwsDailyCostService } from './aws-daily-cost.service';
import { CreateAwsCostDto } from './dto/create-aws-cost.dto';
import { UpdateAwsCostDto } from './dto/update-aws-cost.dto';
import { CreateAwsAccountDto } from './dto/create-aws-account.dto';
import { UpdateAwsAccountDto } from './dto/update-aws-account.dto';

const AWS_ACCOUNT_HEADERS = [
  '账号名称',
  '账号ID',
  '账号',
  '密码',
  '供应商',
  '登录方式',
  '账号性质',
  'Access Key ID',
  'Secret Access Key',
  '代理',
  'MFA',
  '备注',
];

@Controller('api/aws-costs')
export class AwsCostController {
  constructor(
    private readonly awsCostService: AwsCostService,
    private readonly awsDailyCostService: AwsDailyCostService,
  ) {}

  @Get('accounts/template')
  async getTemplate(@Res() res: Response) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      AWS_ACCOUNT_HEADERS,
      ['示例账号', '123456789012', 'user@example.com', '', 'AWS', '控制台', '生产', '', '', '', '', ''],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'AWS账号');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=aws_account_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  }

  @Get('accounts/totp-batch')
  getTotpBatch(@Query('ids') idsParam?: string) {
    const ids = (idsParam ?? '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    return this.awsCostService.getTotpBatch(ids);
  }

  @Post('accounts/import')
  @UseInterceptors(FileInterceptor('file'))
  async importAccounts(@UploadedFile() file: { buffer?: Buffer } | undefined) {
    return this.awsCostService.importFromExcel(file?.buffer);
  }

  @Get('accounts')
  getAccounts() {
    return this.awsCostService.getAccounts();
  }

  @Get('accounts/:id/password')
  getAccountPassword(@Param('id', ParseIntPipe) id: number) {
    return this.awsCostService.getAccountPassword(id);
  }

  @Get('accounts/:id/secret-key')
  getAccountSecretKey(@Param('id', ParseIntPipe) id: number) {
    return this.awsCostService.getAccountSecretKey(id);
  }

  @Post('accounts')
  createAccount(@Body() dto: CreateAwsAccountDto) {
    return this.awsCostService.createAccount(dto);
  }

  @Put('accounts/cost-query-order')
  updateCostQueryOrder(@Body() body: { accountIds: number[] }) {
    return this.awsCostService.updateCostQueryOrder(body.accountIds ?? []);
  }

  @Put('accounts/:id')
  updateAccount(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAwsAccountDto) {
    return this.awsCostService.updateAccount(id, dto);
  }

  @Delete('accounts/:id')
  removeAccount(@Param('id', ParseIntPipe) id: number) {
    return this.awsCostService.removeAccount(id);
  }

  @Post('daily/query')
  queryDailyCosts(@Body() body: { startDate: string; endDate: string; accountIds: number[] }) {
    const { startDate, endDate, accountIds } = body;
    if (!startDate || !endDate) throw new Error('请选择日期范围');
    const ids = Array.isArray(accountIds) ? accountIds.filter((n) => Number.isInteger(n) && n > 0) : [];
    if (ids.length === 0) throw new Error('请选择至少一个账号');
    return this.awsDailyCostService.queryAndSave({ startDate, endDate, accountIds: ids });
  }

  @Post('daily/query-one')
  queryDailyCostOne(@Body() body: { startDate: string; endDate: string; accountId: number }) {
    const { startDate, endDate, accountId } = body;
    if (!startDate || !endDate) throw new Error('请选择日期范围');
    if (!Number.isInteger(accountId) || accountId <= 0) throw new Error('无效的账号');
    return this.awsDailyCostService.queryAndSaveOne({ startDate, endDate, accountId });
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
    return this.awsDailyCostService.getMonthTotal({
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
    await this.awsDailyCostService.syncMonthlyToCostRegistration({ year, month, accountIds });
    return { success: true };
  }

  @Get('daily/job-logs')
  getDailyCostJobLogs(
    @Query('page') pageParam?: string,
    @Query('pageSize') pageSizeParam?: string,
  ) {
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
    const pageSize = pageSizeParam ? Math.min(50, Math.max(1, parseInt(pageSizeParam, 10) || 5)) : 5;
    return this.awsCostService.getDailyCostJobLogs({ page, pageSize });
  }

  @Get('daily')
  getDailyCosts(
    @Query('accountIds') accountIdsParam?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const ids = (accountIdsParam ?? '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
    return this.awsDailyCostService.getDailyCosts({
      accountIds: ids.length > 0 ? ids : undefined,
      startDate,
      endDate,
    });
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
    return this.awsCostService.findAll(year, month, accountId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.awsCostService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAwsCostDto, @Query('accountId') accountIdParam?: string) {
    const fromQuery = accountIdParam ? parseInt(accountIdParam, 10) : 0;
    const accountId = (fromQuery > 0 ? fromQuery : dto.accountId) ?? 0;
    return this.awsCostService.create({ ...dto, accountId });
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAwsCostDto) {
    return this.awsCostService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.awsCostService.remove(id);
  }
}
