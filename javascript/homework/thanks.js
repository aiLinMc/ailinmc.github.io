// thanks.js

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

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查本地存储的暗黑模式设置
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
    updateDarkModeButton();
});