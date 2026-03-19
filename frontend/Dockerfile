FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./
# 使用 npm install 替代 npm ci，避免 lock 文件不匹配或权限问题
RUN npm install

COPY frontend/ ./
# 修复可能的权限问题（zip 解压后文件可能无执行权限）
RUN chmod -R 755 . 2>/dev/null || true

# 构建时 API 请求会通过 nginx 代理到 /api
ENV VITE_API_BASE=
# 仅用 vite build，跳过 tsc 类型检查（本地开发可继续用 npm run build 做完整检查）
RUN npx vite build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
