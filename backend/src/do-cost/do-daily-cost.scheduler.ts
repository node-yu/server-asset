import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DoDailyCostService } from './do-daily-cost.service';

@Injectable()
export class DoDailyCostScheduler {
  private readonly logger = new Logger(DoDailyCostScheduler.name);

  constructor(
    private prisma: PrismaService,
    private doDailyCostService: DoDailyCostService,
  ) {}

  /** 每天 19:35 自动查询并保存当天的 MTD 费用（DO 仅提供当月至今累计，按日差量存储） */
  @Cron('35 19 * * *', { timeZone: 'Asia/Shanghai' })
  async runDailyQuery() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);

    const accounts = await this.prisma.doAccount.findMany({
      where: { costQueryEnabled: true },
      select: { id: true, name: true },
      orderBy: { costQuerySortOrder: 'asc' },
    });

    if (accounts.length === 0) {
      this.logger.log(`[DO定时任务] ${dateStr} 无参与查询的账号，跳过`);
      return;
    }

    this.logger.log(`[DO定时任务] 开始查询 ${dateStr} 的 MTD 费用，共 ${accounts.length} 个账号`);

    let success = 0;
    let failed = 0;

    for (const acc of accounts) {
      try {
        await this.doDailyCostService.queryAndSaveOne({
          startDate: dateStr,
          endDate: dateStr,
          accountId: acc.id,
        });
        success++;
        this.logger.log(`[DO定时任务] ${acc.name} 查询成功`);
      } catch (e) {
        failed++;
        this.logger.error(`[DO定时任务] ${acc.name} 查询失败: ${(e as Error).message}`);
      }
    }

    this.logger.log(`[DO定时任务] ${dateStr} 完成: 成功 ${success}，失败 ${failed}`);

    try {
      const now = new Date();
      await this.doDailyCostService.syncMonthlyToCostRegistration({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        accountIds: accounts.map((a) => a.id),
      });
      this.logger.log('[DO定时任务] 已同步本月费用到费用登记');
    } catch (e) {
      this.logger.error(`[DO定时任务] 同步费用登记失败: ${(e as Error).message}`);
    }
  }
}
