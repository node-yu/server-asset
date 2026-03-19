import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ReminderService, ReminderItem } from './reminder.service';

@Controller('api/reminders')
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Get()
  async getUpcoming(@Query('withinDays') withinDays?: string): Promise<ReminderItem[]> {
    const days = withinDays ? parseInt(withinDays, 10) : 30;
    return this.reminderService.getUpcomingReminders(Number.isNaN(days) ? 30 : Math.min(days, 365));
  }

  @Get('excluded-providers')
  getExcludedProviders() {
    return this.reminderService.getExcludedProviders();
  }

  @Post('excluded-providers')
  addExcludedProvider(@Body() body: { provider: string }) {
    return this.reminderService.addExcludedProvider(body.provider ?? '');
  }

  @Delete('excluded-providers/:provider')
  removeExcludedProvider(@Param('provider') provider: string) {
    return this.reminderService.removeExcludedProvider(decodeURIComponent(provider));
  }

  @Get('renewal-configs')
  getRenewalConfigs() {
    return this.reminderService.getRenewalConfigs();
  }

  @Get('platforms-needing-config')
  getPlatformsNeedingConfig() {
    return this.reminderService.getPlatformsNeedingRenewalConfig();
  }

  @Get('default-renewal-config')
  getDefaultRenewalConfig() {
    return this.reminderService.getDefaultRenewalConfig();
  }

  @Post('default-renewal-config')
  upsertDefaultRenewalConfig(@Body() body: { renewalType: string; dayOfMonth?: number }) {
    return this.reminderService.upsertDefaultRenewalConfig({
      renewalType: (body.renewalType ?? 'calendar_month') as 'calendar_month' | 'day_of_month' | 'cycle_30' | 'cycle_31',
      dayOfMonth: body.dayOfMonth,
    });
  }

  @Post('renewal-configs')
  upsertRenewalConfig(@Body() body: { provider: string; renewalType: string; dayOfMonth?: number }) {
    return this.reminderService.upsertRenewalConfig({
      provider: body.provider ?? '',
      renewalType: (body.renewalType ?? 'calendar_month') as 'calendar_month' | 'day_of_month' | 'cycle_30' | 'cycle_31',
      dayOfMonth: body.dayOfMonth,
    });
  }

  @Delete('renewal-configs/:provider')
  deleteRenewalConfig(@Param('provider') provider: string) {
    return this.reminderService.deleteRenewalConfig(decodeURIComponent(provider));
  }

  @Post('mark-renewed')
  markAsRenewed(@Body() body: { records: { type: string; refId: number; expireAt: string }[] }) {
    return this.reminderService.markAsRenewed(body.records ?? []);
  }

  @Post('custom')
  createCustom(@Body() body: { name: string; expireAt: string; category?: string; notes?: string; linkUrl?: string }) {
    return this.reminderService.createCustomReminder(body);
  }

  @Put('custom/:id')
  updateCustom(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; expireAt?: string; category?: string; notes?: string; linkUrl?: string },
  ) {
    return this.reminderService.updateCustomReminder(id, body);
  }

  @Delete('custom/:id')
  deleteCustom(@Param('id', ParseIntPipe) id: number) {
    return this.reminderService.deleteCustomReminder(id);
  }
}
