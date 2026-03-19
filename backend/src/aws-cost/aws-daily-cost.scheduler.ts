import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AwsDailyCostService } from './aws-daily-cost.service';
import { NotificationService, type SignificantChangeItem } from '../notification/notification.service';

const CHANGE_THRESHOLD_USD = 50;
const CHANGE_THRESHOLD_PCT = 50;

@Injectable()
export class AwsDailyCostScheduler {
  private readonly logger = new Logger(AwsDailyCostScheduler.name);

  constructor(
    private prisma: PrismaService,
    private awsDailyCostService: AwsDailyCostService,
    private notification: NotificationService,
  ) {}

  /** 每天 19:30 自动查询并保存前一天的每日费用（按 costQuerySortOrder 顺序） */
  @Cron('30 19 * * *', { timeZone: 'Asia/Shanghai' })
  async runDailyQuery() {
    const startedAt = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);

    const prevDay = new Date(yesterday);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDateStr = prevDay.toISOString().slice(0, 10);

    const accounts = await this.prisma.awsAccount.findMany({
      where: { costQueryEnabled: true },
      select: { id: true, name: true },
      orderBy: { costQuerySortOrder: 'asc' },
    });

    if (accounts.length === 0) {
      this.logger.log(`[定时任务] ${dateStr} 无参与查询的账号，跳过`);
      const finishedAt = new Date();
      await this.prisma.awsDailyCostJobLog.create({
        data: {
          startedAt,
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          queryDate: dateStr,
          totalCount: 0,
          successCount: 0,
          failedCount: 0,
          syncCostOk: false,
        },
      });
      return;
    }

    this.logger.log(`[定时任务] 开始查询 ${dateStr} 的每日费用，共 ${accounts.length} 个账号`);

    let success = 0;
    let failed = 0;
    const failedAccounts: { name: string; error: string }[] = [];

    for (const acc of accounts) {
      try {
        await this.awsDailyCostService.queryAndSaveOne({
          startDate: dateStr,
          endDate: dateStr,
          accountId: acc.id,
        });
        success++;
        this.logger.log(`[定时任务] ${acc.name} 查询成功`);
      } catch (e) {
        failed++;
        const errMsg = (e as Error).message;
        failedAccounts.push({ name: acc.name, error: errMsg });
        this.logger.error(`[定时任务] ${acc.name} 查询失败: ${errMsg}`);
      }
    }

    this.logger.log(`[定时任务] ${dateStr} 完成: 成功 ${success}，失败 ${failed}`);

    let syncCostOk = false;
    try {
      const now = new Date();
      await this.awsDailyCostService.syncMonthlyToCostRegistration({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        accountIds: accounts.map((a) => a.id),
      });
      syncCostOk = true;
      this.logger.log('[定时任务] 已同步本月费用到费用登记');
    } catch (e) {
      this.logger.error(`[定时任务] 同步费用登记失败: ${(e as Error).message}`);
    }

    const significantChanges: SignificantChangeItem[] = [];
    for (const acc of accounts) {
      if (failedAccounts.some((f) => f.name === acc.name)) continue;
      const [curr, prev] = await Promise.all([
        this.prisma.awsDailyCost.findUnique({
          where: { accountId_date: { accountId: acc.id, date: new Date(dateStr) } },
          select: { amount: true },
        }),
        this.prisma.awsDailyCost.findUnique({
          where: { accountId_date: { accountId: acc.id, date: new Date(prevDateStr) } },
          select: { amount: true },
        }),
      ]);
      const currAmount = curr?.amount ?? 0;
      const prevAmount = prev?.amount ?? 0;
      if (prevAmount <= 0) continue;
      const changeUsd = currAmount - prevAmount;
      const changePct = (changeUsd / prevAmount) * 100;
      if (Math.abs(changeUsd) >= CHANGE_THRESHOLD_USD && Math.abs(changePct) >= CHANGE_THRESHOLD_PCT) {
        significantChanges.push({
          accountName: acc.name,
          prevAmount,
          currAmount,
          changeUsd,
          changePct,
        });
      }
    }

    await this.notification.sendDailyCostNotify({
      date: dateStr,
      totalAccounts: accounts.length,
      success,
      failed,
      failedAccounts: failedAccounts.length > 0 ? failedAccounts : undefined,
      significantChanges: significantChanges.length > 0 ? significantChanges : undefined,
    });

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    await this.prisma.awsDailyCostJobLog.create({
      data: {
        startedAt,
        finishedAt,
        durationMs,
        queryDate: dateStr,
        totalCount: accounts.length,
        successCount: success,
        failedCount: failed,
        syncCostOk,
      },
    });
    this.logger.log(`[定时任务] 执行记录已保存: ${startedAt.toLocaleString('zh-CN')}，耗时 ${(durationMs / 1000).toFixed(1)} 秒`);
  }
}
