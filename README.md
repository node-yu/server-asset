# 服务器资产与财务管理系统

基于 NestJS + Prisma + MySQL + React 的私有化部署方案。

## 功能特性

- **费用统计**：按月份、项目、平台自动汇总固定费用（考虑创建/取消时间）
- **AWS 费用**：手动登记各账号每月账单，按项目归属后计入费用看板
- **服务器 CRUD**：完整的增删改查
- **状态联动**：超过 `cancelAt` 的服务器自动显示为灰色「已过期」
- **密码加密**：敏感字段加密存储，前端点击查看时解密展示

## 快速部署（Docker Compose）

### 1. 环境要求

- Docker
- Docker Compose

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，至少修改：
# - ENCRYPTION_KEY：加密密钥（至少 16 字符）
# - ADMIN_PASSWORD：登录密码（必填）
# - JWT_SECRET：JWT 签名密钥（生产环境建议 32 字符以上）
```

### 3. 启动服务

```bash
docker-compose up -d
```

- 前端：http://localhost
- 后端 API：http://localhost:3000

### 4. 首次运行

首次启动会自动执行数据库迁移。若迁移失败，可进入 backend 容器手动执行：

```bash
docker exec -it server-asset-backend npx prisma migrate deploy
```

## 本地开发（先玩通再部署）

### 第一步：启动 MySQL
#确认 MySQL 服务是否在运行
Get-Service -Name "*mysql*"

#启动mysql
Start-Service MySQL80

用 Docker 只跑一个 MySQL（无需本机安装）：

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 第二步：后端

```bash
cd backend
cp .env.example .env
# .env 已写好本地连接，只需把 ENCRYPTION_KEY 改成你自己的（至少 16 字符）
npm install
npx prisma migrate dev
npm run start:dev
```

看到 `[Server] 后端服务已启动: http://localhost:3000` 即成功。

### 第三步：前端（新开一个终端）

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 http://localhost:5173 ，前端会通过 Vite 代理访问后端 `/api`。

### 第四步：验证

1. 在「服务器列表」点「新增服务器」，填一条测试数据并保存
2. 在「费用看板」查看当月统计
3. 点击密码图标，确认能解密查看

---

## 部署前检查清单

| 项目 | 说明 |
|------|------|
| `.env` 未提交到 Git | 运行 `git status` 确认无 `.env` 文件 |
| `ENCRYPTION_KEY` | 至少 16 字符，生产环境必填 |
| `ADMIN_PASSWORD` | 登录密码，生产环境必填 |
| `JWT_SECRET` | 至少 16 字符，生产环境必填（不要用默认值） |
| `CORS_ORIGIN` | 可选，生产建议填前端域名，如 `https://your-domain.com` |

生产环境启动时会校验上述三项，缺失则直接退出并提示。

## 非 Docker 部署（PM2）

若不用 Docker，可单独部署后端：

```bash
cd backend
cp .env.example .env
# 编辑 .env，配置 MySQL、ENCRYPTION_KEY、ADMIN_PASSWORD、JWT_SECRET
npm install
npx prisma migrate deploy
npm run build
cd ..
pm2 start ecosystem.config.cjs
```

前端需单独构建后由 nginx 托管，nginx 将 `/api` 代理到后端 `http://127.0.0.1:3000`。

---

**生产部署**：玩通后，用根目录的 `docker-compose up -d` 一键部署。

## 目录结构

```
├── backend/           # NestJS 后端
│   ├── prisma/       # Schema 与迁移
│   └── src/
├── frontend/         # React 前端
├── docker-compose.yml
└── .env.example
```

## API 说明

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 登录（body: username, password） |
| GET | /api/stats/monthly?year=&month= | 月度费用统计（需登录） |
| GET | /api/servers | 服务器列表 |
| GET | /api/servers/:id | 服务器详情 |
| GET | /api/servers/:id/password | 解密获取密码 |
| POST | /api/servers | 新增服务器 |
| PUT | /api/servers/:id | 更新服务器 |
| DELETE | /api/servers/:id | 删除服务器 |
