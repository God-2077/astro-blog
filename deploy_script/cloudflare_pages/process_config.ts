// 处理 cloudflare pages 环境下的配置

// 删去 config/site.yaml 中的 site.assetsCdn 配置

import { fileURLToPath } from 'node:url';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

function processConfig() {
  // 读取 config/site.yaml 文件
  const configPath = path.join(process.cwd(), 'config/site.yaml');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as any;

  // 删除 site.assetsCdn 配置
  delete config.site.assetsCdn;

  // 写入更新后的 config/site.yaml 文件
  fs.writeFileSync(configPath, yaml.dump(config, { indent: 2 }));
}

export default processConfig;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    processConfig();
  } catch (error) {
    console.error('Error processing config:', error);
  }
}
