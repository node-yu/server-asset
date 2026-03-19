/**
 * 诊断费用统计遗漏：检查指定平台/项目的服务器为何未出现在费用看板
 *
 * 运行: npx ts-node scripts/diagnose-cost-missing.ts [平台名] [项目名] [年] [月]
 * 示例: npx ts-node scripts/diagnose-cost-missing.ts ultahost API 2025 1
 */
import { PrismaClient } from '@prisma/client';

const EXCLUDED_STATUS = ['未使用'];

function wouldBeIncluded(
  createdAt: Date,
  cancelAt: Date | null,
  status: string,
  year: number,
  month: number,
): { included: boolean; reason: string } {
  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  if (EXCLUDED_STATUS.includes(status)) {
    return { included: false, reason: `状态为「${status}」会被排除` };
  }
  if (new Date(createdAt) > endOfMonth) {
    return { included: false, reason: `创建时间 ${createdAt.toISOString().slice(0, 10)} 晚于当月` };
  }
  if (cancelAt && new Date(cancelAt) < startOfMonth) {
    return { included: false, reason: `取消时间 ${new Date(cancelAt).toISOString().slice(0, 10)} 早于当月` };
  }
  return { included: true, reason: '符合统计条件' };
}

async function main() {
  const platformKw = (process.argv[2] || 'ultahost').trim();
  const projectKw = (process.argv[3] || 'API').trim();
  const year = parseInt(process.argv[4] || String(new Date().getFullYear()), 10);
  const month = parseInt(process.argv[5] || '1', 10);

  const prisma = new PrismaClient();

  const allServers = await prisma.server.findMany({
    select: {
      id: true,
      hostname: true,
      platform: true,
      project: true,
      usage: true,
      status: true,
      monthlyCost: true,
      createdAt: true,
      cancelAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  const servers = allServers
    .filter(
      (s) =>
        s.platform.toLowerCase().includes(platformKw.toLowerCase()) &&
        s.project.toLowerCase().includes(projectKw.toLowerCase()),
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  console.log(`\n=== 费用统计遗漏诊断 ===`);
  console.log(`平台关键词: "${platformKw}" | 项目关键词: "${projectKw}" | 统计月份: ${year}年${month}月\n`);
  console.log(`找到 ${servers.length} 台匹配服务器\n`);

  if (servers.length === 0) {
    console.log('未找到匹配服务器。请检查：');
    console.log('  1. 平台名是否准确（如 Ultahost / ultahost）');
    console.log('  2. 项目名是否包含 API');
    return;
  }

  let includedCount = 0;
  let excludedCount = 0;
  let totalCost = 0;

  for (const s of servers) {
    const { included, reason } = wouldBeIncluded(
      s.createdAt,
      s.cancelAt,
      s.status,
      year,
      month,
    );
    if (included) {
      includedCount++;
      const daysInMonth = new Date(year, month, 0).getDate();
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      const effectiveStart = s.createdAt > startOfMonth ? s.createdAt : startOfMonth;
      const effectiveEnd = s.cancelAt && s.cancelAt < endOfMonth ? s.cancelAt : endOfMonth;
      const activeDays = Math.max(
        1,
        Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / 86400000) + 1,
      );
      const cost = s.monthlyCost * (activeDays / daysInMonth);
      totalCost += cost;
    } else {
      excludedCount++;
    }

    const icon = included ? '✓' : '✗';
    const statusColor = EXCLUDED_STATUS.includes(s.status) ? '(排除)' : '';
    console.log(
      `  ${icon} [${s.hostname}] ${s.platform} | ${s.project} | ${s.usage || '-'} | 状态:${s.status}${statusColor}`,
    );
    console.log(
      `     创建: ${s.createdAt.toISOString().slice(0, 10)} | 取消: ${s.cancelAt ? s.cancelAt.toISOString().slice(0, 10) : '无'} | 月费:$${s.monthlyCost}`,
    );
    console.log(`     结果: ${reason}\n`);
  }

  console.log(`--- 汇总 ---`);
  console.log(`  符合统计: ${includedCount} 台，预计 ${year}年${month}月 费用约 $${totalCost.toFixed(2)}`);
  console.log(`  被排除: ${excludedCount} 台`);
  if (excludedCount > 0) {
    console.log(`\n  常见排除原因:`);
    console.log(`  - 状态为「已过期」「已取消」「未使用」→ 修改为「运行中」或「已停止」`);
    console.log(`  - 创建时间晚于当月 → 检查导入时「创建时间」列是否正确`);
    console.log(`  - 取消时间早于当月 → 检查「取消时间」列`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
