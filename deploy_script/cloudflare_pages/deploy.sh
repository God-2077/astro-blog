#!/bin/bash

# chmod +x deploy_script/cloudflare_pages/deploy.sh && ./deploy_script/cloudflare_pages/deploy.sh

# 开启错误终止：任一命令失败则脚本退出
set -e

# 1. 全局安装 pnpm (环境已自带pnpm，直接用)
# echo "===== 全局安装 pnpm ====="
# npm install -g pnpm

# 2. 安装项目依赖
echo "===== 安装项目依赖 ====="
pnpm i

# 3. 执行 TypeScript 配置处理脚本（使用 tsx 执行，无需手动编译）
echo "===== 执行配置处理脚本 ====="
npx tsx deploy_script/cloudflare_pages/process_config.ts

# 4. 构建项目
echo "===== 构建项目 ====="
pnpm run build

echo "===== 部署脚本执行完成 ====="