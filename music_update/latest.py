#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
音乐下载工具
仅供华附北滘学校内部使用，严禁对外传播
保留所有权利 (C) 2026 aiLinMc，侵权必究

歌曲数据来源：Hi歌曲网 - https://higequ.com/
音乐图标 by iynque (Andrew Williams)，遵循 CC BY-NC-ND 4.0 许可
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import requests
import re
import threading
import webbrowser
import os
import sys
import shutil
import tempfile
import ssl
import subprocess
import zipfile
import platform
import time
from urllib.parse import quote
from PIL import Image, ImageTk
import io


# 禁用SSL警告
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ==================== 版本配置 ====================
CURRENT_INTERNAL_VERSION = "4"  # 内部版本号（纯数字，用于比较）
CURRENT_DISPLAY_VERSION = "v1.1.2"  # 显示版本号（展示给用户）
UPDATE_DOWNLOAD_URL = "https://yyxc.fun/music_update/"  # 更新下载地址
VERSION_URL = UPDATE_DOWNLOAD_URL + "music_version.txt"  # 版本文件URL


def get_current_program_path():
    # 获取当前程序的实际路径
    if getattr(sys, 'frozen', False):
        return sys.executable
    else:
        return os.path.abspath(__file__)


def get_ffmpeg_path():
    # 获取ffmpeg路径
    if getattr(sys, 'frozen', False):
        return os.path.join(os.path.dirname(sys.executable), "ffmpeg", "ffmpeg.exe")
    else:
        possible_paths = [
            os.path.join(os.path.dirname(__file__), "ffmpeg", "ffmpeg.exe"),
            os.path.join(os.path.expanduser("~"), "ffmpeg", "bin", "ffmpeg.exe"),
            "ffmpeg.exe"
        ]
        for path in possible_paths:
            if os.path.exists(path):
                return path
        return None


class FFmpegInstaller:
    # FFmpeg安装器
    
    @staticmethod
    def is_installed():
        ffmpeg_path = get_ffmpeg_path()
        if ffmpeg_path and os.path.exists(ffmpeg_path):
            return True
        try:
            creationflags = subprocess.CREATE_NO_WINDOW if platform.system() == 'Windows' else 0
            subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, encoding='utf-8', errors='ignore', timeout=5, creationflags=creationflags)
            return True
        except:
            return False
    
    @staticmethod
    def install(parent=None, progress_callback=None):
        system = platform.system()
        if system == "Windows":
            url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
            zip_name = "ffmpeg.zip"
        elif system == "Darwin":
            url = "https://evermeet.cx/ffmpeg/ffmpeg-6.1.1.zip"
            zip_name = "ffmpeg.zip"
        else:
            return False, "Linux系统请使用包管理器安装ffmpeg：\nsudo apt install ffmpeg  或  sudo yum install ffmpeg"
        
        try:
            if progress_callback:
                progress_callback(10, "正在下载ffmpeg...")
            
            temp_dir = tempfile.gettempdir()
            zip_path = os.path.join(temp_dir, zip_name)
            
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            response = requests.get(url, headers=headers, stream=True, timeout=60)
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            with open(zip_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0 and progress_callback:
                            progress = 10 + int((downloaded / total_size) * 60)
                            progress_callback(progress, f"下载ffmpeg {int(downloaded/total_size*100)}%")
            
            if progress_callback:
                progress_callback(75, "正在解压ffmpeg...")
            
            extract_dir = os.path.join(os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(__file__), "ffmpeg")
            os.makedirs(extract_dir, exist_ok=True)
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
            ffmpeg_exe = None
            for root, dirs, files in os.walk(extract_dir):
                if "ffmpeg.exe" in files:
                    ffmpeg_exe = os.path.join(root, "ffmpeg.exe")
                    break
            
            if ffmpeg_exe and os.path.exists(ffmpeg_exe):
                target_exe = os.path.join(extract_dir, "ffmpeg.exe")
                if ffmpeg_exe != target_exe:
                    shutil.move(ffmpeg_exe, target_exe)
            
            os.remove(zip_path)
            
            if progress_callback:
                progress_callback(100, "ffmpeg安装完成")
            
            return True, "安装成功"
        except Exception as e:
            return False, f"安装失败：{str(e)}"
    
    @staticmethod
    def convert_to_mp3(input_path, output_path, progress_callback=None):
        ffmpeg_path = get_ffmpeg_path()
        if not ffmpeg_path or not os.path.exists(ffmpeg_path):
            ffmpeg_path = "ffmpeg"
        
        cmd = [ffmpeg_path, "-i", input_path, "-acodec", "libmp3lame", "-q:a", "2", output_path, "-y"]
        
        if progress_callback:
            progress_callback(0, "开始转换...")
        
        creationflags = subprocess.CREATE_NO_WINDOW if platform.system() == 'Windows' else 0
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='ignore', creationflags=creationflags)
        stdout, stderr = process.communicate()
        
        if process.returncode == 0 and os.path.exists(output_path):
            if progress_callback:
                progress_callback(100, "转换完成")
            return True
        return False


