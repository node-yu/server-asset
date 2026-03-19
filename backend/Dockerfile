FROM node:20-alpine AS builder

# Prisma 在 Alpine 上需要 openssl
RUN apk add --no-cache openssl

WORKDIR /app

COPY backend/package*.json ./
RUN npm install

COPY backend/ ./
# 修复 Xftp 上传导致的权限问题，确保 prisma 等可执行
RUN chmod -R 755 . 2>/dev/null || true
RUN chmod -R +x node_modules/.bin 2>/dev/null || true
RUN chmod -R +x node_modules/prisma 2>/dev/null || true

# 构建时需要 DATABASE_URL，使用占位符
ENV DATABASE_URL="mysql://user:pass@localhost:3306/db"

RUN npx prisma generate
RUN npm run build

# 生产阶段（Prisma 需要 openssl）
FROM node:20-alpine
RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY backend/prisma ./prisma/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
