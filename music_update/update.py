#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音乐下载工具 - 更新程序
用于替换主程序文件（保持原文件名）
"""

import os
import sys
import time
import shutil
import tempfile
import subprocess
import platform

def get_target_exe_path():
    """获取目标主程序路径（保持原文件名）"""
    
    # 方法1：从命令行参数获取（主程序传递过来的路径）
    if len(sys.argv) > 1:
        target_path = sys.argv[1]
        if os.path.exists(target_path) or os.path.exists(os.path.dirname(target_path)):
            return target_path
    
    # 方法2：自动查找同目录下的主程序
    # 获取当前目录（更新程序所在的目录）
    if getattr(sys, 'frozen', False):
        # 打包成exe时，获取exe所在目录
        current_dir = os.path.dirname(sys.executable)
    else:
        # 运行脚本时，获取脚本所在目录
        current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 可能的主程序名称列表（按优先级排序）
    possible_names = [
        "音乐下载器.exe",
        "MusicDownloader.exe",
        "main.exe",
        "音乐下载器.py",
        "main.py"
    ]
    
    # 查找当前目录下是否存在主程序
    for name in possible_names:
        test_path = os.path.join(current_dir, name)
        if os.path.exists(test_path):
            return test_path
    
    # 如果都没找到，使用默认名称
    return os.path.join(current_dir, "音乐下载器.exe")

def main():
    """执行更新"""
    print("=" * 50)
    print("音乐下载工具 - 更新程序")
    print("=" * 50)
    
    # 等待原程序完全关闭
    print("等待原程序关闭...")
    time.sleep(2)
    
    # 获取目标主程序路径
    target_exe = get_target_exe_path()
    target_dir = os.path.dirname(target_exe)
    target_name = os.path.basename(target_exe)
    
    # 获取临时目录（latest.exe所在位置）
    if getattr(sys, 'frozen', False):
        temp_dir = os.path.dirname(sys.executable)
    else:
        temp_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 最新程序文件位置（下载的临时文件）
    latest_exe = os.path.join(temp_dir, "latest.exe")
    
    # 如果latest.exe不存在，尝试其他可能的名称
    if not os.path.exists(latest_exe):
        alt_names = ["音乐下载器_new.exe", "MusicDownloader_new.exe", "new.exe"]
        for alt_name in alt_names:
            alt_path = os.path.join(temp_dir, alt_name)
            if os.path.exists(alt_path):
                latest_exe = alt_path
                break
    
    print(f"目标程序: {target_exe}")
    print(f"目标文件名: {target_name}")
    print(f"更新文件: {latest_exe}")
    
    # 检查更新文件是否存在
    if not os.path.exists(latest_exe):
        print(f"错误：找不到更新文件 {latest_exe}")
        input("按任意键退出...")
        return
    
    try:
        # 确保目标目录存在
        if target_dir and not os.path.exists(target_dir):
            os.makedirs(target_dir)
        
        # ========== 步骤1：备份原程序 ==========
        backup_exe = None
        if os.path.exists(target_exe):
            # 创建备份文件名（带时间戳）
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            backup_exe = target_exe.replace(".exe", f"_backup_{timestamp}.exe")
            if not backup_exe.endswith('.exe'):
                backup_exe = target_exe + f"_backup_{timestamp}"
            
            try:
                shutil.copy2(target_exe, backup_exe)
                print(f"已备份原程序: {backup_exe}")
            except Exception as e:
                print(f"备份失败（继续更新）: {e}")
        
        # ========== 步骤2：删除原程序 ==========
        if os.path.exists(target_exe):
            try:
                os.remove(target_exe)
                print(f"已删除旧程序: {target_exe}")
                time.sleep(0.5)
            except PermissionError:
                # 如果无法删除，尝试重命名
                print("无法直接删除，尝试重命名...")
                temp_name = target_exe + ".old"
                shutil.move(target_exe, temp_name)
                print(f"已重命名旧程序: {temp_name}")
                try:
                    os.remove(temp_name)
                    print("已删除重命名的旧程序")
                except:
                    print("保留重命名的文件，稍后删除")
        
        # ========== 步骤3：复制新程序（保持原文件名） ==========
        print(f"正在复制新程序到: {target_exe}")
        shutil.copy2(latest_exe, target_exe)
        
        # 验证复制是否成功
        if os.path.exists(target_exe):
            print(f"✓ 更新成功！新程序已保存为: {target_name}")
        else:
            raise Exception("复制后文件不存在")
        
        # ========== 步骤4：清理临时文件 ==========
        try:
            if os.path.exists(latest_exe):
                os.remove(latest_exe)
                print("已清理临时文件: latest.exe")
        except Exception as e:
            print(f"清理临时文件失败: {e}")
        
        # ========== 步骤5：启动新程序 ==========
        time.sleep(1)
        print("正在启动新版本程序...")
        
        if os.path.exists(target_exe):
            if target_exe.endswith('.py'):
                # 如果是Python脚本，用python执行
                creationflags = subprocess.CREATE_NO_WINDOW if platform.system() == 'Windows' else 0
                subprocess.Popen(['python', target_exe], shell=True, creationflags=creationflags)
            else:
                # 直接启动exe
                os.startfile(target_exe)
            print("✓ 新程序已启动")
        else:
            print("错误：新程序文件不存在")
        
        # ========== 步骤6：延迟删除备份文件 ==========
        if backup_exe and os.path.exists(backup_exe):
            # 创建一个批处理文件来延迟删除备份
            batch_file = os.path.join(tempfile.gettempdir(), "cleanup_backup.bat")
            with open(batch_file, 'w', encoding='utf-8') as f:
                f.write(f'@echo off\n')
                f.write(f'timeout /t 10 /nobreak > nul\n')
                f.write(f'if exist "{backup_exe}" del "{backup_exe}"\n')
                f.write(f'del "%~f0"\n')
            creationflags = subprocess.CREATE_NO_WINDOW if platform.system() == 'Windows' else 0
            subprocess.Popen(batch_file, creationflags=creationflags)
            print("将在10秒后自动删除备份文件")
        
        # ========== 步骤7：删除更新程序自身 ==========
        current_file = sys.argv[0]
        if os.path.exists(current_file):
            # 创建批处理文件删除自身
            batch_file = os.path.join(tempfile.gettempdir(), "del_update.bat")
            with open(batch_file, 'w', encoding='utf-8') as f:
                f.write(f'@echo off\n')
                f.write(f'timeout /t 3 /nobreak > nul\n')
                f.write(f'del "{current_file}"\n')
                f.write(f'if exist "{current_file}" del "{current_file}"\n')
                f.write(f'del "%~f0"\n')
            creationflags = subprocess.CREATE_NO_WINDOW if platform.system() == 'Windows' else 0
            subprocess.Popen(batch_file, creationflags=creationflags)
            print("更新程序将在3秒后自动删除")
        
        print("\n更新完成！")
        
    except Exception as e:
        # 记录错误日志
        error_log = os.path.join(target_dir, "update_error.log")
        with open(error_log, 'w', encoding='utf-8') as f:
            f.write(f"更新时间: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"错误信息: {str(e)}\n")
            f.write(f"目标文件: {target_exe}\n")
            f.write(f"源文件: {latest_exe}\n")
            f.write(f"当前目录: {os.getcwd()}\n")
        
        print(f"\n❌ 更新失败：{e}")
        print(f"错误日志已保存到: {error_log}")
        
        # 尝试恢复备份
        if backup_exe and os.path.exists(backup_exe):
            print("尝试恢复原程序...")
            try:
                shutil.copy2(backup_exe, target_exe)
                print("已恢复原程序")
            except:
                print("恢复失败，请手动恢复")
        
        input("\n按任意键退出...")


if __name__ == "__main__":
    main()
