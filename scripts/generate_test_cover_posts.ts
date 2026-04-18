import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 获取命令行参数
if (process.argv.length !== 3) {
  console.error('Usage: node generate_test_cover_posts.ts {img_dir}');
  process.exit(1);
}

const imgDir = process.argv[2];

// 动态计算项目根目录（脚本所在目录的父目录）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptDir = __dirname;
const projectRoot = path.dirname(scriptDir);

// 文章输出目录
const outputDir = path.join(projectRoot, 'src', 'content', 'blog', 'test-cover');

const imageExtensions = ['.jpg', '.png', '.jpeg', '.webp'];

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 检查图片目录是否存在
if (!fs.existsSync(imgDir)) {
  console.error(`错误: 图片目录 ${imgDir} 不存在`);
  process.exit(1);
}

// 获取目录中的所有文件
const files = fs.readdirSync(imgDir);

files.forEach((filename: string) => {
  // 跳过 meta.json 文件和其他非图片文件
  if (filename.endsWith('-meta.json') || !imageExtensions.some((ext) => filename.toLowerCase().endsWith(ext))) {
    return;
  }

  // 构建完整的文件路径
  const filePath = path.join(imgDir, filename);

  // 获取文件信息
  const fileStats = fs.statSync(filePath);
  const fileSize = fileStats.size;
  const fileExtension = path.extname(filename);

  // 生成文章标题（使用文件名，去掉扩展名）
  const title = path.basename(filename, fileExtension);

  // 生成封面图片路径（相对路径）
  // 计算相对于public目录的路径
  const publicDir = path.join(projectRoot, 'public');
  const relativeImgPath = path.relative(publicDir, filePath);
  const coverPath = '/' + relativeImgPath.replace(/\\/g, '/');

  // 生成文章内容
  const relativePath = path.relative(projectRoot, filePath);
  const now = new Date();
  //   const formattedDate = now.toISOString().slice(0, 19).replace('T', ' ');
  //   本地时间格式
  const formattedDate = now.toLocaleString().replace(/\//g, '-');

  const filePathFull = path.join(projectRoot, filePath);

  const content = `---
title: ${title}
date: ${formattedDate}
cover: ${coverPath}
tags:
  - 测试
  - 图片
categories:
  - 测试
---

# ${title}

## 图片信息

- **文件路径**: [<code class="click-copy">${filePathFull}</code>]
- **相对路径**: [<code class="click-copy">${relativePath}</code>]
- **文件大小**: ${fileSize} 字节
- **文件格式**: ${fileExtension}
- **封面图片**:

![${title}](${coverPath})

<script>
    // 点击复制按钮时触发
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('click-copy')) {
            const code = event.target.textContent;
            const textarea = document.createElement('textarea');
            textarea.value = code;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            // 颜色变化提示复制成功
            event.target.style.backgroundColor = 'lightgreen';
            setTimeout(() => {
                event.target.style.backgroundColor = '';
            }, 1000);
        }
    });
</script>
`;

  // 生成文章文件名（使用标题，替换特殊字符）
  const slug = title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/!/g, '')
    .replace(/～/g, '-')
    .replace(/？/g, '')
    .replace(/！/g, '')
    .replace(/🐰/g, 'rabbit')
    .replace(/🕳️/g, 'hole');

  const postFilename = `${slug}.md`;
  const postPath = path.join(outputDir, postFilename);

  // 写入文章文件
  fs.writeFileSync(postPath, content, 'utf8');

  console.log(`生成文章: ${postFilename}`);
});

console.log('所有测试文章生成完成！');
