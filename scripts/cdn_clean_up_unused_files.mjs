#!/usr/bin/env node

// /scripts/cdn_clean_up_unused_files.mjs
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

// 获取当前工作目录
const cwd = process.cwd();

// 保留的文件或目录
const keep = new Set([
    '.github',
    '.git',
    '_astro',
    'img',
    'fonts',
    'katex',
    'pagefind'
]);

// 删除所有未保留的文件或目录
console.log(`Cleaning up unused files in ${cwd}`);
for (const name of await readdir(cwd)) {
    const fullPath = join(cwd, name);
    if (!keep.has(name)) {
        console.log(`Deleting: ${fullPath}`);
        await rm(fullPath, { recursive: true, force: true });
    } else {
        console.log(`Keeping: ${fullPath}`);
    }
}
console.log(`Cleaning up unused files in ${cwd} done`);
process.exit(0);
