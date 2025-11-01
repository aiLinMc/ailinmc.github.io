// 折叠展开功能
function toggleSemester(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.toggle-icon');
    
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        icon.style.transform = 'rotate(0deg)';
    } else {
        content.classList.add('expanded');
        icon.style.transform = 'rotate(180deg)';
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

// 默认展开第一个学期（九年级上学期）
document.addEventListener('DOMContentLoaded', function() {
    // 检查本地存储的暗黑模式设置
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
    updateDarkModeButton();
    
    const firstSemester = document.querySelector('.semester-container:first-child .semester-content');
    const firstIcon = document.querySelector('.semester-container:first-child .toggle-icon');
    
    if (firstSemester && !firstSemester.classList.contains('expanded')) {
        firstSemester.classList.add('expanded');
        firstIcon.style.transform = 'rotate(180deg)';
    }
});