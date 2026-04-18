import os
import sys
import shutil
from pathlib import Path, PureWindowsPath, PurePosixPath

def copy_and_rename_files(list_file, target_dir):
    """
    从list.md文件中读取文件路径，复制并重命名文件到目标目录
    
    Args:
        list_file: 包含文件路径列表的文本文件
        target_dir: 目标目录路径
    """
    
    # 检查参数
    if not os.path.exists(list_file):
        print(f"错误: 列表文件 '{list_file}' 不存在")
        return
    
    # 创建目标目录（如果不存在）
    target_dir = Path(target_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    
    # 读取文件列表
    with open(list_file, 'r', encoding='utf-8') as f:
        file_paths = [line.strip() for line in f if line.strip()]
    
    if not file_paths:
        print("警告: 列表文件中没有找到文件路径")
        return
    
    print(f"找到 {len(file_paths)} 个文件")
    
    # 计数器
    count = 0
    copied_files = []
    
    for original_path in file_paths:
        # 处理Windows路径（将反斜杠转换为正斜杠）
        if '\\' in original_path:
            # Windows路径，转换为Path对象
            src_path = Path(PureWindowsPath(original_path))
        else:
            # Linux/Mac路径
            src_path = Path(original_path)
        
        # 检查源文件是否存在
        if not src_path.exists():
            print(f"警告: 文件不存在，跳过: {original_path}")
            continue
        
        # 获取文件扩展名
        ext = src_path.suffix
        if not ext:
            ext = ''  # 无扩展名文件
        
        # 生成新文件名（从1开始）
        new_filename = f"{count + 1}{ext}"
        dst_path = target_dir / new_filename
        
        try:
            # 复制文件
            shutil.copy2(str(src_path), str(dst_path))
            count += 1
            copied_files.append((original_path, new_filename))
            print(f"[{count}] 已复制: {original_path} -> {new_filename}")
            
        except Exception as e:
            print(f"错误: 复制文件失败 {original_path}: {e}")
    
    # 生成报告
    print(f"\n{'='*50}")
    print(f"复制完成!")
    print(f"成功复制: {count}/{len(file_paths)} 个文件")
    print(f"目标目录: {target_dir.absolute()}")
    
    # 可选：生成重命名映射文件
    if copied_files:
        mapping_file = target_dir / "rename_mapping.txt"
        with open(mapping_file, 'w', encoding='utf-8') as f:
            f.write("原始文件 -> 新文件名\n")
            f.write("=" * 40 + "\n")
            for original, new_name in copied_files:
                f.write(f"{original} -> {new_name}\n")
        print(f"重命名映射已保存到: {mapping_file}")

def main():
    """主函数，处理命令行参数"""
    
    if len(sys.argv) != 3:
        print("用法: python script.py list.md 目标目录")
        print("示例:")
        print("  python script.py list.md ./output")
        print("  python script.py list.md C:\\output")
        return
    
    list_file = sys.argv[1]
    target_dir = sys.argv[2]
    
    copy_and_rename_files(list_file, target_dir)

if __name__ == "__main__":
    main()