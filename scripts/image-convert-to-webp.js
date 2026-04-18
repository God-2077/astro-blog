import { program } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

// 获取当前模块的路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 支持的图片格式（可根据需要扩展）
const SUPPORTED_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'];

// 配置命令行参数
program
  .name('image-convert-to-webp')
  .description('基于 sharp 的图片批量转换为 Webp 格式的 CLI 工具')
  .version('1.0.0')
  .requiredOption('-i, --input <dir>', '输入目录（必填），例如：./images')
  .requiredOption('-o, --output <dir>', '输出目录（必填），例如：./output')
  .option('-q, --quality <number>', 'WebP 质量（0-100）', '75')
  .option('-e, --ext <extensions>', '支持的文件扩展名，逗号分隔', SUPPORTED_FORMATS.join(','))
  .option('-r, --recursive', '递归搜索子目录', true)
  .option('-n, --nearLossless', '启用近无损压缩', false)
  .option('-d, --debug', '启用调试模式')
  .parse(process.argv);

// 获取命令行参数
const options = program.opts();
let inputDir = options.input;
let outputDir = options.output;
const quality = parseInt(options.quality, 10);
const debug = options.debug || false;
const recursive = options.recursive;
const nearLossless = options.nearLossless;
let supportedFormats = SUPPORTED_FORMATS;

// 处理自定义扩展名
if (options.ext) {
  supportedFormats = options.ext.split(',').map((ext) => ext.trim().toLowerCase());
  if (debug) {
    console.log(`🔧 使用自定义扩展名: ${supportedFormats.join(', ')}`);
  }
}

// 解析为绝对路径
if (!path.isAbsolute(inputDir)) {
  inputDir = path.resolve(process.cwd(), inputDir);
}
if (!path.isAbsolute(outputDir)) {
  outputDir = path.resolve(process.cwd(), outputDir);
}

if (debug) {
  console.log(`🔧 调试模式已启用`);
  console.log(`🔧 当前工作目录: ${process.cwd()}`);
  console.log(`🔧 输入目录: ${inputDir}`);
  console.log(`🔧 输出目录: ${outputDir}`);
  console.log(`🔧 图片质量: ${quality}`);
  console.log(`🔧 递归搜索: ${recursive}`);
  console.log(`🔧 支持的文件格式: ${supportedFormats.join(', ')}`);
}

// 验证质量参数
if (isNaN(quality) || quality < 0 || quality > 100) {
  console.error('❌ 错误：质量参数必须是 0-100 之间的数字');
  process.exit(1);
}

/**
 * 检查目录是否存在，不存在则创建
 * @param {string} dir 目录路径
 */
async function ensureDirExists(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
    if (debug) {
      console.log(`📁 创建目录：${dir}`);
    }
  }
}

/**
 * 递归列出目录中的所有文件
 * @param {string} dir 目录路径
 * @returns {Promise<string[]>} 文件路径数组
 */
async function listAllFiles(dir) {
  const files = [];

  async function scanDirectory(currentDir) {
    try {
      const items = await fs.readdir(currentDir, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(currentDir, item.name);

        if (item.isDirectory() && recursive) {
          await scanDirectory(itemPath);
        } else if (item.isFile()) {
          files.push(itemPath);
        }
      }
    } catch (error) {
      console.error(`❌ 无法读取目录 ${currentDir}:`, error.message);
    }
  }

  await scanDirectory(dir);
  return files;
}

/**
 * 检查文件是否为支持的图片格式
 * @param {string} filePath 文件路径
 * @returns {boolean} 是否为支持的格式
 */
function isSupportedImage(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  return supportedFormats.includes(ext);
}

/**
 * 转换单张图片
 * @param {string} filePath 源文件路径
 */
async function convertImage(filePath) {
  try {
    // 1. 计算相对路径（保持原目录结构）
    const relativePath = path.relative(inputDir, filePath);
    const outputFilePath = path.join(outputDir, relativePath);
    // 2. 替换文件后缀为 .webp
    const outputWebpPath = outputFilePath.replace(path.extname(outputFilePath), '.webp');
    // 3. 确保输出目录存在
    await ensureDirExists(path.dirname(outputWebpPath));

    // 4. 使用 sharp 转换图片
    await sharp(filePath)
      .webp({
        quality: quality,
        method: 4,
        sns: 50,
        filterStrength: 60,
        filterSharpness: 0,
        alphaQuality: 100,
        nearLossless: nearLossless,
      })
      .toFile(outputWebpPath);

    console.log(`✅ 转换成功：${path.relative(process.cwd(), filePath)} -> ${path.relative(process.cwd(), outputWebpPath)}`);
  } catch (error) {
    console.error(`❌ 转换失败：${filePath}`, error.message);
  }
}

