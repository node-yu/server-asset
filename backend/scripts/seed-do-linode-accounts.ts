/**
 * 初始化 DO 和 Linode 账号（Token 加密存储）
 *
 * 1. 复制 seed-accounts.config.example.json 为 seed-accounts.config.json
 * 2. 在 seed-accounts.config.json 中填入真实的 name 和 token
 * 3. 确保 .env 中已配置 ENCRYPTION_KEY
 * 4. 运行: npx ts-node -r dotenv/config scripts/seed-do-linode-accounts.ts
 *
 * 或通过环境变量指定配置路径:
 *   SEED_CONFIG=./my-config.json npx ts-node -r dotenv/config scripts/seed-do-linode-accounts.ts
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function encrypt(plainText: string): string {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error('请配置 ENCRYPTION_KEY 环境变量，至少 16 字符');
  }
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

interface AccountEntry {
  name: string;
  token: string;
}

interface SeedConfig {
  do?: AccountEntry[];
  linode?: AccountEntry[];
}

async function main() {
  const configPath =
    process.env.SEED_CONFIG ||
    path.resolve(__dirname, 'seed-accounts.config.json');

  if (!fs.existsSync(configPath)) {
    console.error(`配置文件不存在: ${configPath}`);
    console.error('请复制 seed-accounts.config.example.json 为 seed-accounts.config.json 并填入账号信息');
    process.exit(1);
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  let config: SeedConfig;
  try {
    config = JSON.parse(raw) as SeedConfig;
  } catch (e) {
    console.error('配置文件 JSON 解析失败:', e);
    process.exit(1);
  }

  const prisma = new PrismaClient();

  let doCount = 0;
  let linodeCount = 0;

  if (config.do && Array.isArray(config.do)) {
    for (let i = 0; i < config.do.length; i++) {
      const row = config.do[i];
      const name = (row?.name ?? '').toString().trim();
      const token = (row?.token ?? '').toString().trim();
      if (!name || !token) {
        console.warn(`[DO] 跳过第 ${i + 1} 条: name 或 token 为空`);
        continue;
      }
      const existing = await prisma.doAccount.findUnique({ where: { name } });
      if (existing) {
        console.log(`[DO] 账号已存在: ${name}`);
        continue;
      }
      await prisma.doAccount.create({
        data: {
          name,
          token: encrypt(token),
          costQueryEnabled: true,
          costQuerySortOrder: doCount,
        },
      });
      console.log(`[DO] 已添加: ${name}`);
      doCount++;
    }
  }

  if (config.linode && Array.isArray(config.linode)) {
    for (let i = 0; i < config.linode.length; i++) {
      const row = config.linode[i];
      const name = (row?.name ?? '').toString().trim();
      const token = (row?.token ?? '').toString().trim();
      if (!name || !token) {
        console.warn(`[Linode] 跳过第 ${i + 1} 条: name 或 token 为空`);
        continue;
      }
      const existing = await prisma.linodeAccount.findUnique({ where: { name } });
      if (existing) {
        console.log(`[Linode] 账号已存在: ${name}`);
        continue;
      }
      await prisma.linodeAccount.create({
        data: {
          name,
          token: encrypt(token),
          costQueryEnabled: true,
          costQuerySortOrder: linodeCount,
        },
      });
      console.log(`[Linode] 已添加: ${name}`);
      linodeCount++;
    }
  }

  console.log(`\n完成: DO 新增 ${doCount} 个，Linode 新增 ${linodeCount} 个`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
