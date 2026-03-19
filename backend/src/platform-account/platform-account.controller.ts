import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { PlatformAccountService } from './platform-account.service';

@Controller('api/platform-accounts')
export class PlatformAccountController {
  constructor(private readonly service: PlatformAccountService) {}

  @Get()
  findAll(
    @Query('platformId') platformId?: string,
    @Query('idcOnly') idcOnlyParam?: string,
  ) {
    const idcOnly = idcOnlyParam === 'true' || idcOnlyParam === '1';
    return this.service.findAll(
      platformId ? parseInt(platformId) : undefined,
      idcOnly,
    );
  }

  @Get('stats')
  getStats() {
    return this.service.getStatsByPlatform();
  }

  @Post()
  create(@Body() dto: { platformId: number; accountName: string; password: string; notes?: string }) {
    return this.service.create(dto.platformId, dto.accountName, dto.password, dto.notes);
  }

  @Get(':id/password')
  getPassword(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPassword(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { accountName?: string; password?: string; notes?: string },
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
