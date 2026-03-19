/**
 * 清理重复的平台账号（Excel 下拉导致的累加账号，如 satterfieldvicky58, 59, 60...）
 * 保留 satterfieldvicky57@gmail.com，删除其余并将关联服务器迁移到正确账号
 *
 * 运行: npx ts-node scripts/cleanup-duplicate-accounts.ts
 */
import { PrismaClient } from '@prisma/client';

const KEEP_ACCOUNT = 'satterfieldvicky57@gmail.com';

async function main() {
  const prisma = new PrismaClient();

  const allMatches = await prisma.platformAccount.findMany({
    where: {
      accountName: {
        contains: 'satterfieldvicky',
        endsWith: '@gmail.com',
      },
    },
    include: { platform: true, servers: true },
  });

  const toKeep = allMatches.find((a) => a.accountName === KEEP_ACCOUNT);
  const toDelete = allMatches.filter((a) => a.accountName !== KEEP_ACCOUNT);

  if (!toKeep) {
    console.log(`未找到要保留的账号: ${KEEP_ACCOUNT}`);
    console.log('当前匹配的账号:', allMatches.map((a) => a.accountName).join(', '));
    return;
  }

  if (toDelete.length === 0) {
    console.log('没有需要删除的重复账号');
    return;
  }

  console.log(`保留账号: ${toKeep.accountName} (id=${toKeep.id})`);
  console.log(`待删除的重复账号 (${toDelete.length} 个):`);
  toDelete.forEach((a) => console.log(`  - ${a.accountName} (id=${a.id}, 关联服务器: ${a.servers.length})`));

  for (const acc of toDelete) {
    if (acc.servers.length > 0) {
      if (acc.platformId !== toKeep.platformId) {
        console.warn(`  跳过 ${acc.accountName}: 与保留账号不在同一平台，请手动处理`);
        continue;
      }
      await prisma.server.updateMany({
        where: { platformAccountId: acc.id },
        data: { platformAccountId: toKeep.id },
      });
      console.log(`  已将 ${acc.servers.length} 台服务器从 ${acc.accountName} 迁移到 ${KEEP_ACCOUNT}`);
    }
    await prisma.platformAccount.delete({ where: { id: acc.id } });
    console.log(`  已删除: ${acc.accountName}`);
  }

  console.log('清理完成');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
