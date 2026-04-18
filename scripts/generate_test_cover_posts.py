import os
import json
import sys
from datetime import datetime

# 获取命令行参数作为图片目录路径
if len(sys.argv) != 2:
    print("Usage: python generate_test_cover_posts.py {img_dir}")
    sys.exit(1)

img_dir = sys.argv[1]

# 动态计算项目根目录（脚本所在目录的父目录）
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)

# 文章输出目录
output_dir = os.path.join(project_root, 'src', 'content', 'blog', 'test-cover')

image_extensions = ['.jpg', '.png', '.jpeg', '.webp']

# 确保输出目录存在
os.makedirs(output_dir, exist_ok=True)

# 检查图片目录是否存在
if not os.path.exists(img_dir):
    print(f"错误: 图片目录 {img_dir} 不存在")
    sys.exit(1)

# 遍历目录中的所有文件
for filename in os.listdir(img_dir):
    # 跳过 meta.json 文件和其他非图片文件
    if filename.endswith('-meta.json') or not any(filename.endswith(ext) for ext in image_extensions):
        continue
    
    # 构建完整的文件路径
    file_path = os.path.join(img_dir, filename)
    
    # 获取文件信息
    file_stats = os.stat(file_path)
    file_size = file_stats.st_size
    file_extension = os.path.splitext(filename)[1]
    
    # 生成文章标题（使用文件名，去掉扩展名）
    title = os.path.splitext(filename)[0]
    
    # 生成封面图片路径（相对路径）
    # 计算相对于public目录的路径
    public_dir = os.path.join(project_root, 'public')
    relative_img_path = os.path.relpath(file_path, public_dir)
    cover_path = f'/{relative_img_path.replace(os.sep, "/")}'
    
    # 生成文章内容
    # 计算相对于项目根路径的相对路径
    relative_path = os.path.relpath(file_path, project_root)
    
    content = f"""---
title: {title}
date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
cover: {cover_path}
tags:
  - 测试
  - 图片
categories:
  - 测试
---

# {title}

## 图片信息

- **文件路径**: <code class="click-copy">{file_path}</code>
- **相对路径**: <code class="click-copy">{relative_path}</code>
- **文件大小**: {file_size} 字节
- **文件格式**: {file_extension}
- **封面图片**:

![{title}]({cover_path})


<script>
    // 点击复制按钮时触发
    document.addEventListener('click', function (event) {{
        if (event.target.classList.contains('click-copy')) {{
            const code = event.target.textContent;
            const textarea = document.createElement('textarea');
            textarea.value = code;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            // 颜色变化提示复制成功
            event.target.style.backgroundColor = 'lightgreen';
            setTimeout(() => {{
                event.target.style.backgroundColor = '';
            }}, 1000);
        }}
    }});
</script>
"""
    
    # 生成文章文件名（使用标题，替换特殊字符）
    slug = title.lower().replace(' ', '-').replace('!', '').replace('～', '-').replace('？', '').replace('！', '').replace('🐰', 'rabbit').replace('🕳️', 'hole')
    post_filename = f"{slug}.md"
    post_path = os.path.join(output_dir, post_filename)
    
    # 写入文章文件
    with open(post_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"生成文章: {post_filename}")

print("所有测试文章生成完成！")
