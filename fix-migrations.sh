#!/bin/bash
# 修复迁移：仅在 migrate deploy 失败时 resolve
# 上传后执行: sed -i 's/\r$//' fix-migrations.sh && chmod +x fix-migrations.sh && ./fix-migrations.sh

set -e
cd "$(dirname "$0")"

echo "=== 停止 backend ==="
docker compose stop backend 2>/dev/null || true

echo ""
echo "=== 执行 migrate deploy（失败时自动 resolve 并重试）==="
for i in {1..30}; do
  echo "--- 第 $i 次尝试 ---"
  output=$(docker compose run --rm backend npx prisma migrate deploy 2>&1) || true
  echo "$output"
  if echo "$output" | grep -q "No pending migrations"; then
    echo ""
    echo "=== 迁移已完成 ==="
    break
  fi
  if echo "$output" | grep -q "P3018"; then
    migration=$(echo "$output" | grep -oE "[0-9]{14}_[a-z0-9_]+" | head -1)
    if [ -n "$migration" ]; then
      echo ""
      echo ">>> 标记 $migration 为已应用"
      docker compose run --rm backend npx prisma migrate resolve --applied "$migration" || true
    else
      echo "无法解析迁移名，请手动处理"
      exit 1
    fi
  else
    echo "迁移成功或未知错误"
    break
  fi
done

echo ""
echo "=== 启动 backend ==="
docker compose start backend

echo ""
echo "=== 完成！执行 docker compose ps 确认状态 ==="
