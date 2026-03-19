import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LinodeDailyCostService } from './linode-daily-cost.service';

@Injectable()
export class LinodeDailyCostScheduler {
  private readonly logger = new Logger(LinodeDailyCostScheduler.name);

  constructor(
    private prisma: PrismaService,
    private linodeDailyCostService: LinodeDailyCostService,
  ) {}

  /** 每天 19:40 自动查询并保存当天的 MTD 费用（Linode uninvoiced 为当月至今累计） */
  @Cron('40 19 * * *', { timeZone: 'Asia/Shanghai' })
  async runDailyQuery() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);

    const accounts = await this.prisma.linodeAccount.findMany({
      where: { costQueryEnabled: true },
      select: { id: true, name: true },
      orderBy: { costQuerySortOrder: 'asc' },
    });

    if (accounts.length === 0) {
      this.logger.log(`[Linode定时任务] ${dateStr} 无参与查询的账号，跳过`);
      return;
    }

    this.logger.log(`[Linode定时任务] 开始查询 ${dateStr} 的 MTD 费用，共 ${accounts.length} 个账号`);

    let success = 0;
    let failed = 0;

    for (const acc of accounts) {
      try {
        await this.linodeDailyCostService.queryAndSaveOne({
          startDate: dateStr,
          endDate: dateStr,
          accountId: acc.id,
        });
        success++;
        this.logger.log(`[Linode定时任务] ${acc.name} 查询成功`);
      } catch (e) {
        failed++;
        this.logger.error(`[Linode定时任务] ${acc.name} 查询失败: ${(e as Error).message}`);
      }
    }

    this.logger.log(`[Linode定时任务] ${dateStr} 完成: 成功 ${success}，失败 ${failed}`);

    try {
      const now = new Date();
      await this.linodeDailyCostService.syncMonthlyToCostRegistration({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        accountIds: accounts.map((a) => a.id),
      });
      this.logger.log('[Linode定时任务] 已同步本月费用到费用登记');
    } catch (e) {
      this.logger.error(`[Linode定时任务] 同步费用登记失败: ${(e as Error).message}`);
    }
  }
}
