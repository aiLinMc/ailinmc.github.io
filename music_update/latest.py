#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
音乐播放器
仅供顺德一中内部使用，严禁对外传播
保留所有权利 (C) 2026 aiLinMc，侵权必究

歌曲数据来源：Hi歌曲网 - https://higequ.com/
音乐图标 by iynque (Andrew Williams)，遵循 CC BY-NC-ND 4.0 许可
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, simpledialog, filedialog, colorchooser
import requests
import json
import re
import threading
import webbrowser
import os
import sys
import shutil
import tempfile
import ssl
import subprocess
import platform
import time
import ctypes
from urllib.parse import quote
from PIL import Image, ImageTk
import io
import base64
import hashlib


# 禁用SSL警告
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ==================== 版本配置 ====================
CURRENT_INTERNAL_VERSION = "10"  # 内部版本号（纯数字，用于比较）
CURRENT_DISPLAY_VERSION = "v2.0.0"  # 显示版本号（展示给用户）
# 更新下载地址（按优先级排列，主域名在前，自动切换备用域名）
UPDATE_DOWNLOAD_URLS = [
    "https://www.ailinmc.top/music_update/",   # 主域名
    "https://lzcnb.netlify.app/music_update/", # 备用域名1
    "https://ailinmc.github.io/music_update/", # 备用域名2
]


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
    """FFmpeg工具 - 检测和调用，不提供自动下载安装"""

    @staticmethod
    def _verify_ffmpeg(ffmpeg_path):
        """验证ffmpeg可执行文件是否实际可用"""
        try:
            creationflags = subprocess.CREATE_NO_WINDOW if platform.system() == 'Windows' else 0
            result = subprocess.run(
                [ffmpeg_path, "-version"],
                capture_output=True, text=True, encoding='utf-8', errors='ignore',
                timeout=10, creationflags=creationflags
            )
            return result.returncode == 0
        except Exception:
            return False

    @staticmethod
    def is_installed():
        """检查ffmpeg是否已安装且实际可用"""
        ffmpeg_path = get_ffmpeg_path()
        if ffmpeg_path and os.path.exists(ffmpeg_path):
            if FFmpegInstaller._verify_ffmpeg(ffmpeg_path):
                return True
            return False
        # 检查系统PATH中是否有ffmpeg
        try:
            creationflags = subprocess.CREATE_NO_WINDOW if platform.system() == 'Windows' else 0
            subprocess.run(
                ["ffmpeg", "-version"],
                capture_output=True, text=True, encoding='utf-8', errors='ignore',
                timeout=5, creationflags=creationflags
            )
            return True
        except Exception:
            return False

    @staticmethod
    def convert_to_mp3(input_path, output_path, progress_callback=None):
        ffmpeg_path = get_ffmpeg_path()
        if not ffmpeg_path or not os.path.exists(ffmpeg_path):
            ffmpeg_path = "ffmpeg"

        cmd = [ffmpeg_path, "-i", input_path, "-acodec", "libmp3lame", "-q:a", "2", output_path, "-y"]

        if progress_callback:
            progress_callback(0, "开始转换...")

        try:
            creationflags = subprocess.CREATE_NO_WINDOW if platform.system() == 'Windows' else 0
            process = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True, encoding='utf-8', errors='ignore', creationflags=creationflags
            )
            stdout, stderr = process.communicate()
        except FileNotFoundError:
            if progress_callback:
                progress_callback(0, "ffmpeg未安装")
            return False

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
    def is_version_newer(remote_version, local_version):
        """比较内部版本号：提取数字后比较，避免 "9" > "10" 这类字符串比较错误"""
        remote_digits = re.sub(r'\D', '', str(remote_version or ''))
        local_digits = re.sub(r'\D', '', str(local_version or ''))
        if remote_digits and local_digits:
            return int(remote_digits) > int(local_digits)
        return str(remote_version or '') > str(local_version or '')

    @staticmethod
    def check_for_updates():
        session = UpdateChecker.get_session_with_retry()
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        last_error = None
        # 按优先级依次尝试各更新域名，第一个可用的即返回结果
        for base_url in UPDATE_DOWNLOAD_URLS:
            try:
                response = session.get(base_url + "music_version.txt", headers=headers, timeout=20)
                
                if response.status_code != 200:
                    continue
                
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
                
                has_update = UpdateChecker.is_version_newer(internal_version, CURRENT_INTERNAL_VERSION)
                
                return has_update, internal_version, display_version, latest_changelog.strip(), historical_changelog.strip()
            except Exception as e:
                last_error = e
                print(f"检查更新失败({base_url}): {e}")
        print(f"检查更新失败: {last_error}")
        return False, None, None, None, None
    
    @staticmethod
    def _download_file_with_stall_check(session, url, headers, target_path,
                                        progress_start, progress_span, label,
                                        progress_callback, cancel_callback,
                                        stall_timeout=20):
        """下载单个文件，仅当下载进度停滞不动时才判定超时。

        这里的“进度”指下载进度百分比（如“下载最新程序 37%”中的37），
        而不是更新总进度条（10-50/60-90）。只有下载百分比停留在一个整数上、
        且超过stall_timeout秒没有变化时才判定卡死并超时；
        下载进度在涨时绝不触发“下载失败、检查网络”的提示。
        """
        resp = session.get(url, headers=headers, stream=True, timeout=(10, 60))
        resp.raise_for_status()
        total_size = int(resp.headers.get('content-length', 0))
        downloaded = 0
        last_pct = None              # 上次的下载进度百分比（整数）
        last_pct_time = time.time()  # 下载进度百分比最后变化的时间
        with open(target_path, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if cancel_callback and cancel_callback():
                    print("下载已取消")
                    return False
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        pct = int(downloaded / total_size * 100)
                        if pct != last_pct:
                            last_pct = pct
                            last_pct_time = time.time()  # 下载进度在涨，刷新计时
                        if progress_callback:
                            progress = progress_start + int((downloaded / total_size) * progress_span)
                            progress_callback(progress, f"{label} {pct}%")
                        # 停滞检测：下载进度卡在某个整数百分比不动才判超时
                        if time.time() - last_pct_time > stall_timeout:
                            raise TimeoutError(f"下载停滞：下载进度停留在 {pct}% 长时间未变化")
        return True
    
    @staticmethod
    def download_update_files(progress_callback=None, cancel_callback=None):
        temp_dir = tempfile.gettempdir()
        latest_exe_path = os.path.join(temp_dir, "latest.exe")
        update_exe_path = os.path.join(temp_dir, "update.exe")
        
        try:
            session = UpdateChecker.get_session_with_retry()
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            
            # 按优先级依次尝试各更新域名，探测到可用的域名后用于下载
            working_url = None
            for candidate_url in UPDATE_DOWNLOAD_URLS:
                try:
                    probe = session.get(candidate_url + "latest.exe", headers=headers, stream=True, timeout=15)
                    if probe.status_code == 200:
                        working_url = candidate_url
                        probe.close()
                        break
                    probe.close()
                except Exception as e:
                    print(f"域名不可用({candidate_url}): {e}")
            
            if working_url is None:
                raise Exception("所有更新域名均不可用")
            
            if progress_callback:
                progress_callback(10, "正在下载最新程序...")
            
            if not UpdateChecker._download_file_with_stall_check(
                    session, working_url + "latest.exe", headers, latest_exe_path,
                    10, 40, "下载最新程序", progress_callback, cancel_callback):
                return None, None
            
            if cancel_callback and cancel_callback():
                print("下载已取消")
                return None, None
            
            if progress_callback:
                progress_callback(60, "正在下载更新程序...")
            
            if not UpdateChecker._download_file_with_stall_check(
                    session, working_url + "update.exe", headers, update_exe_path,
                    60, 30, "下载更新程序", progress_callback, cancel_callback):
                return None, None
            
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


# ==================== 本地数据与播放基础设施 ====================

DATA_DIR_NAME = ".aiLinMcMusicPlayer"
CACHE_MAX_BYTES = 600 * 1024 * 1024  # 播放缓存上限（600MB），超出后自动清理最旧的缓存
COVER_CACHE_MAX_BYTES = 100 * 1024 * 1024  # 封面缓存上限（100MB）
COVER_SIZE = 180  # 封面显示尺寸（像素）

# 歌词与界面配置的默认值（在「播放 → 歌词设置」中修改，保存于 library.json）
DEFAULT_SETTINGS = {
    "lyric_current_color": "#00E5FF",  # 桌面歌词当前行颜色
    "lyric_normal_color": "#BBBBBB",   # 桌面歌词普通行颜色
    "lyric_bg_color": "#000000",       # 桌面歌词背景色
    "lyric_bg_alpha": 82,              # 桌面歌词背景不透明度（0-100，0 为完全透明）
    "lyric_text_alpha": 100,           # 桌面歌词文字不透明度（5-100，与背景独立）
    "lyric_current_size": 20,          # 桌面歌词当前行字号
    "lyric_next_size": 12,             # 桌面歌词下一行字号
    "lyric_outline": True,             # 桌面歌词描边开关
    "lyric_outline_color": "#000000",  # 桌面歌词描边颜色
    "lyric_outline_width": 2,          # 桌面歌词描边粗细（像素）
    "lyric_window_width": 760,         # 桌面歌词窗口宽度
    "lyric_show_next": True,           # 桌面歌词显示下一行预览
    "ui_lyric_size": 11,               # 界面歌词字号
}


def get_data_dir():
    """用户目录下的数据文件夹（存放歌单与播放缓存）"""
    path = os.path.join(os.path.expanduser("~"), DATA_DIR_NAME)
    try:
        os.makedirs(path, exist_ok=True)
    except Exception as e:
        print(f"创建数据目录失败: {e}")
    return path


def format_ms(milliseconds):
    """毫秒 -> mm:ss"""
    try:
        total = max(0, int(milliseconds)) // 1000
    except Exception:
        total = 0
    return f"{total // 60:02d}:{total % 60:02d}"


def fit_image_in_box(image, box_size=COVER_SIZE):
    """按原始比例缩放图片，使其完整放入 box_size x box_size 的方框内（不拉伸变形）"""
    width, height = image.size
    if width <= 0 or height <= 0:
        return image
    scale = min(box_size / width, box_size / height)
    return image.resize((max(1, int(width * scale)), max(1, int(height * scale))),
                        Image.Resampling.LANCZOS)


def blend_color(color_from, color_to, ratio):
    """在两种颜色之间按比例插值（用于歌词淡入淡出动画）"""
    def parse(color):
        text = str(color).lstrip('#')
        return int(text[0:2], 16), int(text[2:4], 16), int(text[4:6], 16)

    try:
        start, end = parse(color_from), parse(color_to)
    except (ValueError, IndexError):
        return color_to
    ratio = max(0.0, min(1.0, ratio))
    return '#%02x%02x%02x' % tuple(int(start[i] + (end[i] - start[i]) * ratio) for i in range(3))


def outline_offsets(radius):
    """按描边粗细生成 8 个方向的偏移点"""
    radius = int(radius or 0)
    if radius <= 0:
        return []
    return [(-radius, 0), (radius, 0), (0, -radius), (0, radius),
            (-radius, -radius), (radius, -radius), (-radius, radius), (radius, radius)]


def dir_total_size(root_dir):
    """目录内文件总大小（字节）"""
    total = 0
    try:
        for name in os.listdir(root_dir):
            path = os.path.join(root_dir, name)
            if os.path.isfile(path):
                total += os.path.getsize(path)
    except Exception:
        pass
    return total


def clear_dir(root_dir):
    """删除目录内的所有文件"""
    try:
        for name in os.listdir(root_dir):
            path = os.path.join(root_dir, name)
            if os.path.isfile(path):
                try:
                    os.remove(path)
                except Exception:
                    pass
    except Exception as e:
        print(f"清空目录失败: {e}")


def cleanup_cache_dir(root_dir, max_bytes, keep_ratio=0.85):
    """超过上限时按最后访问时间从旧到新清理目录内的文件"""
    files = []
    try:
        for name in os.listdir(root_dir):
            path = os.path.join(root_dir, name)
            if os.path.isfile(path):
                files.append((os.path.getmtime(path), os.path.getsize(path), path))
    except Exception:
        return
    total = sum(size for _, size, _ in files)
    if total <= max_bytes:
        return
    limit = int(max_bytes * keep_ratio)
    files.sort()
    for _, size, path in files:
        if total <= limit:
            break
        try:
            os.remove(path)
            total -= size
        except Exception:
            pass


class MusicLibrary:
    """歌单 / 最近播放 / 歌曲信息 / 配置项的本地持久化"""

    def __init__(self):
        self.path = os.path.join(get_data_dir(), "library.json")
        self.song_db = {}      # song_id -> 歌曲信息
        self.playlists = {}    # 歌单名 -> [song_id, ...]
        self.history = []      # 最近播放的 song_id，最新在前
        self.settings = dict(DEFAULT_SETTINGS)  # 歌词与界面配置
        self.load()

    def load(self):
        try:
            if os.path.exists(self.path):
                with open(self.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.song_db = data.get("song_db") or {}
                self.playlists = data.get("playlists") or {}
                self.history = data.get("history") or []
                self.settings.update(data.get("settings") or {})
        except Exception as e:
            print(f"读取本地数据失败: {e}")
        if not self.playlists:
            self.playlists = {"我的歌单": []}

    def save(self):
        try:
            data = {"song_db": self.song_db, "playlists": self.playlists,
                    "history": self.history, "settings": self.settings}
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=1)
        except Exception as e:
            print(f"保存本地数据失败: {e}")

    # ---------- 配置项 ----------

    def get_settings(self):
        """返回完整配置（缺失项用默认值补齐）"""
        merged = dict(DEFAULT_SETTINGS)
        merged.update(self.settings or {})
        return merged

    def update_settings(self, values):
        merged = self.get_settings()
        merged.update(values or {})
        self.settings = merged
        self.save()
        return merged

    # ---------- 歌曲信息 ----------

    def add_song(self, info):
        """保存/合并歌曲信息（空值不覆盖已有内容）"""
        if not info:
            return None
        song_id = str(info.get("song_id") or "").strip()
        if not song_id:
            return None
        merged = dict(self.song_db.get(song_id) or {})
        for key, value in info.items():
            if value not in (None, "", [], {}):
                merged[key] = value
        merged["song_id"] = song_id
        self.song_db[song_id] = merged
        self.save()
        return merged

    def get_song(self, song_id):
        return self.song_db.get(str(song_id))

    # ---------- 歌单 ----------

    def create_playlist(self, name):
        name = (name or "").strip()
        if not name or name in ("搜索结果", "最近播放") or name in self.playlists:
            return False
        self.playlists[name] = []
        self.save()
        return True

    def delete_playlist(self, name):
        if name in self.playlists:
            del self.playlists[name]
            self.save()
            return True
        return False

    def add_to_playlist(self, name, song):
        if name not in self.playlists:
            return False
        song_id = str(song.get("song_id"))
        self.add_song(song)
        if song_id not in self.playlists[name]:
            self.playlists[name].append(song_id)
            self.save()
        return True

    def remove_from_playlist(self, name, song_id):
        if name in self.playlists and song_id in self.playlists[name]:
            self.playlists[name].remove(song_id)
            self.save()
            return True
        return False

    def move_in_playlist(self, name, song_id, delta):
        song_ids = self.playlists.get(name)
        if not song_ids or song_id not in song_ids:
            return False
        index = song_ids.index(song_id)
        new_index = index + delta
        if new_index < 0 or new_index >= len(song_ids):
            return False
        song_ids.pop(index)
        song_ids.insert(new_index, song_id)
        self.save()
        return True

    # ---------- 播放历史 ----------

    def push_history(self, song_id):
        if not song_id:
            return
        song_id = str(song_id)
        if song_id in self.history:
            self.history.remove(song_id)
        self.history.insert(0, song_id)
        del self.history[100:]
        self.save()


class AudioCache:
    """播放缓存：按 song_id 保存音频文件，超出上限自动清理最旧的"""

    def __init__(self, root_dir, max_bytes=CACHE_MAX_BYTES):
        self.root_dir = root_dir
        self.max_bytes = max_bytes
        try:
            os.makedirs(self.root_dir, exist_ok=True)
        except Exception as e:
            print(f"创建缓存目录失败: {e}")

    def find(self, song_id):
        """查找已缓存的音频文件，没有则返回 None"""
        if not song_id:
            return None
        song_id = str(song_id)
        try:
            for name in os.listdir(self.root_dir):
                base, _ = os.path.splitext(name)
                if base == song_id:
                    path = os.path.join(self.root_dir, name)
                    if os.path.getsize(path) > 0:
                        return path
        except Exception as e:
            print(f"查找缓存失败: {e}")
        return None

    def touch(self, path):
        """刷新访问时间，避免正在播放的文件被清理"""
        try:
            os.utime(path, None)
        except Exception:
            pass

    def download(self, url, song_id, audio_format=None, progress_callback=None, cancel_check=None):
        """下载音频到缓存目录，返回缓存文件路径"""
        ext = audio_format or ".mp3"
        path = os.path.join(self.root_dir, f"{song_id}{ext}")
        temp_path = path + ".part"
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        try:
            with requests.get(url, headers=headers, stream=True, timeout=(10, 60)) as response:
                response.raise_for_status()
                total = int(response.headers.get('content-length', 0))
                downloaded = 0
                with open(temp_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if cancel_check and cancel_check():
                            raise Exception("已取消")
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                            if progress_callback:
                                progress_callback(downloaded, total)
            os.replace(temp_path, path)
        except Exception:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass
            raise
        self.cleanup()
        return path

    def total_size(self):
        return dir_total_size(self.root_dir)

    def cleanup(self):
        """超过上限时按最后访问时间从旧到新清理"""
        cleanup_cache_dir(self.root_dir, self.max_bytes)

    def clear(self):
        clear_dir(self.root_dir)


class CoverCache:
    """封面图片磁盘缓存：按链接哈希保存，超出上限自动清理最旧的"""

    def __init__(self, root_dir, max_bytes=COVER_CACHE_MAX_BYTES):
        self.root_dir = root_dir
        self.max_bytes = max_bytes
        try:
            os.makedirs(self.root_dir, exist_ok=True)
        except Exception as e:
            print(f"创建封面缓存目录失败: {e}")

    def path_for(self, url):
        return os.path.join(self.root_dir, hashlib.md5(str(url).encode("utf-8")).hexdigest() + ".img")

    def get(self, url):
        """读取已缓存的封面数据，未缓存则返回 None"""
        if not url:
            return None
        path = self.path_for(url)
        try:
            if os.path.getsize(path) > 0:
                os.utime(path, None)  # 刷新访问时间，避免被清理
                with open(path, "rb") as f:
                    return f.read()
        except Exception:
            pass
        return None

    def put(self, url, data):
        if not (url and data):
            return
        try:
            with open(self.path_for(url), "wb") as f:
                f.write(data)
        except Exception as e:
            print(f"写入封面缓存失败: {e}")
            return
        cleanup_cache_dir(self.root_dir, self.max_bytes)

    def total_size(self):
        return dir_total_size(self.root_dir)

    def clear(self):
        clear_dir(self.root_dir)


class MciPlayer:
    """基于 Windows MCI 的音频播放器（无第三方依赖）"""

    def __init__(self):
        self.alias = "mci_player"
        self._opened = False
        self._volume = 800

    def _command(self, command):
        try:
            return ctypes.windll.winmm.mciSendStringW(command, None, 0, None)
        except Exception as e:
            print(f"MCI命令失败({command}): {e}")
            return -1

    def _query(self, command):
        try:
            buffer = ctypes.create_unicode_buffer(256)
            if ctypes.windll.winmm.mciSendStringW(command, buffer, 256, None) != 0:
                return ""
            return buffer.value.strip()
        except Exception:
            return ""

    def open(self, path):
        """打开音频文件，成功返回 True"""
        self.close()
        path = os.path.abspath(path)
        if self._command(f'open "{path}" alias {self.alias}') == 0:
            self._opened = True
        elif self._command(f'open "{path}" type mpegvideo alias {self.alias}') == 0:
            self._opened = True
        if self._opened:
            self.set_volume(self._volume / 10)
        return self._opened

    def play(self, from_ms=None):
        if not self._opened:
            return False
        if from_ms is None:
            return self._command(f'play {self.alias}') == 0
        return self._command(f'play {self.alias} from {int(from_ms)}') == 0

    def pause(self):
        return self._opened and self._command(f'pause {self.alias}') == 0

    def resume(self):
        if not self._opened:
            return False
        if self._command(f'resume {self.alias}') == 0:
            return True
        return self._command(f'play {self.alias} from {self.position_ms()}') == 0

    def stop(self):
        if self._opened:
            self._command(f'stop {self.alias}')

    def close(self):
        if self._opened:
            self._command(f'stop {self.alias}')
            self._command(f'close {self.alias}')
            self._opened = False

    def is_open(self):
        return self._opened

    def mode(self):
        return self._query(f'status {self.alias} mode').lower()

    def position_ms(self):
        try:
            return int(self._query(f'status {self.alias} position') or 0)
        except Exception:
            return 0

    def duration_ms(self):
        try:
            return int(self._query(f'status {self.alias} length') or 0)
        except Exception:
            return 0

    def seek(self, milliseconds):
        """跳转到指定毫秒位置（MCI 的 seek 会中断播放，需按跳转前的状态恢复）"""
        if not self._opened:
            return False
        # 必须先记录状态：seek 之后 status mode 会变成 stopped
        was_playing = (self.mode() == "playing")
        self._command(f'seek {self.alias} to {int(milliseconds)}')
        if was_playing:
            self._command(f'play {self.alias}')
        return True

    def set_volume(self, percent):
        try:
            self._volume = int(max(0, min(100, float(percent))) * 10)
        except Exception:
            self._volume = 800
        if self._opened:
            self._command(f'setaudio {self.alias} volume to {self._volume}')


class DesktopLyricsWindow:
    """桌面歌词：无边框、置顶、可鼠标拖动的独立窗口

    背景层与文字层分成两个窗口：背景层的不透明度可单独设置（0-100 完全透明），
    文字层用 transparentcolor 抠掉底色，因此文字始终清晰、不受背景透明度影响。
    """

    HEIGHT_WITH_NEXT = 116
    HEIGHT_ONLY_CURRENT = 68
    SLIDE = 22          # 换行时新内容上滑的像素距离
    ANIM_FRAMES = 9     # 过渡动画帧数
    ANIM_INTERVAL = 22  # 每帧间隔（毫秒）
    KEY_COLOR = "#010203"   # 文字层被抠掉的底色（取近黑色，描边处边缘不会发白）
    MIN_BG_ALPHA = 0.02     # 背景层最低不透明度，保证完全透明时仍能拖动、右键
    MIN_TEXT_ALPHA = 0.05   # 文字层最低不透明度

    def __init__(self, master, settings=None, on_closed=None):
        self.master = master
        self.settings = settings or {}
        self.on_closed = on_closed
        self.locked = False
        self._drag_offset = None
        self._anim_token = 0
        self.current_text = ""
        self.next_text = ""

        self._load_style()

        # 背景层：只负责底色，不透明度独立可调
        self.bg_win = tk.Toplevel(master)
        self.bg_win.overrideredirect(True)
        self.bg_win.attributes("-topmost", True)
        self.bg_win.configure(bg=self.bg_color)

        # 文字层：底色用透明色抠掉，文字不受背景透明度影响
        self.win = tk.Toplevel(master)
        self.win.overrideredirect(True)
        self.win.attributes("-topmost", True)
        self.win.configure(bg=self.KEY_COLOR)
        try:
            self.win.attributes("-transparentcolor", self.KEY_COLOR)
        except Exception as e:
            print(f"桌面歌词透明背景不可用: {e}")

        self.canvas = tk.Canvas(self.win, bg=self.KEY_COLOR, highlightthickness=0, bd=0,
                                width=self.width, height=self.HEIGHT_WITH_NEXT)
        self.canvas.pack()

        self.menu = tk.Menu(self.win, tearoff=0)
        self.menu.add_command(label="锁定位置", command=self.toggle_lock)
        self.menu.add_command(label="关闭桌面歌词", command=self.close)

        self._bind_events(self.canvas)
        self._bind_events(self.win)
        self._bind_events(self.bg_win)

        screen_width = self.win.winfo_screenwidth()
        screen_height = self.win.winfo_screenheight()
        x = max(0, (screen_width - self.width) // 2)
        y = max(0, screen_height - 240)
        self._x, self._y = x, y
        self._apply_alpha()
        self._update_geometry(has_next=True)
        self.win.lift()  # 文字层压在背景层之上

        self.set_lines("桌面歌词已开启", "播放歌曲后自动同步显示", animate=False)

    # ---------- 样式与配置 ----------

    def _load_style(self):
        """从配置读取颜色、字号、描边、透明度等样式"""
        values = dict(DEFAULT_SETTINGS)
        values.update(self.settings or {})

        def to_alpha(key, default):
            try:
                return max(0.0, min(1.0, float(values.get(key, default)) / 100.0))
            except (TypeError, ValueError):
                return default / 100.0

        # 背景不透明度：0 表示完全透明（仅保留极淡的可拖动区域）
        self.bg_alpha = max(self.MIN_BG_ALPHA, to_alpha("lyric_bg_alpha", 82))
        # 文字不透明度：与背景互相独立
        self.text_alpha = max(self.MIN_TEXT_ALPHA, to_alpha("lyric_text_alpha", 100))
        self.width = max(200, int(values.get("lyric_window_width") or 760))
        self.bg_color = str(values.get("lyric_bg_color") or "#000000")
        self.current_color = str(values.get("lyric_current_color") or "#00E5FF")
        self.normal_color = str(values.get("lyric_normal_color") or "#BBBBBB")
        self.outline_color = str(values.get("lyric_outline_color") or "#000000")
        self.outline_points = (outline_offsets(values.get("lyric_outline_width"))
                               if values.get("lyric_outline") else [])
        self.current_font = ("微软雅黑", int(values.get("lyric_current_size") or 20), "bold")
        self.next_font = ("微软雅黑", int(values.get("lyric_next_size") or 12))
        self.show_next = bool(values.get("lyric_show_next"))

    def _apply_alpha(self):
        """分别应用背景层与文字层的不透明度"""
        try:
            self.bg_win.attributes("-alpha", self.bg_alpha)
        except Exception:
            pass
        try:
            self.win.attributes("-alpha", self.text_alpha)
        except Exception:
            pass

    def apply_settings(self, settings):
        """配置变更后重新应用样式并重绘"""
        self.settings = settings or {}
        self._load_style()
        self._anim_token += 1
        self.bg_win.configure(bg=self.bg_color)
        self.canvas.config(width=self.width)
        self._apply_alpha()
        self.canvas.delete("all")
        self._update_geometry(bool(self.next_text) and self.show_next)
        self._draw_static(self.current_text, self.next_text)
        self.bg_win.lift()
        self.win.lift()

    # ---------- 窗口行为 ----------

    def _bind_events(self, widget):
        widget.bind("<ButtonPress-1>", self._on_press)
        widget.bind("<B1-Motion>", self._on_drag)
        widget.bind("<ButtonRelease-1>", lambda event: setattr(self, "_drag_offset", None))
        widget.bind("<Button-3>", self._show_menu)

    def _on_press(self, event):
        if self.locked:
            return
        self._drag_offset = (event.x_root - self._x, event.y_root - self._y)

    def _on_drag(self, event):
        if self.locked or not self._drag_offset:
            return
        self._x = event.x_root - self._drag_offset[0]
        self._y = event.y_root - self._drag_offset[1]
        self._move_to(self._x, self._y)

    def _move_to(self, x, y):
        """背景层与文字层同步移动"""
        try:
            self.bg_win.geometry(f"+{x}+{y}")
            self.win.geometry(f"+{x}+{y}")
        except Exception:
            pass

    def _show_menu(self, event):
        try:
            self.menu.tk_popup(event.x_root, event.y_root)
        finally:
            self.menu.grab_release()

    def alive(self):
        try:
            return bool(self.win.winfo_exists() and self.bg_win.winfo_exists())
        except Exception:
            return False

    def toggle_lock(self):
        self.locked = not self.locked
        self.menu.entryconfig(0, label="解锁位置" if self.locked else "锁定位置")
        self.set_lines(self.current_text, self.next_text, animate=False)

    def close(self):
        self._anim_token += 1
        for window in (self.win, self.bg_win):
            try:
                window.destroy()
            except Exception:
                pass
        if self.on_closed:
            self.on_closed()

    # ---------- 歌词绘制 ----------

    def _draw_block(self, text, y, font, color, record):
        """画一行歌词（含描边副本），并把 (元素, 目标颜色) 记录到 record"""
        center_x = self.width // 2
        text_width = max(80, self.width - 40)
        for dx, dy in self.outline_points:
            item = self.canvas.create_text(center_x + dx, y + dy, text=text, font=font,
                                           fill=self.outline_color, width=text_width,
                                           justify="center", tags="line")
            record.append((item, self.outline_color))
        item = self.canvas.create_text(center_x, y, text=text, font=font, fill=color,
                                       width=text_width, justify="center", tags="line")
        record.append((item, color))

    def _update_geometry(self, has_next):
        height = self.HEIGHT_WITH_NEXT if has_next else self.HEIGHT_ONLY_CURRENT
        self.canvas.config(height=height)
        try:
            self.bg_win.geometry(f"{self.width}x{height}+{self._x}+{self._y}")
            self.win.geometry(f"{self.width}x{height}+{self._x}+{self._y}")
        except Exception:
            pass

    def _draw_static(self, current, next_line):
        """按最终位置一次性画出当前行与下一行，返回 [(元素, 目标颜色)]"""
        record = []
        has_next = bool(next_line) and self.show_next
        current_y = 34 if has_next else self.HEIGHT_ONLY_CURRENT // 2
        self._draw_block(current, current_y, self.current_font, self.current_color, record)
        if has_next:
            self._draw_block(next_line, current_y + 46, self.next_font, self.normal_color, record)
        self._update_geometry(has_next)
        if self.locked:
            self.canvas.create_text(self.width - 18, 14, text="🔒", font=("微软雅黑", 9),
                                    fill="#888888", tags="lock")
        return record

    def set_lines(self, current, next_line, animate=True):
        """换行显示；animate=True 时旧内容上移淡出、新内容上滑淡入"""
        current = current or ""
        next_line = next_line or ""
        same = (current == self.current_text and next_line == self.next_text)
        self.current_text = current
        self.next_text = next_line
        self._anim_token += 1
        token = self._anim_token

        if same or not animate:
            self.canvas.delete("all")
            self._draw_static(current, next_line)
            return

        # 记录旧内容（含当前颜色）用于淡出，动画结束后删除
        old = []
        for item in self.canvas.find_all():
            if "lock" in self.canvas.gettags(item):
                continue
            self.canvas.dtag(item, "line")
            try:
                old.append((item, self.canvas.itemcget(item, "fill")))
            except Exception:
                pass
        self.canvas.delete("lock")

        # 新内容先按最终位置画好，再整体下移并隐藏（隐藏色用透明抠色，与背景色无关）
        record = self._draw_static(current, next_line)
        for item, _color in record:
            self.canvas.move(item, 0, self.SLIDE)
            self.canvas.itemconfig(item, fill=self.KEY_COLOR)

        frames = self.ANIM_FRAMES
        step = float(self.SLIDE) / frames

        def frame(k=1):
            if token != self._anim_token:
                return
            ratio = k / frames
            for item, color in old:
                try:
                    self.canvas.move(item, 0, -step)
                    self.canvas.itemconfig(item, fill=blend_color(color, self.KEY_COLOR, ratio))
                except Exception:
                    pass
            for item, color in record:
                try:
                    self.canvas.move(item, 0, -step)
                    self.canvas.itemconfig(item, fill=blend_color(self.KEY_COLOR, color, ratio))
                except Exception:
                    pass
            if k < frames:
                self.canvas.after(self.ANIM_INTERVAL, lambda: frame(k + 1))
            else:
                for item, _color in old:
                    try:
                        self.canvas.delete(item)
                    except Exception:
                        pass
                for item, color in record:
                    try:
                        self.canvas.itemconfig(item, fill=color)
                    except Exception:
                        pass

        frame()


class PlaylistChoiceDialog:
    """选择要把歌曲加入哪个歌单的小对话框"""

    def __init__(self, master, names):
        self.result = None

        self.win = tk.Toplevel(master)
        self.win.title("加入歌单")
        self.win.transient(master)
        self.win.grab_set()
        self.win.resizable(False, False)
        self.win.geometry(f"320x360+{master.winfo_rootx() + 160}+{master.winfo_rooty() + 160}")

        ttk.Label(self.win, text="选择要加入的歌单：", padding=8).pack(anchor=tk.W)
        self.listbox = tk.Listbox(self.win, font=("微软雅黑", 10), activestyle="none")
        for name in names:
            self.listbox.insert(tk.END, name)
        self.listbox.pack(fill=tk.BOTH, expand=True, padx=10)
        if names:
            self.listbox.selection_set(0)
        self.listbox.bind("<Double-1>", lambda event: self._ok())

        new_row = ttk.Frame(self.win, padding=8)
        new_row.pack(fill=tk.X)
        self.name_var = tk.StringVar()
        ttk.Entry(new_row, textvariable=self.name_var).pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(new_row, text="新建并加入", command=self._create).pack(side=tk.LEFT, padx=(6, 0))

        button_row = ttk.Frame(self.win, padding=(8, 0, 8, 8))
        button_row.pack(fill=tk.X)
        ttk.Button(button_row, text="加入", command=self._ok).pack(side=tk.RIGHT)
        ttk.Button(button_row, text="取消", command=self.win.destroy).pack(side=tk.RIGHT, padx=(0, 6))

        self.win.bind("<Return>", lambda event: self._ok())
        self.win.bind("<Escape>", lambda event: self.win.destroy())

    def _ok(self):
        selection = self.listbox.curselection()
        if not selection:
            messagebox.showinfo("提示", "请先选择一个歌单", parent=self.win)
            return
        self.result = self.listbox.get(selection[0])
        self.win.destroy()

    def _create(self):
        name = self.name_var.get().strip()
        if not name:
            messagebox.showinfo("提示", "请输入歌单名称", parent=self.win)
            return
        self.result = name
        self.win.destroy()


class LyricsSettingsDialog:
    """歌词设置：桌面歌词颜色/透明度/字号/描边/宽度，以及界面歌词字号（修改即时生效）"""

    SPIN_ITEMS = [
        ("当前行字号", "lyric_current_size", 10, 48, 1),
        ("下一行字号", "lyric_next_size", 8, 32, 1),
        ("歌词窗口宽度", "lyric_window_width", 400, 1600, 20),
        ("界面歌词字号", "ui_lyric_size", 8, 24, 1),
    ]
    ALPHA_ITEMS = [
        ("背景不透明度", "lyric_bg_alpha", 0, 100),
        ("文字不透明度", "lyric_text_alpha", 5, 100),
    ]
    COLOR_ITEMS = [
        ("当前行颜色", "lyric_current_color"),
        ("普通行颜色", "lyric_normal_color"),
        ("背景颜色", "lyric_bg_color"),
        ("描边颜色", "lyric_outline_color"),
    ]

    def __init__(self, master, settings, on_apply):
        self.on_apply = on_apply
        self.values = dict(DEFAULT_SETTINGS)
        self.values.update(settings or {})
        self.color_buttons = {}

        self.win = tk.Toplevel(master)
        self.win.title("歌词设置")
        self.win.transient(master)
        self.win.resizable(False, False)
        self.win.configure(padx=14, pady=12)
        try:
            self.win.grab_set()
        except Exception:
            pass

        self.vars = {}
        for _label, key, _lo, _hi, _step in self.SPIN_ITEMS:
            self.vars[key] = tk.StringVar(value=str(self.values.get(key)))
        self.vars["lyric_outline"] = tk.BooleanVar(value=bool(self.values.get("lyric_outline")))
        self.vars["lyric_show_next"] = tk.BooleanVar(value=bool(self.values.get("lyric_show_next")))
        self.vars["lyric_outline_width"] = tk.StringVar(value=str(self.values.get("lyric_outline_width")))
        self.alpha_vars = {}
        self.alpha_labels = {}
        for _label, key, _lo, _hi in self.ALPHA_ITEMS:
            self.alpha_vars[key] = tk.DoubleVar(value=float(self.values.get(key) or 0))

        self._build()
        self.win.bind("<Escape>", lambda event: self.win.destroy())

    def _build(self):
        ttk.Label(self.win, text="桌面歌词", font=("微软雅黑", 10, "bold")).grid(
            row=0, column=0, columnspan=2, sticky=tk.W)

        row = 1
        for label, key in self.COLOR_ITEMS:
            ttk.Label(self.win, text=label, width=12).grid(row=row, column=0, sticky=tk.W, pady=3)
            color = str(self.values.get(key) or "#ffffff")
            button = tk.Button(self.win, text=color, bg=color, width=10, relief=tk.RIDGE,
                               cursor="hand2", command=lambda k=key: self._pick_color(k))
            button.grid(row=row, column=1, sticky=tk.W)
            self.color_buttons[key] = button
            row += 1

        for label, key, lo, hi in self.ALPHA_ITEMS:
            ttk.Label(self.win, text=label, width=12).grid(row=row, column=0, sticky=tk.W, pady=3)
            alpha_row = ttk.Frame(self.win)
            alpha_row.grid(row=row, column=1, sticky=tk.W)
            ttk.Scale(alpha_row, from_=lo, to=hi, orient=tk.HORIZONTAL, length=150,
                      variable=self.alpha_vars[key],
                      command=lambda value, k=key: self._on_alpha_change(k, value)).pack(side=tk.LEFT)
            value_label = ttk.Label(alpha_row, text=f"{int(self.alpha_vars[key].get())}%", width=5)
            value_label.pack(side=tk.LEFT, padx=(6, 0))
            self.alpha_labels[key] = value_label
            row += 1

        for label, key, lo, hi, step in self.SPIN_ITEMS:
            ttk.Label(self.win, text=label, width=12).grid(row=row, column=0, sticky=tk.W, pady=3)
            spin = ttk.Spinbox(self.win, from_=lo, to=hi, increment=step, width=8,
                               textvariable=self.vars[key], command=self._apply)
            spin.grid(row=row, column=1, sticky=tk.W)
            spin.bind("<KeyRelease>", lambda event: self._apply())
            spin.bind("<FocusOut>", lambda event: self._apply())
            row += 1

        outline_row = ttk.Frame(self.win)
        outline_row.grid(row=row, column=0, columnspan=2, sticky=tk.W, pady=3)
        ttk.Checkbutton(outline_row, text="描边", variable=self.vars["lyric_outline"],
                        command=self._apply).pack(side=tk.LEFT)
        ttk.Label(outline_row, text="粗细", width=6).pack(side=tk.LEFT, padx=(10, 0))
        outline_spin = ttk.Spinbox(outline_row, from_=0, to=4, increment=1, width=5,
                                   textvariable=self.vars["lyric_outline_width"], command=self._apply)
        outline_spin.pack(side=tk.LEFT)
        outline_spin.bind("<KeyRelease>", lambda event: self._apply())
        row += 1

        ttk.Checkbutton(self.win, text="显示下一行预览", variable=self.vars["lyric_show_next"],
                        command=self._apply).grid(row=row, column=0, columnspan=2, sticky=tk.W)
        row += 1

        button_row = ttk.Frame(self.win)
        button_row.grid(row=row, column=0, columnspan=2, sticky=tk.EW, pady=(12, 0))
        ttk.Button(button_row, text="恢复默认", command=self._reset).pack(side=tk.LEFT)
        ttk.Button(button_row, text="关闭", command=self.win.destroy).pack(side=tk.RIGHT)

    def _pick_color(self, key):
        _rgb, hex_color = colorchooser.askcolor(color=str(self.values.get(key) or "#ffffff"),
                                               parent=self.win, title="选择颜色")
        if not hex_color:
            return
        self.values[key] = hex_color
        button = self.color_buttons.get(key)
        if button is not None:
            button.config(bg=hex_color, text=hex_color)
        self._apply()

    def _on_alpha_change(self, key, value):
        label = self.alpha_labels.get(key)
        if label is not None:
            label.config(text=f"{int(float(value))}%")
        self._apply()

    def _apply(self):
        """把界面上的值写回配置并通知主窗口即时生效"""
        for key, var in self.vars.items():
            if isinstance(var, tk.BooleanVar):
                self.values[key] = bool(var.get())
                continue
            try:
                self.values[key] = int(float(var.get()))
            except (TypeError, ValueError):
                pass  # 输入非法时保持原值
        for key, var in self.alpha_vars.items():
            self.values[key] = int(var.get())
        if self.on_apply:
            self.on_apply(dict(self.values))

    def _reset(self):
        self.values = dict(DEFAULT_SETTINGS)
        for key, var in self.vars.items():
            if isinstance(var, tk.BooleanVar):
                var.set(bool(self.values.get(key)))
            else:
                var.set(str(self.values.get(key)))
        for key, var in self.alpha_vars.items():
            var.set(float(self.values.get(key) or 0))
            if key in self.alpha_labels:
                self.alpha_labels[key].config(text=f"{int(self.values.get(key) or 0)}%")
        for key, button in self.color_buttons.items():
            color = str(self.values.get(key))
            button.config(bg=color, text=color)
        self._apply()


class MusicPlayerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title(f"音乐播放器 {CURRENT_DISPLAY_VERSION}")
        self.root.geometry("1080x760")
        self.root.minsize(980, 660)

        # 本地数据：歌单 / 最近播放 / 歌曲信息 / 配置项
        self.library = MusicLibrary()
        # 播放缓存：下载到本地后再播放，超出上限自动清理
        self.cache = AudioCache(os.path.join(get_data_dir(), "cache"))
        # 封面缓存：封面图片也落盘，避免重复下载
        self.cover_cache = CoverCache(os.path.join(get_data_dir(), "covers"))
        # 播放器（Windows MCI）
        self.player = MciPlayer()

        # 搜索状态
        self.search_results = []
        self.current_page = 1
        self.current_keyword = ""
        self.total_pages = 1
        self._search_cache = {}      # {页码: (结果列表, 总页数)}

        # 列表与播放状态
        self.view_songs = []
        self.current_view = "搜索结果"
        self.current_song = None
        self.play_queue = []
        self.play_index = -1
        self.loop_mode = "list"      # list=列表循环 / single=单曲循环 / none=顺序播放
        self._play_state = "stopped"
        self._play_started_at = 0.0
        self._loading = False        # 是否正在缓冲（下载到缓存）
        self._load_cancel = False
        self._load_token = 0         # 每次切歌自增，用于丢弃过期回调
        self._seek_dragging = False
        self._lyric_lines = []       # [(秒, 歌词)]，带时间戳，用于进度同步
        self._lyric_index = -1
        self._lyrics_plain = []      # 纯文本歌词（用于重新渲染界面歌词）
        self._ui_line_tags = []      # 界面歌词每行独立的标签（用于逐行动画）
        self._ui_lyric_index = -1
        self._ui_anim_token = 0      # 界面歌词动画令牌，换行时自增以中断旧动画
        self.desktop_lyrics = None
        self.album_photo = None
        self._cover_url_loaded = None
        self._apply_lyrics_size()

        self.setup_styles()
        self.create_menu()
        self.create_widgets()
        self.refresh_playlist_choices()
        self.refresh_view()
        self.center_window()
        self._tick()

        self.root.after(2000, self.check_update_on_startup)

    def setup_styles(self):
        style = ttk.Style()
        style.configure("Title.TLabel", font=("微软雅黑", 12, "bold"), foreground="#2575fc")
        style.configure("SongTitle.TLabel", font=("微软雅黑", 17, "bold"))
        style.configure("SongArtist.TLabel", font=("微软雅黑", 10), foreground="#666666")

    def center_window(self):
        self.root.update_idletasks()
        width, height = 1080, 760
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        self.root.geometry(f'{width}x{height}+{x}+{max(0, y - 20)}')

    # ==================== 菜单栏 ====================

    def create_menu(self):
        menubar = tk.Menu(self.root)

        file_menu = tk.Menu(menubar, tearoff=0)
        file_menu.add_command(label="下载当前歌曲", command=self.download_audio)
        file_menu.add_command(label="下载当前歌词", command=self.download_lrc)
        file_menu.add_separator()
        file_menu.add_command(label="打开歌曲来源网站", command=self.open_browser)
        file_menu.add_separator()
        file_menu.add_command(label="清空播放缓存", command=self.clear_cache)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.on_close)
        menubar.add_cascade(label="文件", menu=file_menu)

        playlist_menu = tk.Menu(menubar, tearoff=0)
        playlist_menu.add_command(label="新建歌单", command=self.new_playlist)
        playlist_menu.add_command(label="删除当前歌单", command=self.delete_current_playlist)
        playlist_menu.add_separator()
        playlist_menu.add_command(label="把选中歌曲加入歌单", command=self.add_to_playlist)
        playlist_menu.add_command(label="把选中歌曲移出列表", command=self.remove_selected)
        menubar.add_cascade(label="歌单", menu=playlist_menu)

        play_menu = tk.Menu(menubar, tearoff=0)
        play_menu.add_command(label="播放 / 暂停", command=self.toggle_play)
        play_menu.add_command(label="上一首", command=self.play_prev)
        play_menu.add_command(label="下一首", command=self.play_next)
        play_menu.add_separator()
        self.desktop_lyric_var = tk.BooleanVar(value=False)
        play_menu.add_checkbutton(label="桌面歌词", variable=self.desktop_lyric_var,
                                   command=self.toggle_desktop_lyrics)
        play_menu.add_command(label="歌词设置...", command=self.open_lyrics_settings)
        menubar.add_cascade(label="播放", menu=play_menu)

        help_menu = tk.Menu(menubar, tearoff=0)
        help_menu.add_command(label="检查更新", command=self.manual_check_update)
        help_menu.add_command(label="关于", command=self.show_about)
        menubar.add_cascade(label="帮助", menu=help_menu)

        self.root.config(menu=menubar)

    # ==================== 界面 ====================

    def create_widgets(self):
        main_frame = ttk.Frame(self.root, padding=(10, 8, 10, 8))
        main_frame.pack(fill=tk.BOTH, expand=True)
        self.create_left_panel(main_frame)
        self.create_right_panel(main_frame)

    def create_left_panel(self, parent):
        outer = ttk.Frame(parent, width=340)
        outer.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        outer.pack_propagate(False)

        # 搜索
        search_frame = ttk.LabelFrame(outer, text="搜索歌曲", padding="8")
        search_frame.pack(fill=tk.X, pady=(0, 8))
        search_row = ttk.Frame(search_frame)
        search_row.pack(fill=tk.X)
        self.search_var = tk.StringVar()
        self.search_entry = ttk.Entry(search_row, textvariable=self.search_var, font=("微软雅黑", 10))
        self.search_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self.search_entry.bind('<Return>', lambda e: self.search())
        self.search_btn = ttk.Button(search_row, text="搜索", width=6, command=self.search)
        self.search_btn.pack(side=tk.LEFT, padx=(5, 0))

        # 列表选择（搜索结果 / 最近播放 / 歌单）
        view_row = ttk.Frame(outer)
        view_row.pack(fill=tk.X, pady=(0, 6))
        ttk.Label(view_row, text="列表：").pack(side=tk.LEFT)
        self.view_var = tk.StringVar(value="搜索结果")
        self.view_combo = ttk.Combobox(view_row, textvariable=self.view_var, state="readonly",
                                        values=["搜索结果", "最近播放"])
        self.view_combo.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self.view_combo.bind("<<ComboboxSelected>>", lambda e: self.on_view_changed())

        # 歌曲列表
        list_frame = ttk.Frame(outer)
        list_frame.pack(fill=tk.BOTH, expand=True)
        self.song_tree = ttk.Treeview(list_frame, columns=("song",), show="headings", selectmode="browse")
        self.song_tree.heading("song", text="歌曲（双击播放）")
        self.song_tree.column("song", width=300, anchor=tk.W)
        tree_scroll = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.song_tree.yview)
        self.song_tree.configure(yscrollcommand=tree_scroll.set)
        self.song_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.song_tree.bind('<Double-1>', self.on_song_activate)
        self.song_tree.bind('<Return>', self.on_song_activate)

        # 翻页（仅搜索结果有效）
        page_frame = ttk.Frame(outer)
        page_frame.pack(fill=tk.X, pady=(6, 0))
        self.prev_btn = ttk.Button(page_frame, text="◀", width=3, command=self._prev_page)
        self.prev_btn.pack(side=tk.LEFT)
        self.page_label = ttk.Label(page_frame, text="第 1 / 1 页", anchor=tk.CENTER)
        self.page_label.pack(side=tk.LEFT, expand=True, fill=tk.X)
        self.page_input = ttk.Entry(page_frame, width=4)
        self.page_input.pack(side=tk.LEFT, padx=(0, 3))
        self.page_input.bind('<Return>', self._goto_page)
        self.next_btn = ttk.Button(page_frame, text="▶", width=3, command=self._next_page)
        self.next_btn.pack(side=tk.LEFT)

        # 歌单操作
        op_row1 = ttk.Frame(outer)
        op_row1.pack(fill=tk.X, pady=(6, 0))
        ttk.Button(op_row1, text="加入歌单", width=10, command=self.add_to_playlist).pack(side=tk.LEFT)
        ttk.Button(op_row1, text="移出列表", width=10, command=self.remove_selected).pack(side=tk.LEFT, padx=(6, 0))

        op_row2 = ttk.Frame(outer)
        op_row2.pack(fill=tk.X, pady=(6, 0))
        self.move_up_btn = ttk.Button(op_row2, text="↑ 上移", width=10,
                                      command=lambda: self.move_selected(-1))
        self.move_up_btn.pack(side=tk.LEFT)
        self.move_down_btn = ttk.Button(op_row2, text="↓ 下移", width=10,
                                        command=lambda: self.move_selected(1))
        self.move_down_btn.pack(side=tk.LEFT, padx=(6, 0))

    def create_right_panel(self, parent):
        right = ttk.Frame(parent)
        right.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # 歌曲信息
        info_frame = ttk.Frame(right)
        info_frame.pack(fill=tk.X, pady=(0, 8))
        cover_frame = tk.Frame(info_frame, width=COVER_SIZE, height=COVER_SIZE,
                                bg="#f0f0f0", bd=1, relief=tk.SUNKEN)
        cover_frame.pack(side=tk.LEFT, padx=(0, 14))
        cover_frame.pack_propagate(False)
        self.cover_label = tk.Label(cover_frame, text="暂无封面", bg="#f0f0f0", fg="gray",
                                     font=("微软雅黑", 10))
        self.cover_label.pack(fill=tk.BOTH, expand=True)

        text_frame = ttk.Frame(info_frame)
        text_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.song_title_label = ttk.Label(text_frame, text="未在播放", style="SongTitle.TLabel",
                                          wraplength=560, justify=tk.LEFT)
        self.song_title_label.pack(anchor=tk.W, pady=(12, 6))
        self.song_artist_label = ttk.Label(text_frame, text="", style="SongArtist.TLabel")
        self.song_artist_label.pack(anchor=tk.W)
        self.song_status_label = ttk.Label(text_frame, text="双击左侧列表中的歌曲开始播放",
                                           foreground="gray", font=("微软雅黑", 9))
        self.song_status_label.pack(anchor=tk.W, pady=(10, 0))

        # 播放进度（可拖动跳转）
        progress_frame = ttk.Frame(right)
        progress_frame.pack(fill=tk.X, pady=(0, 6))
        self.time_label = ttk.Label(progress_frame, text="00:00", width=6)
        self.time_label.pack(side=tk.LEFT)
        self.progress_scale = ttk.Scale(progress_frame, from_=0, to=1000, orient=tk.HORIZONTAL,
                                        command=self.on_seek_drag)
        self.progress_scale.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=6)
        self.progress_scale.bind('<ButtonPress-1>', self._on_seek_press)
        self.progress_scale.bind('<ButtonRelease-1>', self._on_seek_release)
        self.duration_label = ttk.Label(progress_frame, text="00:00", width=6)
        self.duration_label.pack(side=tk.LEFT)

        # 播放控制
        ctrl_frame = ttk.Frame(right)
        ctrl_frame.pack(fill=tk.X, pady=(0, 8))
        ttk.Button(ctrl_frame, text="⏮ 上一首", width=10, command=self.play_prev).pack(side=tk.LEFT)
        self.play_btn = ttk.Button(ctrl_frame, text="▶ 播放", width=12, command=self.toggle_play)
        self.play_btn.pack(side=tk.LEFT, padx=6)
        ttk.Button(ctrl_frame, text="⏭ 下一首", width=10, command=self.play_next).pack(side=tk.LEFT)
        self.loop_btn = ttk.Button(ctrl_frame, text="🔁 列表循环", width=13, command=self.toggle_loop_mode)
        self.loop_btn.pack(side=tk.LEFT, padx=6)

        ttk.Label(ctrl_frame, text="音量").pack(side=tk.LEFT, padx=(8, 2))
        self.volume_scale = ttk.Scale(ctrl_frame, from_=0, to=100, orient=tk.HORIZONTAL,
                                      command=self.on_volume_change)
        self.volume_scale.set(80)
        self.volume_scale.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))
        self.lyric_btn = ttk.Button(ctrl_frame, text="🎤 桌面歌词", width=13,
                                    command=self.toggle_desktop_lyrics)
        self.lyric_btn.pack(side=tk.LEFT)

        # 歌词
        lyrics_frame = ttk.LabelFrame(right, text="歌词", padding="6")
        lyrics_frame.pack(fill=tk.BOTH, expand=True)
        self.lyrics_text = tk.Text(lyrics_frame, font=("微软雅黑", 11), wrap=tk.WORD,
                                   state=tk.DISABLED, bg="#fafafa", relief=tk.FLAT,
                                   spacing1=4, spacing3=4, padx=6)
        lyrics_scroll = ttk.Scrollbar(lyrics_frame, orient=tk.VERTICAL, command=self.lyrics_text.yview)
        self.lyrics_text.configure(yscrollcommand=lyrics_scroll.set)
        self.lyrics_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        lyrics_scroll.pack(side=tk.RIGHT, fill=tk.Y)

    # ==================== 列表与歌单 ====================

    def refresh_playlist_choices(self):
        names = ["搜索结果", "最近播放"] + list(self.library.playlists.keys())
        self.view_combo.config(values=names)
        if self.view_var.get() not in names:
            self.view_var.set("搜索结果")

    def on_view_changed(self):
        self.refresh_view()

    def refresh_view(self):
        view = self.view_var.get()
        self.current_view = view
        if view == "搜索结果":
            songs = list(self.search_results)
        elif view == "最近播放":
            songs = [self.library.get_song(song_id) for song_id in self.library.history]
        else:
            songs = [self.library.get_song(song_id) for song_id in self.library.playlists.get(view, [])]
        self.view_songs = [song for song in songs if song]
        self._fill_song_list(self.view_songs)
        self._update_list_controls()

    def _fill_song_list(self, songs):
        for item in self.song_tree.get_children():
            self.song_tree.delete(item)
        for song in songs:
            title = song.get('title') or '未知歌名'
            artist = song.get('artist') or '未知歌手'
            self.song_tree.insert("", tk.END, iid=str(song.get('song_id')),
                                  values=(f"{title} - {artist}",))

    def _update_list_controls(self):
        is_search = (self.current_view == "搜索结果")
        self.page_label.config(text=f"第 {self.current_page} / {self.total_pages} 页")
        self.prev_btn.config(state=tk.NORMAL if (is_search and self.current_page > 1) else tk.DISABLED)
        self.next_btn.config(state=tk.NORMAL if (is_search and self.current_page < self.total_pages) else tk.DISABLED)
        self.page_input.config(state=tk.NORMAL if is_search else tk.DISABLED)
        sort_state = tk.DISABLED if self.current_view in ("搜索结果", "最近播放") else tk.NORMAL
        self.move_up_btn.config(state=sort_state)
        self.move_down_btn.config(state=sort_state)

    def _selected_song(self):
        selection = self.song_tree.selection()
        if not selection:
            return None
        song_id = str(selection[0])
        for song in self.view_songs:
            if str(song.get('song_id')) == song_id:
                return song
        return self.library.get_song(song_id)

    def on_song_activate(self, event=None):
        song = self._selected_song()
        if not song:
            return
        self.play_queue = list(self.view_songs)
        self.play_index = next((i for i, item in enumerate(self.play_queue)
                                if str(item.get('song_id')) == str(song.get('song_id'))), 0)
        self.play_song(self.play_queue[self.play_index])

    def add_to_playlist(self):
        song = self._selected_song()
        if not song:
            messagebox.showinfo("提示", "请先在列表中选择歌曲")
            return
        dialog = PlaylistChoiceDialog(self.root, list(self.library.playlists.keys()))
        self.root.wait_window(dialog.win)
        if not dialog.result:
            return
        if dialog.result not in self.library.playlists:
            self.library.create_playlist(dialog.result)
        self.library.add_to_playlist(dialog.result, song)
        self.refresh_playlist_choices()

    def remove_selected(self):
        song = self._selected_song()
        if not song:
            messagebox.showinfo("提示", "请先在列表中选择歌曲")
            return
        view = self.current_view
        if view == "搜索结果":
            messagebox.showinfo("提示", "搜索结果为在线列表，可先加入歌单后再管理")
            return
        if view == "最近播放":
            song_id = str(song.get('song_id'))
            if song_id in self.library.history:
                self.library.history.remove(song_id)
                self.library.save()
        else:
            self.library.remove_from_playlist(view, str(song.get('song_id')))
        self.refresh_view()

    def move_selected(self, delta):
        if self.current_view in ("搜索结果", "最近播放"):
            messagebox.showinfo("提示", "该列表不支持排序")
            return
        song = self._selected_song()
        if not song:
            messagebox.showinfo("提示", "请先在列表中选择歌曲")
            return
        song_id = str(song.get('song_id'))
        if self.library.move_in_playlist(self.current_view, song_id, delta):
            self.refresh_view()
            self.song_tree.selection_set(song_id)

    def new_playlist(self):
        name = simpledialog.askstring("新建歌单", "请输入歌单名称：", parent=self.root)
        if not name:
            return
        name = name.strip()
        if not self.library.create_playlist(name):
            messagebox.showwarning("提示", "歌单名称无效或已存在")
            return
        self.refresh_playlist_choices()
        self.view_var.set(name)
        self.refresh_view()

    def delete_current_playlist(self):
        name = self.current_view
        if name not in self.library.playlists:
            messagebox.showinfo("提示", "请先切换到要删除的歌单")
            return
        if not messagebox.askyesno("删除歌单", f"确定删除歌单「{name}」吗？\n（只删除列表，不会删除已下载的文件）"):
            return
        self.library.delete_playlist(name)
        self.refresh_playlist_choices()
        self.view_var.set("搜索结果")
        self.refresh_view()

    # ==================== 搜索功能 ====================

    def search(self):
        keyword = self.search_var.get().strip()
        if not keyword:
            messagebox.showwarning("提示", "请输入歌曲名称")
            return
        if keyword != self.current_keyword:
            # 歌名变化才清空缓存；歌名未变时保留已加载的各页结果
            self.current_keyword = keyword
            self._search_cache = {}
        self.current_page = 1
        self.view_var.set("搜索结果")
        self.current_view = "搜索结果"
        self._do_search()

    def _do_search(self):
        cached = self._search_cache.get(self.current_page)
        if cached:
            self.search_results, self.total_pages = cached
            self.refresh_view()
            return

        site_page1 = self.current_page * 2 - 1
        site_page2 = self.current_page * 2
        url1 = f"https://higequ.com/s/{quote(self.current_keyword)}/{site_page1}/"
        url2 = f"https://higequ.com/s/{quote(self.current_keyword)}/{site_page2}/"
        self.search_btn.config(state=tk.DISABLED)
        self.page_label.config(text=f"第 {self.current_page} 页（加载中...）")
        self.prev_btn.config(state=tk.DISABLED)
        self.next_btn.config(state=tk.DISABLED)
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
        for html in (html1, html2):
            if not html:
                continue
            for match in re.finditer(pattern, html, re.DOTALL):
                results.append({
                    'song_id': match.group(1),
                    'title': match.group(2).strip(),
                    'artist': match.group(3).strip()
                })
        return results, total_pages

    def _on_search_complete(self, results, total_pages):
        self.total_pages = max(1, total_pages)
        self.search_results = results
        self._search_cache[self.current_page] = (results, self.total_pages)
        self.search_btn.config(state=tk.NORMAL)
        if not results:
            messagebox.showinfo("提示", f"未找到「{self.current_keyword}」的相关歌曲")
        if self.current_view == "搜索结果":
            self.refresh_view()
        else:
            self._update_list_controls()

    def _on_search_error(self, error):
        self.search_btn.config(state=tk.NORMAL)
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
        except ValueError:
            messagebox.showwarning("提示", "请输入有效的页码")
            return
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

    # ==================== 歌曲信息提取 ====================

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
                if ' - ' in title:
                    title = title.split(' - ', 1)[0].strip()
            else:
                match = re.search(r'<title>([^<]+)</title>', html)
                if match:
                    title = match.group(1).replace('MP3下载', '').replace('在线试听', '').strip()
                    if ' - ' in title:
                        title = title.split(' - ', 1)[0].strip()

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

            # 降级逻辑：从 base64 编码的 code 变量中解码
            if not audio_url:
                code_match = re.search(r'let\s+code\s*=\s*"([^"]+)"', html)
                if code_match:
                    encoded = code_match.group(1)
                    try:
                        real_url = base64.b64decode(encoded).decode('utf-8')
                        if real_url.startswith('http'):
                            audio_url = real_url
                            for ext in ('.mp3', '.aac', '.m4a', '.flac'):
                                if ext in real_url.lower():
                                    audio_format = ext
                                    break
                            else:
                                audio_format = '.mp3'
                    except Exception as e:
                        print(f"Base64解码失败: {e}")

            # 歌词：纯文本（界面显示） + 带时间戳（进度同步/桌面歌词）
            lyrics_texts = []
            lrc_lyrics = []
            for match in re.finditer(r'<div class="lyric-line"\s*data-time="([^"]+)"[^>]*>([^<]+)</div>', html):
                time_sec = float(match.group(1))
                text = match.group(2).strip()
                lyrics_texts.append(text)
                lrc_lyrics.append((time_sec, text))

            if not lrc_lyrics:
                for match in re.finditer(r'<div class="lyric-line"[^>]*>([^<]+)</div>', html):
                    lyrics_texts.append(match.group(1).strip())

            if not audio_url:
                return None, "未找到音频链接（可能歌曲已下架）"

            return {
                'title': title,
                'artist': artist,
                'audio_url': audio_url,
                'audio_format': audio_format,
                'song_id': str(song_id),
                'lyrics': lyrics_texts or ["暂无歌词"],
                'lrc_lyrics': lrc_lyrics,
                'page_url': url,
                'cover_url': cover_url
            }, None

        except Exception as e:
            return None, str(e)

    # ==================== 播放控制 ====================

    def play_song(self, song):
        """播放指定歌曲：优先使用缓存，无缓存则先缓冲（下载）再播放"""
        if not song:
            return
        self._load_token += 1
        token = self._load_token
        self._load_cancel = False
        self.player.stop()
        self._play_state = "stopped"
        self.current_song = dict(song)
        self.library.push_history(self.current_song.get('song_id'))
        self.library.add_song(self.current_song)
        self._lyric_lines = self._parse_lrc(self.current_song.get('lrc_lyrics'))
        self._lyric_index = -1
        self.update_now_playing_ui(self.current_song)
        self.update_lyrics_display(self.current_song.get('lyrics') or [])
        self._update_desktop_lyrics()
        self.refresh_view_preserving_selection()

        cached = self.cache.find(self.current_song.get('song_id'))
        if cached:
            if not self.current_song.get('lrc_lyrics'):
                self._refresh_song_info_async(token, self.current_song)
            self._start_playback(cached)
            return
        self._begin_buffer(token)

    def refresh_view_preserving_selection(self):
        """列表内容可能因历史/歌单更新而变化，重绘并保持选中项"""
        song_id = str(self.current_song.get('song_id')) if self.current_song else None
        self.refresh_view()
        if song_id and self.song_tree.exists(song_id):
            self.song_tree.selection_set(song_id)
            self.song_tree.see(song_id)

    def _begin_buffer(self, token):
        self._loading = True
        self.play_btn.config(text="⏳ 缓冲中", state=tk.DISABLED)
        thread = threading.Thread(target=self._buffer_thread, args=(token,), daemon=True)
        thread.start()

    def _buffer_thread(self, token):
        cancelled = lambda: self._load_token != token or self._load_cancel
        try:
            path, merged = self._resolve_and_download(dict(self.current_song), cancelled)
        except Exception as e:
            if cancelled():
                return
            self.root.after(0, self._on_buffer_failed, token, str(e))
            return
        if cancelled():
            return
        self.root.after(0, self._on_info_loaded, token, merged)
        self.root.after(0, self._on_buffer_done, token, path)

    def _resolve_and_download(self, song, cancelled):
        """获取歌曲信息并下载到缓存，返回 (缓存路径, 合并后的歌曲信息)"""
        info = song
        if not info.get('audio_url'):
            info, error = self._extract_song_info(song.get('song_id'))
            if error:
                raise Exception(error)
        merged = self.library.add_song({**song, **info}) or {**song, **info}
        try:
            return self._download_to_cache(merged, cancelled), merged
        except Exception as first_error:
            message = str(first_error)
            if cancelled() or '已取消' in message:
                raise
            # 直链可能已过期：重新解析一次再试
            info, error = self._extract_song_info(song.get('song_id'))
            if error:
                raise first_error
            merged = self.library.add_song({**song, **info}) or {**song, **info}
            return self._download_to_cache(merged, cancelled), merged

    def _download_to_cache(self, song, cancelled):
        return self.cache.download(
            song['audio_url'],
            song.get('song_id'),
            song.get('audio_format') or '.mp3',
            progress_callback=lambda done, total: self.root.after(
                0, self._on_buffer_progress, cancelled, done, total),
            cancel_check=cancelled
        )

    def _on_buffer_progress(self, cancelled, done, total):
        if cancelled():
            return
        # 没有状态栏，缓冲进度直接显示在播放按钮上
        if total > 0:
            self.play_btn.config(text=f"⏳ 缓冲 {int(done * 100 / total)}%")
        else:
            self.play_btn.config(text=f"⏳ 缓冲 {done // 1024}KB")

    def _on_info_loaded(self, token, info):
        if token != self._load_token or not info:
            return
        self.current_song = info
        self.library.add_song(info)
        self._lyric_lines = self._parse_lrc(info.get('lrc_lyrics'))
        self._lyric_index = -1
        self.update_now_playing_ui(info)
        self.update_lyrics_display(info.get('lyrics') or [])
        self._update_desktop_lyrics()

    def _refresh_song_info_async(self, token, song):
        """后台补全歌曲信息（封面、歌词），不影响正在进行的播放"""
        def worker():
            info, error = self._extract_song_info(song.get('song_id'))
            if error or not info:
                return
            merged = self.library.add_song({**song, **info}) or {**song, **info}
            self.root.after(0, self._on_info_loaded, token, merged)
        threading.Thread(target=worker, daemon=True).start()

    def _on_buffer_done(self, token, path):
        if token != self._load_token:
            return
        self._start_playback(path)

    def _on_buffer_failed(self, token, message):
        if token != self._load_token:
            return
        self._loading = False
        self.play_btn.config(text="▶ 播放", state=tk.NORMAL)
        messagebox.showerror("播放失败", f"无法播放该歌曲：{message}")

    def _start_playback(self, path):
        self._loading = False
        self.cache.touch(path)
        self.player.set_volume(self.volume_scale.get())
        if not self.player.open(path) or not self.player.play():
            self._play_state = "stopped"
            self.play_btn.config(text="▶ 播放", state=tk.NORMAL)
            messagebox.showerror("播放失败", "无法播放该音频文件，可在「文件」菜单中直接下载后用其他播放器播放")
            return
        self._play_state = "playing"
        self._play_started_at = time.time()
        self.play_btn.config(text="⏸ 暂停", state=tk.NORMAL)

    def toggle_play(self):
        if self._loading:
            return
        if self.player.is_open():
            mode = self.player.mode()
            if mode == "playing":
                if self.player.pause():
                    self._play_state = "paused"
                    self.play_btn.config(text="▶ 播放")
            elif mode == "paused":
                if self.player.resume():
                    self._play_state = "playing"
                    self._play_started_at = time.time()
                    self.play_btn.config(text="⏸ 暂停")
            else:
                # 播放已结束或未开始：从头（或进度条位置）继续
                target = int(float(self.progress_scale.get()))
                duration = self.player.duration_ms()
                if duration > 0 and target >= duration - 500:
                    target = 0
                if self.player.play(target):
                    self._play_state = "playing"
                    self._play_started_at = time.time()
                    self.play_btn.config(text="⏸ 暂停")
            return
        # 播放器空闲：继续播放当前歌曲或列表第一首
        if self.current_song:
            self.play_song(self.current_song)
        elif self.view_songs:
            self.play_queue = list(self.view_songs)
            self.play_index = 0
            self.play_song(self.play_queue[0])
        else:
            messagebox.showinfo("提示", "请先双击列表中的歌曲")

    def play_next(self, auto=False):
        if self._loading or not self.play_queue:
            return
        if auto and self.loop_mode == "single":
            self.play_song(self.current_song)
            return
        if self.play_index < 0:
            self.play_index = 0
            self.play_song(self.play_queue[0])
            return
        next_index = self.play_index + 1
        if next_index >= len(self.play_queue):
            if auto and self.loop_mode == "none":
                self.player.stop()
                self._play_state = "stopped"
                self.play_btn.config(text="▶ 播放")
                return
            next_index = 0
        self.play_index = next_index
        self.play_song(self.play_queue[next_index])

    def play_prev(self):
        if self._loading or not self.play_queue:
            return
        if self.play_index > 0:
            self.play_index -= 1
        else:
            self.play_index = len(self.play_queue) - 1
        self.play_song(self.play_queue[self.play_index])

    def toggle_loop_mode(self):
        if self.loop_mode == "list":
            self.loop_mode = "single"
            self.loop_btn.config(text="🔂 单曲循环")
        elif self.loop_mode == "single":
            self.loop_mode = "none"
            self.loop_btn.config(text="➡ 顺序播放")
        else:
            self.loop_mode = "list"
            self.loop_btn.config(text="🔁 列表循环")

    def on_volume_change(self, value):
        try:
            self.player.set_volume(float(value))
        except Exception:
            pass

    def _on_seek_press(self, event):
        self._seek_dragging = True
        # 点击轨道（离滑块较远）时直接跳转到点击位置
        width = self.progress_scale.winfo_width()
        start = float(self.progress_scale.cget('from'))
        end = float(self.progress_scale.cget('to'))
        if width <= 1 or end <= start:
            return
        ratio = max(0.0, min(1.0, event.x / width))
        clicked = start + ratio * (end - start)
        if abs(clicked - float(self.progress_scale.get())) > (end - start) * 8.0 / width:
            self.progress_scale.set(clicked)
            self.time_label.config(text=format_ms(clicked))

    def on_seek_drag(self, value):
        if self._seek_dragging:
            self.time_label.config(text=format_ms(float(value)))

    def _on_seek_release(self, event):
        self._seek_dragging = False
        if self.player.is_open():
            self.player.seek(int(float(self.progress_scale.get())))
            # 跳转后重新计时，避免瞬间被判定为“播放结束”而切歌
            if self._play_state == "playing":
                self._play_started_at = time.time()

    def _tick(self):
        """定时刷新播放进度与歌词高亮"""
        try:
            if self.player.is_open():
                mode = self.player.mode()
                duration = self.player.duration_ms()
                position = self.player.position_ms()
                if duration > 0:
                    self.progress_scale.config(to=duration)
                    self.duration_label.config(text=format_ms(duration))
                    if not self._seek_dragging:
                        self.progress_scale.set(min(position, duration))
                if not self._seek_dragging:
                    self.time_label.config(text=format_ms(position))
                self.update_lyric_sync(position / 1000.0)
                if (self._play_state == "playing" and mode == "stopped"
                        and time.time() - self._play_started_at > 1.5):
                    if self.loop_mode == "single":
                        self.play_song(self.current_song)
                    else:
                        self.play_next(auto=True)
        except Exception as e:
            print(f"刷新播放状态失败: {e}")
        self.root.after(200, self._tick)

    # ==================== 歌词显示 ====================

    def _parse_lrc(self, lrc):
        lines = []
        for item in (lrc or []):
            try:
                lines.append((float(item[0]), str(item[1])))
            except Exception:
                continue
        lines.sort(key=lambda line: line[0])
        return lines

    def update_now_playing_ui(self, song):
        self.song_title_label.config(text=song.get('title') or '未知歌名')
        self.song_artist_label.config(text=song.get('artist') or '未知歌手')
        self.song_status_label.config(text=f"来源：Hi歌曲网 | 歌曲ID：{song.get('song_id', '-')}")
        self.load_cover(song.get('cover_url'))

    def _apply_lyrics_size(self):
        """读取界面歌词的字号与配色（配置变更后调用）"""
        self._ui_lyric_size = int(self.library.get_settings().get("ui_lyric_size") or 11)
        self._ui_normal_color = "#444444"
        self._ui_current_color = "#2575fc"

    def update_lyrics_display(self, lyrics):
        self._lyrics_plain = list(lyrics or [])
        self.lyrics_text.config(state=tk.NORMAL)
        self.lyrics_text.delete("1.0", tk.END)
        for tag in self._ui_line_tags:
            self.lyrics_text.tag_delete(tag)
        self._ui_line_tags = []
        self._ui_lyric_index = -1
        self._ui_anim_token += 1
        for index, line in enumerate(self._lyrics_plain or ["暂无歌词"]):
            tag = f"ui-lyric-{index}"
            self.lyrics_text.tag_config(tag, foreground=self._ui_normal_color,
                                        font=("微软雅黑", self._ui_lyric_size))
            self.lyrics_text.insert(tk.END, f"{line}\n", tag)
            self._ui_line_tags.append(tag)
        self.lyrics_text.config(state=tk.DISABLED)

    def _set_line_font(self, index, current):
        """切换某行的字体（当前行加粗并放大两号）"""
        if not (0 <= index < len(self._ui_line_tags)):
            return
        size = self._ui_lyric_size + (2 if current else 0)
        font = ("微软雅黑", size, "bold") if current else ("微软雅黑", size)
        try:
            self.lyrics_text.tag_config(self._ui_line_tags[index], font=font)
        except Exception:
            pass

    def _highlight_lyric(self, index):
        if not self._ui_line_tags:
            return
        previous = self._ui_lyric_index
        self._ui_lyric_index = index
        self._ui_anim_token += 1
        token = self._ui_anim_token
        # 字体立即切换，颜色逐帧过渡，视觉上就是高亮平滑地移到新的一行
        if previous >= 0:
            self._set_line_font(previous, False)
        if 0 <= index < len(self._ui_line_tags):
            self._set_line_font(index, True)
        self._animate_lyric_colors(previous, index, token)
        if index >= 0:
            self._scroll_lyrics_to(index, token)

    def _animate_lyric_colors(self, previous, index, token, frames=8, interval=22):
        """新旧歌词行颜色互相过渡（淡出/淡入）"""
        previous_tag = self._ui_line_tags[previous] if 0 <= previous < len(self._ui_line_tags) else None
        current_tag = self._ui_line_tags[index] if 0 <= index < len(self._ui_line_tags) else None

        def frame(step=0):
            if token != self._ui_anim_token:
                return
            ratio = step / frames
            try:
                if previous_tag:
                    self.lyrics_text.tag_config(
                        previous_tag,
                        foreground=blend_color(self._ui_current_color, self._ui_normal_color, ratio))
                if current_tag:
                    self.lyrics_text.tag_config(
                        current_tag,
                        foreground=blend_color(self._ui_normal_color, self._ui_current_color, ratio))
            except Exception:
                return
            if step < frames:
                self.lyrics_text.after(interval, lambda: frame(step + 1))

        frame()

    def _scroll_lyrics_to(self, index, token, frames=8, interval=20):
        """平滑滚动到当前行附近"""
        total = max(1, len(self._lyric_lines))
        target = max(0.0, (index - 2) / total)
        try:
            start = self.lyrics_text.yview()[0]
        except Exception:
            return
        if abs(target - start) < 0.004:
            return

        def frame(step=1):
            if token != self._ui_anim_token:
                return
            try:
                self.lyrics_text.yview_moveto(start + (target - start) * (step / frames))
            except Exception:
                return
            if step < frames:
                self.lyrics_text.after(interval, lambda: frame(step + 1))

        frame()

    def update_lyric_sync(self, seconds):
        if not self._lyric_lines:
            return
        index = -1
        for i, (start, _) in enumerate(self._lyric_lines):
            if start <= seconds:
                index = i
            else:
                break
        if index != self._lyric_index:
            self._lyric_index = index
            self._highlight_lyric(index)
            self._update_desktop_lyrics()

    def _update_desktop_lyrics(self):
        if not (self.desktop_lyrics and self.desktop_lyrics.alive()):
            return
        if not self.current_song:
            self.desktop_lyrics.set_lines("桌面歌词已开启", "播放歌曲后自动同步显示")
            return
        title = self.current_song.get('title') or '未知歌名'
        artist = self.current_song.get('artist') or '未知歌手'
        if self._lyric_lines and self._lyric_index >= 0:
            current = self._lyric_lines[self._lyric_index][1]
            next_line = ""
            if self._lyric_index + 1 < len(self._lyric_lines):
                next_line = self._lyric_lines[self._lyric_index + 1][1]
        elif self._lyric_lines:
            current = f"♪ {title}"
            next_line = self._lyric_lines[0][1]
        else:
            current = f"♪ {title} - {artist}"
            next_line = "该歌曲暂无带时间戳的歌词"
        self.desktop_lyrics.set_lines(current, next_line)

    def toggle_desktop_lyrics(self):
        if self.desktop_lyrics and self.desktop_lyrics.alive():
            self.desktop_lyrics.close()
            return
        self.desktop_lyrics = DesktopLyricsWindow(self.root, self.library.get_settings(),
                                                  on_closed=self._on_lyrics_window_closed)
        self.desktop_lyric_var.set(True)
        self.lyric_btn.config(text="🎤 关闭桌面歌词")
        self._update_desktop_lyrics()

    def _on_lyrics_window_closed(self):
        self.desktop_lyrics = None
        self.desktop_lyric_var.set(False)
        self.lyric_btn.config(text="🎤 桌面歌词")

    # ==================== 歌词设置 ====================

    def open_lyrics_settings(self):
        LyricsSettingsDialog(self.root, self.library.get_settings(), self._apply_lyrics_settings)

    def _apply_lyrics_settings(self, values):
        """配置变更：保存并让桌面歌词与界面歌词立即生效"""
        settings = self.library.update_settings(values)
        self._apply_lyrics_size()
        if self.desktop_lyrics and self.desktop_lyrics.alive():
            self.desktop_lyrics.apply_settings(settings)
        if self._lyrics_plain:
            current = self._lyric_index
            self.update_lyrics_display(self._lyrics_plain)
            if current >= 0:
                self._highlight_lyric(current)

    # ==================== 封面 ====================

    def load_cover(self, url):
        if not url:
            self.album_photo = None
            self._cover_url_loaded = None
            self.cover_label.config(image="", text="暂无封面")
            return
        if url == self._cover_url_loaded:
            return
        self._cover_url_loaded = url

        def worker():
            try:
                data = self.cover_cache.get(url)
                if not data:
                    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                    response = requests.get(url, headers=headers, timeout=10)
                    response.raise_for_status()
                    data = response.content
                    self.cover_cache.put(url, data)
                pil_image = Image.open(io.BytesIO(data))
                pil_image = fit_image_in_box(pil_image, COVER_SIZE)
                photo = ImageTk.PhotoImage(pil_image)
                self.root.after(0, lambda: self._set_cover_image(url, photo))
            except Exception as e:
                print(f"加载封面失败: {e}")

        threading.Thread(target=worker, daemon=True).start()

    def _set_cover_image(self, url, photo):
        if url != self._cover_url_loaded:
            return
        self.album_photo = photo
        self.cover_label.config(image=photo, text="")

    # ==================== 下载功能（备用） ====================

    def download_audio(self):
        song = self.current_song
        if not song:
            messagebox.showinfo("提示", "请先播放或双击选择一首歌曲")
            return
        if not song.get('audio_url'):
            def worker():
                info, error = self._extract_song_info(song.get('song_id'))
                self.root.after(0, lambda: self._after_info_for_download(song, info, error))

            threading.Thread(target=worker, daemon=True).start()
            return
        self._start_download(song)

    def _after_info_for_download(self, song, info, error):
        if error or not info:
            messagebox.showerror("下载失败", f"无法获取音频信息：{error}")
            return
        merged = self.library.add_song({**song, **info}) or {**song, **info}
        if self.current_song and str(self.current_song.get('song_id')) == str(merged.get('song_id')):
            self.current_song = merged
            self.update_now_playing_ui(merged)
        self._start_download(merged)

    def _start_download(self, song):
        audio_format = song.get('audio_format') or '.mp3'
        if audio_format == '.mp3':
            self._download_original(song)
            return
        result = messagebox.askyesno(
            "格式转换提示",
            f"当前歌曲格式为 {audio_format.upper()}，不是标准MP3。\n\n"
            "是否转换为MP3后再下载？\n\n"
            "• 点击“是” → 下载后自动转换为MP3\n"
            "• 点击“否” → 直接下载原始格式文件"
        )
        if result:
            if not FFmpegInstaller.is_installed():
                messagebox.showerror("无法转换", "无法完成转换，请在电脑上安装FFmpeg")
                return
            self.download_and_convert(song)
        else:
            self._download_original(song)

    def _download_original(self, song):
        """直接下载原始格式音频（不转换）"""
        url = song.get('audio_url')
        if not url:
            messagebox.showerror("下载失败", "未找到音频链接")
            return
        audio_format = song.get('audio_format') or '.mp3'
        format_name = audio_format.upper().replace('.', '')
        title = song.get('title') or '未知歌名'
        artist = song.get('artist') or '未知歌手'

        filename = filedialog.asksaveasfilename(
            defaultextension=audio_format,
            filetypes=[(f"{format_name}音频文件", f"*{audio_format}"), ("所有文件", "*.*")],
            initialfile=f"{title} - {artist}{audio_format}"
        )
        if not filename:
            return

        try:
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            resp_head = requests.head(url, headers=headers, timeout=10)
            total_size = int(resp_head.headers.get('content-length', 0))
        except Exception:
            total_size = 0

        progress_window = DownloadProgressWindow(self.root, title, total_size)
        progress_window.show()
        self._set_buttons_state(False, include_download=True)

        thread = threading.Thread(target=self._download_thread_with_progress,
                                  args=(url, filename, progress_window))
        thread.daemon = True
        thread.start()

    def _download_thread_with_progress(self, url, filename, progress_window):
        try:
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            response = requests.get(url, headers=headers, stream=True, timeout=30)
            response.raise_for_status()

            downloaded = 0
            start_time = None

            with open(filename, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if progress_window.is_cancelled():
                        break
                    if chunk:
                        if start_time is None:
                            start_time = time.time()
                        f.write(chunk)
                        downloaded += len(chunk)
                        elapsed = time.time() - start_time
                        speed = downloaded / elapsed / 1024 if elapsed > 0 else 0
                        progress_window.update(downloaded, speed)

            if progress_window.is_cancelled():
                progress_window.close()
                if os.path.exists(filename):
                    os.remove(filename)
                self.root.after(0, lambda: self._set_buttons_state(True, include_download=True))
                self.root.after(0, lambda: messagebox.showinfo("下载已取消", "下载已取消"))
                return

            progress_window.complete()
            self.root.after(0, lambda: self._on_download_complete(True, filename))
        except Exception as e:
            progress_window.close()
            if progress_window.is_cancelled():
                if os.path.exists(filename):
                    os.remove(filename)
                self.root.after(0, lambda: self._set_buttons_state(True, include_download=True))
                self.root.after(0, lambda: messagebox.showinfo("下载已取消", "下载已取消"))
            else:
                self.root.after(0, lambda err=str(e): self._on_download_complete(False, err))

    def download_lrc(self):
        song = self.current_song
        if not song:
            messagebox.showinfo("提示", "请先播放或双击选择一首歌曲")
            return

        title = song.get('title') or '未知歌名'
        artist = song.get('artist') or '未知歌手'
        filename = filedialog.asksaveasfilename(
            defaultextension=".lrc",
            filetypes=[("LRC歌词文件", "*.lrc")],
            initialfile=f"{title} - {artist}.lrc"
        )
        if not filename:
            return

        try:
            lrc_data = song.get('lrc_lyrics') or []
            if lrc_data:
                lines = []
                for time_sec, text in lrc_data:
                    minutes = int(time_sec // 60)
                    seconds = int(time_sec % 60)
                    lines.append(f"[{minutes}:{seconds:02d}] {text}")
                content = "\n".join(lines)
            else:
                content = "\n".join(song.get('lyrics') or [])

            with open(filename, 'w', encoding='utf-8') as f:
                f.write(content)

            messagebox.showinfo("完成", f"歌词已保存到：\n{filename}")
        except Exception as e:
            messagebox.showerror("错误", f"保存失败：{e}")

    def _on_download_complete(self, success, message):
        self._set_buttons_state(True, include_download=True)
        if success:
            if messagebox.askyesno("下载完成", f"文件已保存到：\n{message}\n\n是否打开所在文件夹？"):
                try:
                    os.startfile(os.path.dirname(message))
                except Exception:
                    pass
        else:
            messagebox.showerror("下载失败", f"下载失败：{message}")

    def download_and_convert(self, song):
        """下载原始文件并转换为MP3"""
        title = song.get('title') or '未知歌名'
        artist = song.get('artist') or '未知歌手'
        output_file = filedialog.asksaveasfilename(
            defaultextension=".mp3",
            filetypes=[("MP3文件", "*.mp3")],
            initialfile=f"{title} - {artist}.mp3"
        )
        if not output_file:
            return

        audio_format = song.get('audio_format') or '.mp3'
        temp_file = os.path.join(tempfile.gettempdir(), f"temp_audio_{int(time.time())}{audio_format}")

        def worker():
            try:
                headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                response = requests.get(song.get('audio_url'), headers=headers, stream=True, timeout=30)
                response.raise_for_status()

                with open(temp_file, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)

                conv_window = ConvertProgressWindow(self.root, title)
                conv_window.show()
                success = FFmpegInstaller.convert_to_mp3(temp_file, output_file, conv_window.update_progress)
                conv_window.complete(success)

                if os.path.exists(temp_file):
                    os.remove(temp_file)

                if success:
                    def ask_open():
                        if messagebox.askyesno("转换完成", f"MP3文件已保存到：\n{output_file}\n\n是否打开所在文件夹？"):
                            try:
                                os.startfile(os.path.dirname(output_file))
                            except Exception:
                                pass
                    self.root.after(0, ask_open)
                else:
                    self.root.after(0, lambda: messagebox.showerror("转换失败", "转换失败，请检查文件格式是否正确"))
            except Exception as e:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
                self.root.after(0, lambda err=str(e): messagebox.showerror("错误", f"处理失败：{err}"))

        threading.Thread(target=worker, daemon=True).start()

    def clear_cache(self):
        size_mb = self.cache.total_size() / 1024 / 1024
        cover_mb = self.cover_cache.total_size() / 1024 / 1024
        if not messagebox.askyesno("清空缓存",
                                   f"当前播放缓存占用 {size_mb:.1f} MB、封面缓存 {cover_mb:.1f} MB，确定清空吗？\n"
                                   "（正在播放的歌曲需要重新缓冲）"):
            return
        self.player.close()
        self._play_state = "stopped"
        self.play_btn.config(text="▶ 播放", state=tk.NORMAL)
        self.cache.clear()
        self.cover_cache.clear()

    def open_browser(self):
        song = self.current_song
        if song and song.get('page_url'):
            webbrowser.open(song['page_url'])
        else:
            webbrowser.open("https://higequ.com")

    def show_about(self):
        messagebox.showinfo("关于",
                            f"音乐播放器 {CURRENT_DISPLAY_VERSION}\n\n"
                            "仅供顺德一中内部使用，严禁对外传播\n"
                            "原作者：aiLinMc\n\n"
                            "⚠️ 内部使用声明：本工具仅限顺德一中内部使用\n"
                            "歌曲数据来源：Hi歌曲网 - https://higequ.com/\n"
                            "严禁对外传播、转载或商业使用")

    # ==================== 更新功能 ====================

    def check_update_on_startup(self):
        def check():
            try:
                has_update, internal_ver, display_ver, latest_changelog, historical_changelog = UpdateChecker.check_for_updates()
                if has_update:
                    self.root.after(0, lambda: UpdateDialog(self.root, True, display_ver, latest_changelog,
                                                            historical_changelog, self.perform_update).show())
                elif display_ver:
                    print(f"当前版本 {CURRENT_DISPLAY_VERSION}，已是最新")
            except Exception as e:
                print(f"检查更新出错: {e}")

        thread = threading.Thread(target=check)
        thread.daemon = True
        thread.start()

    def manual_check_update(self):
        def check():
            has_update, internal_ver, display_ver, latest_changelog, historical_changelog = UpdateChecker.check_for_updates()
            self.root.after(0, lambda: self._on_check_complete(has_update, display_ver,
                                                               latest_changelog, historical_changelog))

        thread = threading.Thread(target=check)
        thread.daemon = True
        thread.start()

    def _on_check_complete(self, has_update, display_version, latest_changelog, historical_changelog):
        if has_update:
            UpdateDialog(self.root, True, display_version, latest_changelog, historical_changelog,
                         self.perform_update).show()
        elif display_version:
            UpdateDialog(self.root, False, display_version, latest_changelog, historical_changelog).show()
        else:
            messagebox.showerror("检查更新", "检查更新失败，请检查网络连接")

    def perform_update(self):
        self._set_buttons_state(False)
        # 释放音频设备，避免更新时文件被占用
        self.player.close()
        self._play_state = "stopped"
        self.update_progress_window = UpdateProgressWindow(self.root)
        self.update_progress_window.show()

    # ==================== 辅助函数 ====================

    def _set_buttons_state(self, enabled, include_download=False):
        state = tk.NORMAL if enabled else tk.DISABLED
        self.search_btn.config(state=state)

    def on_close(self):
        """窗口关闭时清理播放设备与桌面歌词窗口"""
        try:
            self.player.close()
            if self.desktop_lyrics:
                self.desktop_lyrics.close()
            self.library.save()
        except Exception as e:
            print(f"退出清理失败: {e}")
        self.root.destroy()


def main():
    root = tk.Tk()
    app = MusicPlayerGUI(root)
    root.protocol("WM_DELETE_WINDOW", app.on_close)
    root.mainloop()


if __name__ == "__main__":
    main()