class ConvertProgressWindow:
    def __init__(self, parent, title):
        self.parent = parent
        self.title = title
        self.window = None
        self.progress_bar = None
        self.progress_label = None
        self.status_label = None
        self.result = False
        
    def show(self):
        self.window = tk.Toplevel(self.parent)
        self.window.title("正在转换")
        self.window.geometry("400x200")
        self.window.transient(self.parent)
        self.window.grab_set()
        
        self.window.update_idletasks()
        x = self.parent.winfo_x() + (self.parent.winfo_width() // 2) - 200
        y = self.parent.winfo_y() + (self.parent.winfo_height() // 2) - 100
        self.window.geometry(f"+{x}+{y}")
        
        main_frame = ttk.Frame(self.window, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        title_label = ttk.Label(main_frame, text=f"正在转换：{self.title}", font=("微软雅黑", 10, "bold"))
        title_label.pack(pady=(0, 15))
        
        self.progress_bar = ttk.Progressbar(main_frame, mode='determinate', length=350)
        self.progress_bar.pack(pady=(0, 10))
        
        self.progress_label = ttk.Label(main_frame, text="0%")
        self.progress_label.pack()
        
        self.status_label = ttk.Label(main_frame, text="准备转换...", foreground="gray")
        self.status_label.pack(pady=(10, 0))
        
        return self.result
    
    def update_progress(self, value, status):
        if self.window and self.window.winfo_exists():
            self.progress_bar['value'] = value
            self.progress_label.config(text=f"{value}%")
            self.status_label.config(text=status)
            self.window.update_idletasks()
    
    def complete(self, success):
        self.result = success
        if self.window and self.window.winfo_exists():
            if success:
                self.update_progress(100, "转换完成！")
                self.window.after(1000, self.close)
            else:
                self.status_label.config(text="转换失败", foreground="red")
                self.window.after(2000, self.close)
    
    def close(self):
        if self.window and self.window.winfo_exists():
            self.window.destroy()


class DownloadProgressWindow:
    def __init__(self, parent, title, total_size):
        self.parent = parent
        self.title = title
        self.total_size = total_size
        self.window = None
        self.progress_bar = None
        self.progress_label = None
        self.speed_label = None
        self.size_label = None
        self.cancel = False
        self.cancel_callback = None
        
    def show(self):
        self.window = tk.Toplevel(self.parent)
        self.window.title(f"正在下载：{self.title}")
        self.window.geometry("450x200")
        self.window.transient(self.parent)
        self.window.grab_set()
        
        self.window.update_idletasks()
        x = self.parent.winfo_x() + (self.parent.winfo_width() // 2) - 225
        y = self.parent.winfo_y() + (self.parent.winfo_height() // 2) - 100
        self.window.geometry(f"+{x}+{y}")
        
        main_frame = ttk.Frame(self.window, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        title_label = ttk.Label(main_frame, text=self.title, font=("微软雅黑", 10, "bold"))
        title_label.pack(pady=(0, 15))
        
        self.progress_bar = ttk.Progressbar(main_frame, mode='determinate', length=380)
        self.progress_bar.pack(pady=(0, 10))
        
        self.progress_label = ttk.Label(main_frame, text="0%")
        self.progress_label.pack()
        
        self.speed_label = ttk.Label(main_frame, text="速度：-- KB/s", foreground="gray")
        self.speed_label.pack(pady=(5, 0))
        
        size_text = self.format_size(self.total_size) if self.total_size > 0 else "未知大小"
        self.size_label = ttk.Label(main_frame, text=f"文件大小：{size_text}", foreground="gray")
        self.size_label.pack(pady=(15, 0))
        
        self.window.protocol("WM_DELETE_WINDOW", self.on_cancel)
    
    def on_cancel(self):
        self.cancel = True
        if self.cancel_callback:
            self.cancel_callback()
    
    def update(self, downloaded, speed=0):
        if self.window and self.window.winfo_exists():
            if self.total_size > 0:
                percent = (downloaded / self.total_size) * 100
                self.progress_bar['value'] = percent
                self.progress_label.config(text=f"{percent:.1f}%")
            else:
                self.progress_bar['value'] = 0
                self.progress_label.config(text=f"{self.format_size(downloaded)}")
            
            if speed > 0:
                self.speed_label.config(text=f"速度：{self.format_speed(speed)}")
            
            size_text = f"{self.format_size(downloaded)}"
            if self.total_size > 0:
                size_text += f" / {self.format_size(self.total_size)}"
            self.size_label.config(text=f"已下载：{size_text}")
            self.window.update_idletasks()
    
    def complete(self):
        if self.window and self.window.winfo_exists():
            self.progress_bar['value'] = 100
            self.progress_label.config(text="100%")
            self.speed_label.config(text="下载完成！")
            self.window.update_idletasks()
            self.window.after(1000, self.close)
    
    def close(self):
        if self.window and self.window.winfo_exists():
            self.window.destroy()
    
    def is_cancelled(self):
        return self.cancel
    
    def set_cancel_callback(self, callback):
        self.cancel_callback = callback
    
    @staticmethod
    def format_size(size):
        if size <= 0:
            return "0 B"
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"
    
    @staticmethod
    def format_speed(speed):
        if speed <= 0:
            return "-- KB/s"
        if speed < 1024:
            return f"{speed:.1f} KB/s"
        return f"{speed/1024:.1f} MB/s"


class UpdateProgressWindow:
    def __init__(self, parent):
        self.parent = parent
        self.window = None
        self.progress_bar = None
        self.progress_label = None
        self.status_label = None
        self.cancel = False
        self.downloaded_files = []
        
    def show(self):
        self.window = tk.Toplevel(self.parent)
        self.window.title("正在更新")
        self.window.geometry("400x200")
        self.window.transient(self.parent)
        self.window.grab_set()
        self.window.protocol("WM_DELETE_WINDOW", self.on_cancel)
        
        self.window.update_idletasks()
        x = self.parent.winfo_x() + (self.parent.winfo_width() // 2) - 200
        y = self.parent.winfo_y() + (self.parent.winfo_height() // 2) - 100
        self.window.geometry(f"+{x}+{y}")
        
        main_frame = ttk.Frame(self.window, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        title_label = ttk.Label(main_frame, text="正在下载更新文件...", font=("微软雅黑", 12, "bold"))
        title_label.pack(pady=(0, 15))
        
        self.progress_bar = ttk.Progressbar(main_frame, mode='determinate', length=350)
        self.progress_bar.pack(pady=(0, 10))
        
        self.progress_label = ttk.Label(main_frame, text="0%")
        self.progress_label.pack()
        
        self.status_label = ttk.Label(main_frame, text="准备下载...", foreground="gray")
        self.status_label.pack(pady=(10, 0))
        
        thread = threading.Thread(target=self.update_thread)
        thread.daemon = True
        thread.start()
    
    def on_cancel(self):
        self.cancel = True
        if self.window and self.window.winfo_exists():
            self.window.destroy()
        self._cleanup_downloaded_files()
        
    def _cleanup_downloaded_files(self):
        for file_path in self.downloaded_files:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"已删除取消的更新文件: {file_path}")
            except Exception as e:
                print(f"删除文件失败: {e}")
    
    def update_progress(self, value, status):
        if self.window and self.window.winfo_exists():
            self.progress_bar['value'] = value
            self.progress_label.config(text=f"{value}%")
            self.status_label.config(text=status)
            self.window.update_idletasks()
    
    def update_thread(self):
        try:
            def progress_callback(value, status):
                if self.window and self.window.winfo_exists():
                    self.window.after(0, lambda: self.update_progress(value, status))
            
            def cancel_callback():
                return self.cancel
            
            latest_path, update_path = UpdateChecker.download_update_files(progress_callback, cancel_callback)
            
            if self.cancel:
                return
                
            if latest_path and update_path:
                self.downloaded_files.extend([latest_path, update_path])
                self.window.after(0, lambda: self.update_progress(100, "更新完成，正在退出..."))
                self.window.after(1000, lambda: self.complete_update(latest_path, update_path))
            else:
                self.window.after(0, lambda: self.show_error("下载更新文件失败，请检查网络连接"))
        except Exception as e:
            if not self.cancel:
                self.window.after(0, lambda: self.show_error(f"更新过程中出现错误：{e}"))
    
    def complete_update(self, latest_path, update_path):
        if self.window and self.window.winfo_exists():
            self.window.destroy()
        
        result = messagebox.askyesno("更新完成", "新版本已下载完成！\n\n是否立即重启软件以应用更新？\n\n提示：重启后新版本将生效。")
        if result:
            UpdateChecker.perform_update(latest_path, update_path)
        else:
            try:
                current_dir = os.path.dirname(get_current_program_path())
                target_latest = os.path.join(current_dir, "latest.exe")
                target_update = os.path.join(current_dir, "update.exe")
                if os.path.exists(latest_path):
                    shutil.copy2(latest_path, target_latest)
                if os.path.exists(update_path):
                    shutil.copy2(update_path, target_update)
                messagebox.showinfo("提示", "更新文件已保存，下次启动软件时将自动完成更新。")
            except Exception as e:
                messagebox.showerror("错误", f"保存更新文件失败：{e}")
    
    def show_error(self, error_msg):
        if self.window and self.window.winfo_exists():
            self.window.destroy()
        messagebox.showerror("更新失败", error_msg)


class UpdateChecker:
    @staticmethod
    def get_session_with_retry():
        session = requests.Session()
        session.verify = False
        session.timeout = 20
        retry_strategy = requests.adapters.Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
        adapter = requests.adapters.HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        return session
    
    @staticmethod
    def check_for_updates():
        try:
            session = UpdateChecker.get_session_with_retry()
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            response = session.get(VERSION_URL, headers=headers, timeout=20)
            
            if response.status_code != 200:
                return False, None, None, None, None
            
            content = response.content
            if content.startswith(b'\xef\xbb\xbf'):
                content = content[3:]
            
            text = content.decode('utf-8')
            lines = text.strip().split('\n')
            
            # 第一行：内部版本号（可能带#号）
            version_line = lines[0].strip()
            internal_version = version_line.lstrip('#').strip()
            
            # 第二行：显示版本号和日期
            display_line = lines[1].strip() if len(lines) > 1 else ""
            display_version = display_line.split('-')[0].strip() if display_line else ""
            
            # 解析更新日志（按---分割）
            full_content = '\n'.join(lines)
            parts = re.split(r'\n---\n|\n-{3,}\n', full_content)
            
            latest_changelog = parts[0].split('\n', 1)[1] if len(parts) > 0 else "暂无更新日志"
            historical_changelog = '\n---\n'.join(parts[1:]) if len(parts) > 1 else ""
            
            has_update = internal_version > CURRENT_INTERNAL_VERSION
            
            return has_update, internal_version, display_version, latest_changelog.strip(), historical_changelog.strip()
        except Exception as e:
            print(f"检查更新失败: {e}")
            return False, None, None, None, None
    
    @staticmethod
    def download_update_files(progress_callback=None, cancel_callback=None):
        temp_dir = tempfile.gettempdir()
        latest_exe_path = os.path.join(temp_dir, "latest.exe")
        update_exe_path = os.path.join(temp_dir, "update.exe")
        
        try:
            session = UpdateChecker.get_session_with_retry()
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            
            if progress_callback:
                progress_callback(10, "正在下载最新程序...")
            
            resp1 = session.get(UPDATE_DOWNLOAD_URL + "latest.exe", headers=headers, stream=True, timeout=30)
            resp1.raise_for_status()
            total_size = int(resp1.headers.get('content-length', 0))
            downloaded = 0
            with open(latest_exe_path, 'wb') as f:
                for chunk in resp1.iter_content(chunk_size=8192):
                    if cancel_callback and cancel_callback():
                        print("下载已取消")
                        return None, None
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0 and progress_callback:
                            progress = 10 + int((downloaded / total_size) * 40)
                            progress_callback(progress, f"下载最新程序 {int(downloaded/total_size*100)}%")
            
            if cancel_callback and cancel_callback():
                print("下载已取消")
                return None, None
            
            if progress_callback:
                progress_callback(60, "正在下载更新程序...")
            
            resp2 = session.get(UPDATE_DOWNLOAD_URL + "update.exe", headers=headers, stream=True, timeout=30)
            resp2.raise_for_status()
            total_size2 = int(resp2.headers.get('content-length', 0))
            downloaded2 = 0
            with open(update_exe_path, 'wb') as f:
                for chunk in resp2.iter_content(chunk_size=8192):
                    if cancel_callback and cancel_callback():
                        print("下载已取消")
                        return None, None
                    if chunk:
                        f.write(chunk)
                        downloaded2 += len(chunk)
                        if total_size2 > 0 and progress_callback:
                            progress = 60 + int((downloaded2 / total_size2) * 30)
                            progress_callback(progress, f"下载更新程序 {int(downloaded2/total_size2*100)}%")
            
            if progress_callback:
                progress_callback(95, "下载完成，准备更新...")
            
            return latest_exe_path, update_exe_path
        except Exception as e:
            print(f"下载更新文件失败: {e}")
            return None, None
    
    @staticmethod
    def perform_update(latest_exe_path, update_exe_path):
        try:
            current_program = get_current_program_path()
            creationflags = subprocess.CREATE_NO_WINDOW if platform.system() == 'Windows' else 0
            subprocess.Popen([update_exe_path, current_program], creationflags=creationflags)
            sys.exit(0)
        except Exception as e:
            print(f"执行更新失败: {e}")


class UpdateDialog:
    """更新对话框 - 最大显示7行，超出显示滚动条"""
    def __init__(self, parent, has_update, display_version, latest_changelog, historical_changelog, update_callback=None):
        self.parent = parent
        self.has_update = has_update
        self.display_version = display_version
        self.latest_changelog = latest_changelog.strip()
        self.historical_changelog = historical_changelog.strip()
        self.update_callback = update_callback
        self.window = None
        self.max_lines = 7  # 最大显示行数
        
    def get_exact_lines(self, text):
        """精确计算文本所需行数"""
        if not text:
            return 1
        
        lines = text.split('\n')
        total_lines = 0
        
        for line in lines:
            if not line.strip():
                total_lines += 1
                continue
            
            if len(line) <= 55:
                total_lines += 1
            else:
                total_lines += (len(line) + 55 - 1) // 55
        
        return max(1, total_lines)
    
    def get_display_height(self, text):
        """获取显示高度（行数，最大7行）"""
        lines = self.get_exact_lines(text)
        return min(lines, self.max_lines)
    
    def calculate_window_size(self):
        """计算窗口大小"""
        # 最新日志显示行数
        latest_display = self.get_display_height(self.latest_changelog)
        latest_height = latest_display * 22 + 48  # 文本框高度 + 标签边框
        
        # 历史日志显示行数
        if self.historical_changelog:
            history_display = self.get_display_height(self.historical_changelog)
            history_height = history_display * 22 + 48
            content_height = latest_height + history_height + 10
        else:
            content_height = latest_height + 5
        
        # 窗口总高度：标题(30) + 内边距(20) + 底部按钮(40) + 间距
        window_height = int(30 + 20 + 40 + content_height)
        window_height = max(300, min(550, window_height))
        window_width = 580
        
        return window_width, window_height
    
    def show(self):
        window_width, window_height = self.calculate_window_size()
        
        self.window = tk.Toplevel(self.parent)
        if self.has_update:
            self.window.title(f"发现新版本 {self.display_version}")
        else:
            self.window.title(f"已是最新版本")
        self.window.geometry(f"{window_width}x{window_height}")
        self.window.transient(self.parent)
        self.window.grab_set()
        self.window.resizable(False, False)
        
        # 居中
        self.window.update_idletasks()
        x = self.parent.winfo_x() + (self.parent.winfo_width() // 2) - (window_width // 2)
        y = self.parent.winfo_y() + (self.parent.winfo_height() // 2) - (window_height // 2)
        self.window.geometry(f"+{x}+{y}")
        
        # 主框架
        main_frame = ttk.Frame(self.window, padding="8")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 标题
        if self.has_update:
            title_label = ttk.Label(main_frame, text=f"✨ 发现新版本 {self.display_version}", 
                                     font=("微软雅黑", 12, "bold"), foreground="#2575fc")
        else:
            title_label = ttk.Label(main_frame, text=f"✅ 当前已是最新版本 ({CURRENT_DISPLAY_VERSION})", 
                                     font=("微软雅黑", 12, "bold"), foreground="#4CAF50")
        title_label.pack(pady=(0, 5))
        
        # 最新更新区域
        latest_frame = ttk.LabelFrame(main_frame, text="📌 最新更新", padding="5")
        latest_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 5))
        
        # 创建框架容纳文本框和滚动条
        latest_text_frame = ttk.Frame(latest_frame)
        latest_text_frame.pack(fill=tk.BOTH, expand=True)
        
        latest_display = self.get_display_height(self.latest_changelog)
        latest_text = tk.Text(latest_text_frame, height=latest_display,
                               font=("微软雅黑", 9), wrap=tk.WORD,
                               relief=tk.FLAT, borderwidth=1, highlightthickness=1)
        latest_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # 只有内容超过7行时才显示滚动条
        if self.get_exact_lines(self.latest_changelog) > self.max_lines:
            latest_scrollbar = ttk.Scrollbar(latest_text_frame, orient=tk.VERTICAL, command=latest_text.yview)
            latest_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
            latest_text.configure(yscrollcommand=latest_scrollbar.set)
        
        latest_text.insert(tk.END, self.latest_changelog)
        latest_text.config(state=tk.DISABLED)
        
        # 历史更新区域（如果有）
        if self.historical_changelog:
            history_frame = ttk.LabelFrame(main_frame, text="📜 历史更新", padding="5")
            history_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 5))
            
            history_text_frame = ttk.Frame(history_frame)
            history_text_frame.pack(fill=tk.BOTH, expand=True)
            
            history_display = self.get_display_height(self.historical_changelog)
            history_text = tk.Text(history_text_frame, height=history_display,
                                    font=("微软雅黑", 9), wrap=tk.WORD,
                                    relief=tk.FLAT, borderwidth=1, highlightthickness=1)
            history_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            
            # 只有内容超过7行时才显示滚动条
            if self.get_exact_lines(self.historical_changelog) > self.max_lines:
                history_scrollbar = ttk.Scrollbar(history_text_frame, orient=tk.VERTICAL, command=history_text.yview)
                history_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
                history_text.configure(yscrollcommand=history_scrollbar.set)
            
            history_text.insert(tk.END, self.historical_changelog)
            history_text.config(state=tk.DISABLED)
        
        # 底部按钮
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=tk.X, pady=(8, 0))
        
        if self.has_update:
            update_btn = ttk.Button(btn_frame, text="立即更新", command=self.on_update, width=12)
            update_btn.pack(side=tk.RIGHT, padx=(5, 0))
        
        close_btn = ttk.Button(btn_frame, text="关闭", command=self.window.destroy, width=10)
        close_btn.pack(side=tk.RIGHT)
    
    def on_update(self):
        self.window.destroy()
        if self.update_callback:
            self.update_callback()


class MusicDownloaderGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("音乐下载工具")
        self.root.geometry("1000x780")
        self.root.minsize(900, 680);
        
        self.current_song_info = None
        self.search_results = []
        self.current_page = 1
        self.current_keyword = ""
        self.total_pages = 1
        self.album_image = None
        self.album_photo = None
        
        self.setup_styles()
        self.create_widgets()
        self.center_window()
        
        self.check_pending_update()
        self.root.after(2000, self.check_update_on_startup)
    
    def check_pending_update(self):
        try:
            current_dir = os.path.dirname(get_current_program_path())
            pending_latest = os.path.join(current_dir, "latest.exe")
            pending_update = os.path.join(current_dir, "update.exe")
            if os.path.exists(pending_latest) and os.path.exists(pending_update):
                result = messagebox.askyesno("发现待更新文件", "检测到上次下载的更新文件尚未应用。\n\n是否立即应用更新并重启软件？")
                if result:
                    UpdateChecker.perform_update(pending_latest, pending_update)
                else:
                    try:
                        os.remove(pending_latest)
                        os.remove(pending_update)
                    except:
                        pass
        except Exception as e:
            print(f"检查待更新文件失败: {e}")
    
    def setup_styles(self):
        style = ttk.Style()
        style.configure("Title.TLabel", font=("微软雅黑", 12, "bold"), foreground="#2575fc")
    
    def center_window(self):
        self.root.update_idletasks()
        x = (self.root.winfo_screenwidth() // 2) - (1000 // 2)
        y = (self.root.winfo_screenheight() // 2) - (780 // 2)
        self.root.geometry(f'1000x780+{x}+{y}')
    
    def create_widgets(self):
        main_frame = ttk.Frame(self.root, padding="15")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        self.create_info_bar(main_frame)
        self.create_legal_notice(main_frame)
        self.create_search_area(main_frame)
        self.create_content_area(main_frame)
        self.create_status_area(main_frame)
    
    def create_info_bar(self, parent):
        info_frame = tk.Frame(parent, bg="#e8f0fe", relief=tk.FLAT, bd=1)
        info_frame.pack(fill=tk.X, pady=(0, 10))
        
        author_label = tk.Label(info_frame, text="原作者：aiLinMc", bg="#e8f0fe", fg="#2575fc",
                                 font=("微软雅黑", 9, "bold"), pady=5, padx=10)
        author_label.pack(side=tk.LEFT)
        
        version_label = tk.Label(info_frame, text=f"当前版本：{CURRENT_DISPLAY_VERSION}",
                                  bg="#e8f0fe", fg="#666", font=("微软雅黑", 9), pady=5, padx=10)
        version_label.pack(side=tk.RIGHT)
        
        self.check_update_btn = tk.Button(info_frame, text="检查更新", bg="#4CAF50", fg="white",
                                           font=("微软雅黑", 8), padx=10, cursor="hand2",
                                           command=self.manual_check_update)
        self.check_update_btn.pack(side=tk.RIGHT, padx=(0, 10))
        
        self.update_status_label = ttk.Label(info_frame, text="", font=("微软雅黑", 8))
        self.update_status_label.pack(side=tk.RIGHT, padx=(0, 10))
    
    def create_legal_notice(self, parent):
        notice_frame = tk.Frame(parent, bg="#fff3cd", relief=tk.SUNKEN, bd=1)
        notice_frame.pack(fill=tk.X, pady=(0, 15))
        notice_label = tk.Label(notice_frame,
            text="⚠️ 内部使用声明：本工具仅限华附北滘学校内部使用\n严禁对外传播、转载或用于商业用途 | 因擅自传播导致的一切法律责任由传播者承担",
            bg="#fff3cd", fg="#856404", font=("微软雅黑", 9), pady=8)
        notice_label.pack()
    
    def create_search_area(self, parent):
        search_frame = ttk.LabelFrame(parent, text="搜索歌曲", padding="10")
        search_frame.pack(fill=tk.X, pady=(0, 15))
        
        row1 = ttk.Frame(search_frame)
        row1.pack(fill=tk.X, pady=(0, 10))
        ttk.Label(row1, text="歌名：", width=5).pack(side=tk.LEFT)
        self.search_var = tk.StringVar()
        self.search_entry = ttk.Entry(row1, textvariable=self.search_var, font=("微软雅黑", 10))
        self.search_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        self.search_entry.bind('<Return>', lambda e: self.search())
        self.search_btn = ttk.Button(row1, text="搜索", command=self.search, width=8)
        self.search_btn.pack(side=tk.LEFT)
        
        row2 = ttk.Frame(search_frame)
        row2.pack(fill=tk.X)
        ttk.Label(row2, text="ID：", width=5).pack(side=tk.LEFT)
        self.id_var = tk.StringVar()
        self.id_entry = ttk.Entry(row2, textvariable=self.id_var, font=("微软雅黑", 10))
        self.id_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        self.id_entry.bind('<Return>', lambda e: self.extract())
        self.extract_btn = ttk.Button(row2, text="提取", command=self.extract, width=8)
        self.extract_btn.pack(side=tk.LEFT)
        
        hint_label = ttk.Label(search_frame,
            text="💡 输入歌名搜索，双击结果选择歌曲；或直接输入数字ID（如 228908）后点击提取",
            foreground="gray", font=("微软雅黑", 8))
        hint_label.pack(pady=(8, 0))
    
    def create_content_area(self, parent):
        content_frame = ttk.Frame(parent)
        content_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        # 左侧：专辑封面
        left_frame = ttk.Frame(content_frame, width=200, height=200)
        left_frame.pack(side=tk.LEFT, padx=(0, 10))
        left_frame.pack_propagate(False)
        
        self.cover_label = tk.Label(left_frame, text="暂无封面", bg="#f0f0f0", 
                                     font=("微软雅黑", 10), fg="gray",
                                     bd=1, relief=tk.SUNKEN)
        self.cover_label.pack(fill=tk.BOTH, expand=True)
        
        # 右侧：歌曲信息和歌词
        right_frame = ttk.Frame(content_frame)
        right_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        self.create_song_info_area(right_frame)
        self.create_lyrics_area(right_frame)
    
    def create_song_info_area(self, parent):
        info_frame = ttk.LabelFrame(parent, text="歌曲信息", padding="10")
        info_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        # 创建滚动条
        scrollbar = ttk.Scrollbar(info_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 固定高度为7行，超过时可滚动
        self.info_text = tk.Text(info_frame, height=7, font=("微软雅黑", 10), wrap=tk.WORD, 
                                 yscrollcommand=scrollbar.set, state=tk.DISABLED)
        self.info_text.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.info_text.yview)
        
        self.info_text.tag_config("label", foreground="#2575fc", font=("微软雅黑", 10, "bold"))
        self.info_text.tag_config("error", foreground="red")
        self.info_text.tag_config("warning", foreground="#856404")
        
        btn_frame = ttk.Frame(info_frame)
        btn_frame.pack(fill=tk.X, pady=(10, 0))
        
        btn_row1 = ttk.Frame(btn_frame)
        btn_row1.pack(fill=tk.X, pady=(0, 5))
        
        self.download_mp3_btn = ttk.Button(btn_row1, text="⬇️ 下载音频", command=self.download_audio, state=tk.DISABLED, width=12)
        self.download_mp3_btn.pack(side=tk.LEFT, padx=(0, 10))
        
        self.download_lrc_btn = ttk.Button(btn_row1, text="📝 下载歌词", command=self.download_lrc, state=tk.DISABLED, width=12)
        self.download_lrc_btn.pack(side=tk.LEFT, padx=(0, 10))
        
        self.open_browser_btn = ttk.Button(btn_row1, text="🌐 浏览器打开", command=self.open_browser, width=12)
        self.open_browser_btn.pack(side=tk.LEFT)
        
        btn_row2 = ttk.Frame(btn_frame)
        btn_row2.pack(fill=tk.X)
        
        self.convert_to_mp3_btn = ttk.Button(btn_row2, text="🔄 转换为MP3", command=self.convert_to_mp3, state=tk.DISABLED, width=12)
        self.convert_to_mp3_btn.pack(side=tk.LEFT, padx=(0, 10))
        
        self.format_warning_label = ttk.Label(btn_row2, text="", foreground="#856404", font=("微软雅黑", 8))
        self.format_warning_label.pack(side=tk.LEFT)
    
    def create_lyrics_area(self, parent):
        lyrics_frame = ttk.LabelFrame(parent, text="歌词", padding="10")
        lyrics_frame.pack(fill=tk.BOTH, expand=True)
        self.lyrics_text = tk.Text(lyrics_frame, height=12, font=("微软雅黑", 9), wrap=tk.WORD, state=tk.DISABLED)
        self.lyrics_text.pack(fill=tk.BOTH, expand=True)
    
    def create_status_area(self, parent):
        status_frame = ttk.Frame(parent)
        status_frame.pack(fill=tk.X)
        
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(status_frame, variable=self.progress_var, maximum=100)
        self.progress_bar.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        
        self.progress_label = ttk.Label(status_frame, text="", width=10)
        self.progress_label.pack(side=tk.RIGHT)
        
        self.status_var = tk.StringVar(value="就绪")
        status_bar = ttk.Label(parent, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W, font=("微软雅黑", 8))
        status_bar.pack(fill=tk.X, pady=(5, 0))
    
    # ==================== 更新功能 ====================
    
    def check_update_on_startup(self):
        def check():
            try:
                has_update, internal_ver, display_ver, latest_changelog, historical_changelog = UpdateChecker.check_for_updates()
                if has_update:
                    self.root.after(0, lambda: UpdateDialog(self.root, True, display_ver, latest_changelog, historical_changelog, self.perform_update).show())
                elif display_ver:
                    print(f"当前版本 {CURRENT_DISPLAY_VERSION}，已是最新")
            except Exception as e:
                print(f"检查更新出错: {e}")
        
        thread = threading.Thread(target=check)
        thread.daemon = True
        thread.start()
    
    def manual_check_update(self):
        self.update_status_label.config(text="检查更新中...", foreground="#2575fc")
        self.check_update_btn.config(state=tk.DISABLED)
        
        def check():
            has_update, internal_ver, display_ver, latest_changelog, historical_changelog = UpdateChecker.check_for_updates()
            self.root.after(0, lambda: self._on_check_complete(has_update, display_ver, latest_changelog, historical_changelog))
        
        thread = threading.Thread(target=check)
        thread.daemon = True
        thread.start()
    
    def _on_check_complete(self, has_update, display_version, latest_changelog, historical_changelog):
        self.update_status_label.config(text="")
        self.check_update_btn.config(state=tk.NORMAL)
        
        if has_update:
            UpdateDialog(self.root, True, display_version, latest_changelog, historical_changelog, self.perform_update).show()
        elif display_version:
            UpdateDialog(self.root, False, display_version, latest_changelog, historical_changelog).show()
        else:
            messagebox.showerror("检查更新", "检查更新失败，请检查网络连接")
    
    def perform_update(self):
        self._set_buttons_state(False)
        self._update_status("准备更新...")
        self.update_progress_window = UpdateProgressWindow(self.root)
        self.update_progress_window.show()
    
    # ==================== 搜索功能 ====================
    
    def search(self):
        keyword = self.search_var.get().strip()
        if not keyword:
            messagebox.showwarning("提示", "请输入歌曲名称")
            return
        self.current_keyword = keyword
        self.current_page = 1
        self._do_search()
    
    def _do_search(self):
        site_page1 = self.current_page * 2 - 1
        site_page2 = self.current_page * 2
        url1 = f"https://higequ.com/s/{quote(self.current_keyword)}/{site_page1}/"
        url2 = f"https://higequ.com/s/{quote(self.current_keyword)}/{site_page2}/"
        self._set_buttons_state(False)
        self._update_status(f"正在搜索：{self.current_keyword} (第{self.current_page}页)...")
        self._update_progress(0, "搜索中...")
        self._show_search_results_window()
        thread = threading.Thread(target=self._search_thread, args=(url1, url2))
        thread.daemon = True
        thread.start()
    
    def _search_thread(self, url1, url2):
        try:
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            response1 = requests.get(url1, headers=headers, timeout=15)
            response1.raise_for_status()
            response2 = requests.get(url2, headers=headers, timeout=15)
            response2.raise_for_status()
            results, total_pages = self._parse_search_results(response1.text, response2.text)
            self.root.after(0, self._on_search_complete, results, total_pages)
        except Exception as e:
            self.root.after(0, self._on_search_error, str(e))
    
    def _parse_search_results(self, html1, html2=""):
        results = []
        total_match = re.search(r'共\s*<span[^>]*>(\d+)</span>\s*页', html1)
        total_pages = int(total_match.group(1)) if total_match else 1
        total_pages = (total_pages + 1) // 2
        pattern = r'<div class="result-item" data-rid="(\d+)">.*?<div class="result-title">([^<]+)</div>.*?<div class="result-artist">([^<]+)</div>'
        for match in re.finditer(pattern, html1, re.DOTALL):
            song_id = match.group(1)
            title = match.group(2).strip()
            artist = match.group(3).strip()
            results.append({'id': song_id, 'title': title, 'artist': artist})
        if html2:
            for match in re.finditer(pattern, html2, re.DOTALL):
                song_id = match.group(1)
                title = match.group(2).strip()
                artist = match.group(3).strip()
                results.append({'id': song_id, 'title': title, 'artist': artist})
        return results, total_pages
    
    def _show_search_results_window(self):
        # 如果已存在搜索结果窗口，先关闭它
        if hasattr(self, 'result_window') and self.result_window.winfo_exists():
            self.result_window.destroy()
        self.result_window = tk.Toplevel(self.root)
        self.result_window.title(f"搜索结果：{self.current_keyword}")
        self.result_window.geometry("650x500")
        self.result_window.transient(self.root)
        self.result_window.grab_set()
        x = self.root.winfo_x() + 50
        y = self.root.winfo_y() + 50
        self.result_window.geometry(f"+{x}+{y}")
        
        main_frame = ttk.Frame(self.result_window, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        table_frame = ttk.Frame(main_frame)
        table_frame.pack(fill=tk.BOTH, expand=True)
        
        columns = ("ID", "歌名", "歌手")
        self.result_tree = ttk.Treeview(table_frame, columns=columns, show="headings", height=10)
        self.result_tree.heading("ID", text="歌曲ID")
        self.result_tree.heading("歌名", text="歌名")
        self.result_tree.heading("歌手", text="歌手")
        self.result_tree.column("ID", width=80)
        self.result_tree.column("歌名", width=320)
        self.result_tree.column("歌手", width=160)
        
        scrollbar = ttk.Scrollbar(table_frame, orient=tk.VERTICAL, command=self.result_tree.yview)
        self.result_tree.configure(yscrollcommand=scrollbar.set)
        self.result_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        page_frame = ttk.Frame(main_frame)
        page_frame.pack(fill=tk.X, pady=(10, 5))
        
        self.prev_result_btn = ttk.Button(page_frame, text="◀ 上一页", command=self._prev_page, width=10)
        self.prev_result_btn.pack(side=tk.LEFT)
        
        center_frame = ttk.Frame(page_frame)
        center_frame.pack(side=tk.LEFT, expand=True)
        
        self.page_info_label = ttk.Label(center_frame, text="第 1 页", width=15, anchor=tk.CENTER)
        self.page_info_label.pack(side=tk.LEFT)
        
        # 自定义页码输入框（紧邻页码）
        ttk.Label(center_frame, text="跳转到：").pack(side=tk.LEFT, padx=(5, 0))
        self.page_input = ttk.Entry(center_frame, width=5)
        self.page_input.pack(side=tk.LEFT, padx=(5, 5))
        self.page_input.bind('<Return>', self._goto_page)
        
        self.goto_btn = ttk.Button(center_frame, text="跳转", command=self._goto_page, width=6)
        self.goto_btn.pack(side=tk.LEFT)
        
        self.next_result_btn = ttk.Button(page_frame, text="下一页 ▶", command=self._next_page, width=10)
        self.next_result_btn.pack(side=tk.RIGHT)
        
        hint_label = ttk.Label(page_frame, text="💡 提示：搜索结果可双击", foreground="#666")
        hint_label.pack(side=tk.BOTTOM, pady=(5, 0))
        
        self.result_tree.bind('<Double-1>', self._on_result_select)
        self.prev_result_btn.config(state=tk.DISABLED)
        self.next_result_btn.config(state=tk.DISABLED)
    
    def _on_search_complete(self, results, total_pages):
        self.total_pages = total_pages
        self.search_results = results
        self._set_buttons_state(True)
        self._update_progress(100, "完成")
        
        if not results:
            self._update_status(f"未找到：{self.current_keyword}")
            messagebox.showinfo("提示", f"未找到\"{self.current_keyword}\"的相关歌曲")
            if hasattr(self, 'result_window') and self.result_window.winfo_exists():
                self.result_window.destroy()
            return
        
        if hasattr(self, 'result_window') and self.result_window.winfo_exists():
            for item in self.result_tree.get_children():
                self.result_tree.delete(item)
            for r in results:
                self.result_tree.insert("", tk.END, values=(r['id'], r['title'], r['artist']))
            self.page_info_label.config(text=f"第 {self.current_page} / {total_pages} 页")
            self.prev_result_btn.config(state=tk.NORMAL if self.current_page > 1 else tk.DISABLED)
            self.next_result_btn.config(state=tk.NORMAL if self.current_page < total_pages else tk.DISABLED)
        self._update_status(f"找到 {len(results)} 首歌曲")
    
    def _on_search_error(self, error):
        self._set_buttons_state(True)
        self._update_progress(0, "失败")
        self._update_status(f"搜索失败：{error}")
        messagebox.showerror("搜索失败", f"无法搜索：{error}")
    
    def _prev_page(self):
        if self.current_page > 1:
            self.current_page -= 1
            self._do_search()
    
    def _next_page(self):
        if self.current_page < self.total_pages:
            self.current_page += 1
            self._do_search()

    def _goto_page(self, event=None):
        try:
            page_num = int(self.page_input.get().strip())
            if page_num < 1:
                messagebox.showwarning("提示", "页码不能小于1")
                return
            if page_num > self.total_pages:
                messagebox.showwarning("提示", f"页码不能大于总页数 {self.total_pages}")
                return
            if page_num == self.current_page:
                return
            self.current_page = page_num
            self._do_search()
        except ValueError:
            messagebox.showwarning("提示", "请输入有效的页码")

    def _on_result_select(self, event):
        selection = self.result_tree.selection()
        if not selection:
            return
        item = self.result_tree.item(selection[0])
        song_id = item['values'][0]
        self.id_var.set(song_id)
        if hasattr(self, 'result_window'):
            self.result_window.destroy()
        self.extract()
    
    # ==================== 提取功能 ====================
    
    def extract(self):
        song_id = self.id_var.get().strip()
        if not song_id:
            messagebox.showwarning("提示", "请输入歌曲ID")
            return
        match = re.search(r'(\d+)', song_id)
        if match:
            song_id = match.group(1)
        else:
            messagebox.showerror("错误", "请输入有效的数字ID")
            return
        
        self._set_buttons_state(False, include_extract=True)
        self._update_status(f"正在提取 ID: {song_id}...")
        self._update_progress(0, "提取中...")
        self._clear_info_display()
        thread = threading.Thread(target=self._extract_thread, args=(song_id,))
        thread.daemon = True
        thread.start()
    
    def _extract_thread(self, song_id):
        info, error = self._extract_song_info(song_id)
        self.root.after(0, self._on_extract_complete, info, error)
    
    def _extract_song_info(self, song_id):
        url = f"https://higequ.com/player/{song_id}/"
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            html = response.text
            
            # 歌名
            title = "未知歌名"
            match = re.search(r'<h2[^>]*id="music-title"[^>]*>([^<]+)</h2>', html)
            if match:
                title = match.group(1).strip()
            else:
                match = re.search(r'<title>([^<]+)</title>', html)
                if match:
                    title = match.group(1).replace('MP3下载', '').replace('在线试听', '').strip()
            
            # 歌手
            artist = "未知歌手"
            match = re.search(r'<span[^>]*id="music-artist"[^>]*>([^<]+)</span>', html)
            if match:
                artist = match.group(1).strip()
            
            # 专辑封面
            cover_url = None
            match = re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', html)
            if not match:
                match = re.search(r'<img[^>]*id="album-cover"[^>]*src="([^"]+)"', html)
            if match:
                cover_url = match.group(1)
            
            # 音频链接
            audio_url = None
            audio_format = None
            
            pattern1 = r'<source\s+src="([^"]+\.(?:mp3|aac|m4a|flac))"'
            match = re.search(pattern1, html, re.IGNORECASE)
            if match:
                audio_url = match.group(1)
                audio_format = os.path.splitext(audio_url)[1].lower()
            
            if not audio_url:
                pattern2 = r'https?://[^\s"\']+\.mp3'
                match = re.search(pattern2, html, re.IGNORECASE)
                if match:
                    audio_url = match.group(0)
                    audio_format = ".mp3"
            
            if not audio_url:
                pattern3 = r'https?://[^\s"\']+kuwo\.cn[^\s"\']+\.(?:aac|mp3|m4a)'
                match = re.search(pattern3, html, re.IGNORECASE)
                if match:
                    audio_url = match.group(0)
                    audio_format = os.path.splitext(audio_url)[1].lower()
            
            # 歌词
            lyrics = []
            for match in re.finditer(r'<div class="lyric-line"[^>]*>([^<]+)</div>', html):
                lyrics.append(match.group(1).strip())
            
            if not audio_url:
                return None, "未找到音频链接（可能歌曲已下架）"
            
            return {
                'title': title,
                'artist': artist,
                'audio_url': audio_url,
                'audio_format': audio_format,
                'song_id': song_id,
                'lyrics': lyrics or ["暂无歌词"],
                'page_url': url,
                'cover_url': cover_url
            }, None
            
        except Exception as e:
            return None, str(e)
    
    def _on_extract_complete(self, info, error):
        self._update_progress(100, "完成")
        
        if error:
            self._show_info_message(f"提取失败：{error}\n\n可能原因：\n1. 歌曲ID不存在\n2. 网络连接问题", is_error=True)
            self._set_buttons_state(True, include_extract=True)
            self._update_status(f"提取失败：{error}")
            return
        
        self.current_song_info = info
        audio_format = info.get('audio_format', '.mp3')
        is_mp3 = audio_format == '.mp3'
        
        # 加载专辑封面
        if info.get('cover_url'):
            self._load_cover_image(info['cover_url'])
        else:
            self.cover_label.config(text="暂无封面", image="")
        
        format_info = f"【音频格式】{audio_format.upper()}"
        if not is_mp3:
            format_info += "\nℹ️ 提示：此格式大多数音乐播放器（QQ音乐、网易云、VLC等）都支持，可直接播放。如需MP3格式，可点击转换按钮。"
        
        self._show_info_message(
            f"【歌曲名称】{info['title']}\n"
            f"【演唱歌手】{info['artist']}\n"
            f"【歌曲ID】{info['song_id']}\n"
            f"{format_info}\n\n"
            f"【音频链接】\n{info['audio_url']}"
        )
        
        self.lyrics_text.config(state=tk.NORMAL)
        self.lyrics_text.delete(1.0, tk.END)
        for line in info['lyrics']:
            self.lyrics_text.insert(tk.END, f"{line}\n")
        self.lyrics_text.config(state=tk.DISABLED)
        
        self.download_mp3_btn.config(state=tk.NORMAL)
        self.download_lrc_btn.config(state=tk.NORMAL)
        
        if is_mp3:
            self.convert_to_mp3_btn.config(state=tk.DISABLED)
            self.format_warning_label.config(text="✓ 已是MP3格式，无需转换")
        else:
            self.convert_to_mp3_btn.config(state=tk.NORMAL)
            self.format_warning_label.config(text=f"⚠️ 当前为{audio_format.upper()}格式，可转换为MP3")
        
        self._set_buttons_state(True, include_extract=True)
        self._update_status(f"✓ {info['title']} - {info['artist']} ({audio_format.upper()})")
    
    def _load_cover_image(self, url):
        def load():
            try:
                headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                response = requests.get(url, headers=headers, timeout=10)
                response.raise_for_status()
                image_data = response.content
                pil_image = Image.open(io.BytesIO(image_data))
                pil_image = pil_image.resize((200, 200), Image.Resampling.LANCZOS)
                photo = ImageTk.PhotoImage(pil_image)
                self.root.after(0, lambda: self._set_cover_image(photo))
            except Exception as e:
                print(f"加载封面失败: {e}")
        
        thread = threading.Thread(target=load)
        thread.daemon = True
        thread.start()
    
    def _set_cover_image(self, photo):
        self.album_photo = photo
        self.cover_label.config(image=photo, text="")
    
    # ==================== 下载功能 ====================
    
    def download_audio(self):
        if not self.current_song_info:
            return
        
        from tkinter import filedialog
        
        url = self.current_song_info['audio_url']
        audio_format = self.current_song_info.get('audio_format', '.mp3')
        format_name = audio_format.upper().replace('.', '')
        
        filename = filedialog.asksaveasfilename(
            defaultextension=audio_format,
            filetypes=[(f"{format_name}音频文件", f"*{audio_format}"), ("所有文件", "*.*")],
            initialfile=f"{self.current_song_info['title']} - {self.current_song_info['artist']}{audio_format}"
        )
        
        if not filename:
            return
        
        try:
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            resp_head = requests.head(url, headers=headers, timeout=10)
            total_size = int(resp_head.headers.get('content-length', 0))
        except:
            total_size = 0
        
        progress_window = DownloadProgressWindow(self.root, self.current_song_info['title'], total_size)
        progress_window.show()
        
        self._set_buttons_state(False, include_download=True)
        self._update_status(f"正在下载：{self.current_song_info['title']}...")
        
        thread = threading.Thread(target=self._download_thread_with_progress, args=(url, filename, progress_window))
        thread.daemon = True
        thread.start()
    
    def _download_thread_with_progress(self, url, filename, progress_window):
        try:
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            response = requests.get(url, headers=headers, stream=True, timeout=30)
            response.raise_for_status()
            
            total = int(response.headers.get('content-length', 0))
            downloaded = 0
            start_time = None
            cancelled = False
            
            with open(filename, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if progress_window.is_cancelled():
                        cancelled = True
                        break
                    
                    if chunk:
                        if start_time is None:
                            start_time = time.time()
                        f.write(chunk)
                        downloaded += len(chunk)
                        elapsed = time.time() - start_time
                        speed = downloaded / elapsed / 1024 if elapsed > 0 else 0
                        progress_window.update(downloaded, speed)
            
            if cancelled or progress_window.is_cancelled():
                progress_window.close()
                self.root.after(0, lambda: self._update_status("下载已取消"))
                self.root.after(0, lambda: self._set_buttons_state(True, include_download=True))
                self.root.after(0, lambda: messagebox.showinfo("下载已取消", "下载已取消"))
                if os.path.exists(filename):
                    os.remove(filename)
                return
            
            progress_window.complete()
            self.root.after(0, lambda: self._on_download_complete(True, filename))
        except Exception as e:
            if progress_window.is_cancelled():
                progress_window.close()
                self.root.after(0, lambda: self._update_status("下载已取消"))
                self.root.after(0, lambda: self._set_buttons_state(True, include_download=True))
                self.root.after(0, lambda: messagebox.showinfo("下载已取消", "下载已取消"))
                if os.path.exists(filename):
                    os.remove(filename)
            else:
                progress_window.close()
                self.root.after(0, lambda err=str(e): self._on_download_complete(False, err))
    
    def download_lrc(self):
        if not self.current_song_info:
            return
        from tkinter import filedialog
        filename = filedialog.asksaveasfilename(
            defaultextension=".lrc",
            filetypes=[("LRC歌词文件", "*.lrc")],
            initialfile=f"{self.current_song_info['title']} - {self.current_song_info['artist']}.lrc"
        )
        if not filename:
            return
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(f"[ti:{self.current_song_info['title']}]\n")
                f.write(f"[ar:{self.current_song_info['artist']}]\n")
                f.write(f"[by:907班音乐工具]\n\n")
                for line in self.current_song_info['lyrics']:
                    f.write(f"{line}\n")
            self._update_status(f"✓ 歌词已保存")
            messagebox.showinfo("完成", f"歌词已保存到：\n{filename}")
        except Exception as e:
            self._update_status(f"保存失败：{e}")
            messagebox.showerror("错误", f"保存失败：{e}")
    
    def _on_download_complete(self, success, message):
        self._set_buttons_state(True, include_download=True)
        self._update_progress(100, "完成")
        if success:
            self._update_status(f"✓ 下载完成")
            result = messagebox.askyesno("下载完成", f"文件已保存到：\n{message}\n\n是否打开所在文件夹？")
            if result:
                os.startfile(os.path.dirname(message))
        else:
            self._update_status(f"下载失败：{message}")
            messagebox.showerror("下载失败", f"下载失败：{message}")
    
    # ==================== 转换功能 ====================
    
    def convert_to_mp3(self):
        if not self.current_song_info:
            return
        
        audio_format = self.current_song_info.get('audio_format', '')
        if audio_format == '.mp3':
            messagebox.showinfo("提示", "当前已是MP3格式，无需转换")
            return
        
        if not FFmpegInstaller.is_installed():
            result = messagebox.askyesno(
                "需要安装FFmpeg",
                f"要将{audio_format.upper()}格式转换为MP3，需要安装FFmpeg。\n\n"
                "FFmpeg是开源的音视频处理工具，安装包约30MB。\n\n"
                "是否立即下载并安装FFmpeg？\n\n"
                "（安装后需要重启本程序才能使用转换功能）"
            )
            if result:
                self.install_ffmpeg_and_convert()
            return
        
        # 直接下载并转换
        self.download_and_convert()
    
    def install_ffmpeg_and_convert(self):
        install_window = tk.Toplevel(self.root)
        install_window.title("安装FFmpeg")
        install_window.geometry("400x180")
        install_window.transient(self.root)
        install_window.grab_set()
        
        install_window.update_idletasks()
        x = self.root.winfo_x() + (self.root.winfo_width() // 2) - 200
        y = self.root.winfo_y() + (self.root.winfo_height() // 2) - 90
        install_window.geometry(f"+{x}+{y}")
        
        main_frame = ttk.Frame(install_window, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        title_label = ttk.Label(main_frame, text="正在安装FFmpeg...", font=("微软雅黑", 10, "bold"))
        title_label.pack(pady=(0, 15))
        
        progress_bar = ttk.Progressbar(main_frame, mode='determinate', length=350)
        progress_bar.pack(pady=(0, 10))
        
        progress_label = ttk.Label(main_frame, text="0%")
        progress_label.pack()
        
        status_label = ttk.Label(main_frame, text="准备下载...", foreground="gray")
        status_label.pack(pady=(10, 0))
        
        def update_progress(value, status):
            progress_bar['value'] = value
            progress_label.config(text=f"{value}%")
            status_label.config(text=status)
            install_window.update_idletasks()
        
        def install_thread():
            success, msg = FFmpegInstaller.install(self.root, update_progress)
            install_window.after(0, install_window.destroy)
            if success:
                self.root.after(0, lambda: messagebox.showinfo("安装成功", "FFmpeg安装成功！\n\n现在可以进行转换。"))
                self.root.after(0, self.download_and_convert)
            else:
                self.root.after(0, lambda: messagebox.showerror("安装失败", msg))
        
        thread = threading.Thread(target=install_thread)
        thread.daemon = True
        thread.start()
    
    def download_and_convert(self):
        # 下载原始文件到临时目录，然后转换为MP3
        if not self.current_song_info:
            return
        
        from tkinter import filedialog
        
        # 选择保存位置
        output_file = filedialog.asksaveasfilename(
            defaultextension=".mp3",
            filetypes=[("MP3文件", "*.mp3")],
            initialfile=f"{self.current_song_info['title']} - {self.current_song_info['artist']}.mp3"
        )
        
        if not output_file:
            return
        
        # 创建临时文件
        temp_dir = tempfile.gettempdir()
        audio_format = self.current_song_info.get('audio_format', '.mp3')
        temp_file = os.path.join(temp_dir, f"temp_audio_{int(time.time())}{audio_format}")
        
        self._update_status(f"正在下载原始文件...")
        
        # 先下载
        def download_and_convert_thread():
            try:
                # 下载
                headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                response = requests.get(self.current_song_info['audio_url'], headers=headers, stream=True, timeout=30)
                response.raise_for_status()
                
                with open(temp_file, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                
                self.root.after(0, lambda: self._update_status(f"正在转换为MP3..."))
                
                # 转换
                conv_window = ConvertProgressWindow(self.root, self.current_song_info['title'])
                conv_window.show()
                
                success = FFmpegInstaller.convert_to_mp3(temp_file, output_file, conv_window.update_progress)
                conv_window.complete(success)
                
                # 清理临时文件
                if os.path.exists(temp_file):
                    os.remove(temp_file)
                
                if success:
                    self.root.after(0, lambda: self._update_status("转换完成"))
                    result = messagebox.askyesno("转换完成", f"MP3文件已保存到：\n{output_file}\n\n是否打开所在文件夹？")
                    if result:
                        os.startfile(os.path.dirname(output_file))
                else:
                    self.root.after(0, lambda: messagebox.showerror("转换失败", "转换失败，请检查文件格式是否正确"))
                    self.root.after(0, lambda: self._update_status("转换失败"))
                    
            except Exception as e:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
                self.root.after(0, lambda: messagebox.showerror("错误", f"处理失败：{str(e)}"))
                self.root.after(0, lambda: self._update_status("转换失败"))
        
        thread = threading.Thread(target=download_and_convert_thread)
        thread.daemon = True
        thread.start()
    
    def open_browser(self):
        if self.current_song_info and self.current_song_info.get('page_url'):
            webbrowser.open(self.current_song_info['page_url'])
        else:
            webbrowser.open("https://higequ.com")
    
    # ==================== 辅助函数 ====================
    
    def _set_buttons_state(self, enabled, include_extract=False, include_download=False):
        state = tk.NORMAL if enabled else tk.DISABLED
        if include_extract:
            self.extract_btn.config(state=state)
            self.search_btn.config(state=state)
        else:
            self.extract_btn.config(state=state)
            self.search_btn.config(state=state)
        if include_download:
            self.download_mp3_btn.config(state=state)
            self.download_lrc_btn.config(state=state)
    
    def _update_status(self, message, is_error=False):
        self.status_var.set(message)
    
    def _update_progress(self, value, text=""):
        self.progress_var.set(value)
        self.progress_label.config(text=text)
        self.root.update_idletasks()
    
    def _clear_info_display(self):
        self.info_text.config(state=tk.NORMAL)
        self.info_text.delete(1.0, tk.END)
        self.info_text.config(state=tk.DISABLED)
        self.lyrics_text.config(state=tk.NORMAL)
        self.lyrics_text.delete(1.0, tk.END)
        self.lyrics_text.config(state=tk.DISABLED)
        self.download_mp3_btn.config(state=tk.DISABLED)
        self.download_lrc_btn.config(state=tk.DISABLED)
        self.convert_to_mp3_btn.config(state=tk.DISABLED)
        self.format_warning_label.config(text="")
        self.cover_label.config(text="暂无封面", image="")
        self.album_photo = None
    
    def _show_info_message(self, message, is_error=False):
        self.info_text.config(state=tk.NORMAL)
        self.info_text.delete(1.0, tk.END)
        tag = "error" if is_error else "label"
        self.info_text.insert(tk.END, message, tag)
        self.info_text.config(state=tk.DISABLED)


def main():
    root = tk.Tk()
    app = MusicDownloaderGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()