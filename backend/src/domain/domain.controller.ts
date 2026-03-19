import { Controller, Get, Post, Put, Body, Query, Param, ParseIntPipe } from '@nestjs/common';
import { DomainService, UnifiedDomain } from './domain.service';

@Controller('api/domains')
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  @Get('config')
  getConfig() {
    return this.domainService.getSyncConfig();
  }

  @Put('config')
  updateConfig(@Body() body: { syncIntervalDays: number }) {
    return this.domainService.updateSyncConfig(body.syncIntervalDays ?? 7);
  }

  @Get()
  async getAll(@Query('forceSync') forceSync?: string): Promise<UnifiedDomain[]> {
    return this.domainService.getAllDomains(forceSync === 'true');
  }

  @Post('sync')
  async forceSync(@Query('platform') platform?: string) {
    const p = platform === 'porkbun' || platform === 'namecheap' || platform === 'godaddy' ? platform : 'all';
    return this.domainService.syncFromApi(p);
  }

  @Post('fill-missing-prices')
  async fillMissingPrices() {
    return this.domainService.fillMissingRenewalPrices();
  }

  @Get('summary')
  async getSummary(
    @Query('provider') provider?: string,
    @Query('status') status?: string,
    @Query('domain') domain?: string,
  ) {
    return this.domainService.getDomainSummaryStats(
      provider || status || domain ? { provider, status, domain } : undefined,
    );
  }

  @Get('godaddy-debug')
  async godaddyDebug() {
    return this.domainService.getGoDaddyDebug();
  }

  @Get('namecheap-debug')
  async namecheapDebug() {
    return this.domainService.getNamecheapDebug();
  }

  @Put('auto-renew')
  async setAutoRenew(
    @Body() body: { domain: string; provider: string; enabled: boolean },
  ) {
    return this.domainService.setAutoRenew(
      body.domain,
      body.provider,
      body.enabled,
    );
  }

  @Put(':id')
  async updateDomain(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { project?: string; usage?: string },
  ) {
    return this.domainService.updateDomain(id, body.project, body.usage);
  }

  @Get(':id/history')
  async getDomainHistory(@Param('id', ParseIntPipe) id: number) {
    return this.domainService.getDomainHistory(id);
  }
}
