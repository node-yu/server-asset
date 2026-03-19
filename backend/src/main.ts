import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './http-exception.filter';

function ensureProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;
  const missing: string[] = [];
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 16) {
    missing.push('ENCRYPTION_KEY（至少 16 字符）');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    missing.push('JWT_SECRET（至少 16 字符）');
  }
  if (!process.env.ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
  if (missing.length) {
    console.error('[Server] 生产环境缺少必要配置:', missing.join('、'));
    process.exit(1);
  }
}

async function bootstrap() {
  ensureProductionEnv();
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((s) => s.trim()) : true,
  });
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`[Server] 后端服务已启动: http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('[Server] 启动失败:', err);
  process.exit(1);
});
