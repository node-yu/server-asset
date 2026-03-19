/**
 * 检查每日费用定时任务执行记录
 * 运行: npx ts-node scripts/check-job-logs.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const logs = await prisma.awsDailyCostJobLog.findMany({
    orderBy: { startedAt: 'desc' },
    take: 10,
  });

  console.log('\n=== 每日费用定时任务执行记录（最近 10 条）===\n');
  if (logs.length === 0) {
    console.log('暂无执行记录。');
    console.log('- 定时任务每天 19:30（北京时间）自动运行');
    console.log('- 若刚部署，需等到今日 19:30 后才有记录');
    return;
  }

  const todayLogs = logs.filter((l) => l.startedAt.toISOString().slice(0, 10) === today);
  if (todayLogs.length > 0) {
    console.log(`✓ 今天（${today}）有 ${todayLogs.length} 次执行：\n`);
  } else {
    console.log(`✗ 今天（${today}）暂无执行记录\n`);
  }

  for (const log of logs) {
    const date = log.startedAt.toISOString().slice(0, 10);
    const time = log.startedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const duration = (log.durationMs / 1000).toFixed(1);
    const sync = log.syncCostOk ? '✓' : '-';
    console.log(`  ${date} ${time}  查询 ${log.queryDate}  耗时 ${duration}s  成功 ${log.successCount}/${log.totalCount}  同步 ${sync}`);
  }
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