/**
 * 批量转换目录下的所有图片
 */
async function batchConvert() {
  try {
    // 1. 检查输入目录是否存在
    try {
      await fs.access(inputDir);
      if (debug) {
        console.log(`✅ 输入目录存在: ${inputDir}`);
      }
    } catch (error) {
      console.error(`❌ 错误：输入目录不存在 -> ${inputDir}`);
      console.log(`💡 提示：当前目录是 ${process.cwd()}`);
      console.log(`💡 尝试使用绝对路径或检查路径是否正确`);
      process.exit(1);
    }

    // 2. 确保输出目录存在
    await ensureDirExists(outputDir);

    // 3. 获取目录统计信息
    if (debug) {
      try {
        const stat = await fs.stat(inputDir);
        console.log(`📊 输入目录统计:`);
        console.log(`  路径: ${inputDir}`);
        console.log(`  类型: ${stat.isDirectory() ? '目录' : '文件'}`);
        console.log(`  大小: ${stat.size} 字节`);
        console.log(`  修改时间: ${stat.mtime}`);
      } catch (err) {
        console.log(`⚠️ 无法获取目录统计: ${err.message}`);
      }
    }

    // 4. 列出目录中的所有文件
    if (debug) {
      console.log(`🔍 开始搜索图片文件...`);
    }

    const allFiles = await listAllFiles(inputDir);

    if (debug) {
      console.log(`📁 找到 ${allFiles.length} 个文件（包括非图片）`);
      if (allFiles.length > 0 && allFiles.length <= 10) {
        console.log(`📄 文件列表:`);
        allFiles.forEach((file) => {
          const relPath = path.relative(inputDir, file);
          console.log(`  - ${relPath}`);
        });
      } else if (allFiles.length > 10) {
        console.log(`📄 显示前10个文件:`);
        allFiles.slice(0, 10).forEach((file) => {
          const relPath = path.relative(inputDir, file);
          console.log(`  - ${relPath}`);
        });
        console.log(`  ... 还有 ${allFiles.length - 10} 个文件`);
      }
    }

    // 5. 过滤出支持的图片文件
    const imageFiles = allFiles.filter((file) => isSupportedImage(file));

    if (debug) {
      console.log(`🖼️  找到 ${imageFiles.length} 个支持的图片文件`);
      if (imageFiles.length > 0) {
        console.log(`🖼️  图片文件列表:`);
        imageFiles.forEach((file) => {
          const relPath = path.relative(inputDir, file);
          console.log(`  - ${relPath}`);
        });
      }
    }

    if (imageFiles.length === 0) {
      console.log('❌ 错误：输入目录下未找到支持的图片文件');
      console.log('💡 支持的格式:', supportedFormats.join(', '));
      console.log('💡 检查事项:');
      console.log('   1. 确保目录路径正确');
      console.log('   2. 确保目录中包含图片文件');
      console.log('   3. 检查图片文件扩展名是否正确');
      console.log('   4. 使用 -d 参数启用调试模式查看更多信息');
      console.log('   5. 使用 -e 参数指定自定义扩展名，例如: -e "jpg,png"');

      // 列出目录中的文件类型统计
      if (allFiles.length > 0) {
        const extStats = {};
        allFiles.forEach((file) => {
          const ext = path.extname(file).toLowerCase() || '无扩展名';
          extStats[ext] = (extStats[ext] || 0) + 1;
        });

        console.log('\n📊 目录中文件类型统计:');
        Object.entries(extStats).forEach(([ext, count]) => {
          console.log(`   ${ext}: ${count} 个`);
        });
      }

      return;
    }

    console.log(`🎯 找到 ${imageFiles.length} 张图片，开始转换...`);

    // 6. 批量转换（串行执行，避免占用过多内存）
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      if (debug) {
        console.log(`🔄 处理第 ${i + 1}/${imageFiles.length} 张: ${path.basename(file)}`);
      }
      try {
        await convertImage(file);
        successCount++;
      } catch (error) {
        failCount++;
        console.error(`❌ 处理失败: ${file}`, error.message);
      }
    }

    console.log(`\n🎉 图片转换完成！`);
    console.log(`✅ 成功: ${successCount} 张`);
    if (failCount > 0) {
      console.log(`❌ 失败: ${failCount} 张`);
    }
  } catch (error) {
    console.error('❌ 批量转换失败：', error.message);
    if (debug) {
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  }
}

// 启动批量转换
batchConvert();
