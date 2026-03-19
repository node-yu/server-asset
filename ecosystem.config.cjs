/**
 * PM2 配置 - 用于非 Docker 部署时启动后端
 * 用法：在项目根目录执行 pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'server-asset-backend',
      cwd: './backend',
      script: 'dist/main.js',
      args: '',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
