/**
 * 批量格式化服务器配置字段：在核数、内存、磁盘之间添加空格
 * 例如: 28C256GB2x960GBSSD -> 28C 256GB 2x960GBSSD
 *
 * 运行: npx ts-node scripts/format-config-spaces.ts
 * 预览: npx ts-node scripts/format-config-spaces.ts --dry-run
 */
import { PrismaClient } from '@prisma/client';

/**
 * 在配置字符串的核数(C/核)、内存(GB/G)、磁盘之间插入空格
 * 示例: 28C256GB2x960GBSSD -> 28C 256GB 2x960GBSSD
 */
function formatConfig(config: string): string {
  if (!config || typeof config !== 'string') return config;
  let s = config.trim();
  if (!s) return s;

  // 1. 核数(C/c) 与内存之间: 28C256 -> 28C 256, 18c128G -> 18c 128G
  s = s.replace(/([\d.]+[Cc])([\d.]+)(?=G|GB|MB|TB|x|$)/g, '$1 $2');
  // 2. 核数(核) 与内存之间: 2核4 -> 2核 4
  s = s.replace(/([\d.]+核)([\d.]+)(?=G|GB|MB|TB|$)/g, '$1 $2');
  // 3. GB 与磁盘/下一段之间: 256GB2 -> 256GB 2, 256GB2x -> 256GB 2x
  s = s.replace(/([\d.]+GB)([\d.x]+)/g, '$1 $2');
  // 4. G(非GB) 与下一段之间: 8G50 -> 8G 50, 16G1TB -> 16G 1TB
  s = s.replace(/([\d.]+G)(?!B)([\d.]+)(?=G|GB|MB|TB|x|$)/g, '$1 $2');
  // 5. MB 与下一段之间: 512MB1 -> 512MB 1
  s = s.replace(/([\d.]+MB)([\d.]+)/g, '$1 $2');

  return s;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('【预览模式】不会实际修改数据库\n');

  const prisma = new PrismaClient();

  const servers = await prisma.server.findMany({
    where: { config: { not: null } },
    select: { id: true, hostname: true, config: true },
  });

  console.log(`找到 ${servers.length} 台有配置信息的服务器`);
  if (servers.length === 0) {
    console.log('无需处理');
    return;
  }

  let updated = 0;
  for (const s of servers) {
    const original = s.config!;
    const formatted = formatConfig(original);
    if (formatted !== original) {
      if (!dryRun) {
        await prisma.server.update({
          where: { id: s.id },
          data: { config: formatted },
        });
      }
      console.log(`  [${s.hostname}] ${original} -> ${formatted}`);
      updated++;
    }
  }

  console.log(`\n完成: 共 ${updated} 条配置${dryRun ? ' (预览，未写入)' : ' 已更新'}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
