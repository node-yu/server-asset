import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ServerService } from './server.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { BatchUpdateServerDto } from './dto/batch-update-server.dto';
import * as XLSX from 'xlsx';

const TEMPLATE_HEADERS = [
  '平台',
  '主机名',
  'IP',
  '密码',
  '所属项目',
  '状态',
  '用途',
  '关联账号',
  '地区',
  '流量类型',
  '服务器类型',
  '管理者',
  '创建时间',
  '取消时间',
  '每月费用',
  '配置',
  '备注',
];

@Controller('api/servers')
export class ServerController {
  constructor(private readonly serverService: ServerService) {}

  @Get('template')
  async template(@Res() res: Response) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      [
        'OP',
        '示例主机',
        '1.2.3.4',
        'password123',
        '项目A',
        '运行中',
        '会员节点',
        '',
        '香港',
        '按量',
        'VPS',
        '张三',
        '2026-02-01 00:00',
        '',
        '30',
        '2核4G',
        '示例备注',
      ],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, '服务器模板');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=server_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  }

  @Get('export')
  async export(@Res() res: Response) {
    const servers = await this.serverService.findAllForExport();
    const rows = servers.map((s) => [
      s.platform,
      s.hostname,
      s.ip,
      '********',
      s.project,
      s.status,
      s.usage || '',
      s.platformAccount?.accountName || '',
      s.region || '',
      s.bandwidthType || '',
      s.serverType || '',
      s.manager || '',
      s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 16) : '',
      s.cancelAt ? new Date(s.cancelAt).toISOString().slice(0, 16) : '',
      s.monthlyCost,
      s.config || '',
      s.notes || '',
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, '服务器列表');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename=servers_export_${Date.now()}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @UploadedFile() file: { buffer?: Buffer } | undefined,
    @Req() req: Request,
  ) {
    const overwrite = (req.body as { overwrite?: string })?.overwrite === 'true' || (req.body as { overwrite?: string })?.overwrite === '1';
    return this.serverService.importFromExcel(file?.buffer, { overwrite });
  }

  @Post()
  create(@Body() dto: CreateServerDto) {
    return this.serverService.create(dto);
  }

  @Get('duplicate-ips')
  getDuplicateIps() {
    return this.serverService.getDuplicateIps();
  }

  @Get()
  findAll(
    @Query('project') project?: string,
    @Query('platform') platform?: string,
    @Query('platformAccountId') platformAccountId?: string,
    @Query('status') status?: string,
    @Query('usage') usage?: string,
    @Query('search') search?: string,
  ) {
    const accountId = platformAccountId ? parseInt(platformAccountId, 10) : undefined;
    return this.serverService.findAll({ project, platform, platformAccountId: accountId != null && !Number.isNaN(accountId) ? accountId : undefined, status, usage, search });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serverService.findOne(id);
  }

  @Get(':id/password')
  getPassword(@Param('id', ParseIntPipe) id: number) {
    return this.serverService.getDecryptedPassword(id);
  }

  @Put('batch')
  batchUpdate(@Body() dto: BatchUpdateServerDto) {
    const { ids, ...rest } = dto;
    return this.serverService.batchUpdate(ids, rest);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServerDto) {
    return this.serverService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.serverService.remove(id);
  }

  @Get(':id/transfers')
  getTransfers(@Param('id', ParseIntPipe) id: number) {
    return this.serverService.getTransfers(id);
  }

  @Post(':id/transfers')
  addTransfer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { fromProject: string; toProject: string; transferDate: string },
  ) {
    return this.serverService.addTransfer(id, body);
  }

  @Delete(':id/transfers/:transferId')
  removeTransfer(
    @Param('id', ParseIntPipe) id: number,
    @Param('transferId', ParseIntPipe) transferId: number,
  ) {
    return this.serverService.removeTransfer(id, transferId);
  }
}
