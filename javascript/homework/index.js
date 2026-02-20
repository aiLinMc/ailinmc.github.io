// 从文件读取作业数据和改动历史
let homeworkData = '';
let changeHistory = [];

// 最后更新日期（将从此文件读取）
let lastUpdateDate = "";

// 默认作业数据（作为后备）
const defaultHomeworkData = `
作业内容加载失败，请刷新
`;

// 默认改动历史（作为后备）
const defaultChangeHistory = [];

// 显示加载状态
function showLoading(elementId, message = "加载中..." ) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div style="text-align: center; padding: 20px; color: #666;">${message}</div>`;
    }
}

// 读取更新日期文件
async function loadUpdateDate() {
    try {
        const response = await fetch('latest/update_date.txt');
        if (!response.ok) {
            throw new Error('更新日期文件读取失败');
        }
        const dateText = await response.text();
        if (dateText.trim()) {
            lastUpdateDate = `更新于${dateText.trim()}`;
        }
    } catch (error) {
        console.error('读取更新日期文件失败:', error);
        // 如果文件读取失败，保持默认日期
    }
    
    // 设置最后更新日期
    document.getElementById('date-info').textContent = lastUpdateDate;
}

// 读取作业文件
async function loadHomeworkData() {
    showLoading('homework-content', '作业内容加载中...');
    
    try {
        const response = await fetch('latest/homework.txt');
        if (!response.ok) {
            throw new Error('作业文件读取失败');
        }
        homeworkData = await response.text();
        displayHomeworkContent();
    } catch (error) {
        console.error('读取作业文件失败:', error);
        // 如果文件读取失败，使用默认数据
        homeworkData = defaultHomeworkData;
        displayHomeworkContent();
        
        // 显示错误提示
        const homeworkContent = document.getElementById('homework-content');
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 10px; margin: 10px 0; border-radius: 5px;';
        errorMsg.textContent = '提示：使用默认作业数据，如需更新请检查 homework.txt 文件';
        homeworkContent.parentNode.insertBefore(errorMsg, homeworkContent);
    }
}

// 读取改动历史文件
async function loadChangeHistory() {
    showLoading('changes-content', '改动历史加载中...');
    
    try {
        const response = await fetch('latest/changes.txt');
        if (!response.ok) {
            throw new Error('改动历史文件读取失败');
        }
        const changesText = await response.text();
        
        // 处理改动历史文本，按行分割并过滤空行
        changeHistory = changesText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        displayChangeHistory();
    } catch (error) {
        console.error('读取改动历史文件失败:', error);
        // 如果文件读取失败，使用默认数据
        changeHistory = defaultChangeHistory;
        displayChangeHistory();
    }
}

// 显示作业内容
function displayHomeworkContent() {
    const homeworkContent = document.getElementById('homework-content');
    if (homeworkContent) {
        homeworkContent.innerHTML = formatHomework(homeworkData);
    }
}

// 格式化函数
function formatHomework(text) {
    let formattedHTML = '';
    const lines = text.split('\n');
    let currentSection = '';
    let inList = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // 检测 "一、""二、"等标题
        if (line.match(/^[一二三四五六七八九十]、/)) {
            if (inList) {
                formattedHTML += '</ul>';
                inList = false;
            }
            formattedHTML += `<div class="section-title">${line}</div>`;
            currentSection = line;
        }
        // 检测科目标题（包含"作业"）
        else if (line.endsWith('作业')) {
            if (inList) {
                formattedHTML += '</ul>';
                inList = false;
            }
            formattedHTML += `<div class="section-title">${line}</div>`;
            currentSection = line;
        }
        // 检测 "=" 开头的行 - 加上·
        else if (line.startsWith('')) {
            const content = line.substring(1).trim();
            if (!inList) {
                formattedHTML += '<ul class="bullet-list">';
                inList = true;
            }
            formattedHTML += `<li>${content}</li>`;
        }
        // 检测 "·" 开头的行 - 加粗
        else if (line.startsWith('·')) {
            const content = line.substring(1).trim();
            if (inList) {
                formattedHTML += '</ul>';
                inList = false;
            }
            formattedHTML += `<div class="normal-text"><span class="bold-text">${content}</span></div>`;
        }
        // 其他内容 - 普通文本
        else {
            if (inList) {
                formattedHTML += '</ul>';
                inList = false;
            }
            formattedHTML += `<div class="normal-text">${line}</div>`;
        }
    }
    
    // 关闭最后一个列表
    if (inList) {
        formattedHTML += '</ul>';
    }
    
    return formattedHTML;
}

// 格式化改动历史条目
function formatChangeEntry(change) {
    // 使用正则表达式匹配英文括号及其内容
    const regex = /(\([^)]+\))(.*)/;
    const match = change.match(regex);
    
    if (match) {
        const datePart = match[1]; // 括号内的日期部分
        const contentPart = match[2].trim(); // 内容部分
        return `
            <div class="change-entry">
                <span class="change-date">${datePart}</span>
                <span class="change-content">${contentPart}</span>
            </div>
        `;
    } else {
        // 如果没有匹配到括号格式，按原样显示
        return `
            <div class="change-entry">
                <span class="change-content">${change}</span>
            </div>
        `;
    }
}

// 显示改动历史
function displayChangeHistory() {
    const changesContent = document.getElementById('changes-content');
    
    if (changeHistory.length === 0) {
        changesContent.innerHTML = '<p class="no-changes">暂无改动历史</p>';
    } else {
        let changesHTML = '<div class="changes-list">';
        changeHistory.forEach(change => {
            changesHTML += formatChangeEntry(change);
        });
        changesHTML += '</div>';
        changesContent.innerHTML = changesHTML;
    }
}

// 暗黑模式功能
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    updateDarkModeButton();
}

function updateDarkModeButton() {
    const button = document.querySelector('.dark-mode-toggle');
    if (document.body.classList.contains('dark-mode')) {
        button.textContent = '☀️';
    } else {
        button.textContent = '🌙';
    }
}

// 页面加载时显示格式化后的作业
document.addEventListener('DOMContentLoaded', function() {
    // 检查本地存储的暗黑模式设置
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
    updateDarkModeButton();
    
    // 加载更新日期、作业数据和改动历史
    loadUpdateDate();
    loadHomeworkData();
    loadChangeHistory();
});

// 99页面跳转功能 - 连续点击10次触发
let clickCount = 0;
let lastClickTime = 0;
function goTo99Page() {
    const now = Date.now();
    // 如果两次点击间隔超过3秒，重置计数
    if (now - lastClickTime > 3000) {
        clickCount = 0;
    }
    
    clickCount++;
    lastClickTime = now;
    
    // 连续点击10次触发
    if (clickCount === 10) {
        clickCount = 0; // 重置计数
        const cp = prompt('输入cp');
        if (cp !== null && cp.trim() !== '') {
            window.location.href = `99.html?cp=${encodeURIComponent(cp.trim())}`;
        }
    }
}