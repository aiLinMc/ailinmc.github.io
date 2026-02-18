// feedback.js

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

// 根据上报原因显示/隐藏科目选择
function toggleSubjectField() {
    const reason = document.getElementById('reason').value;
    const subjectGroup = document.getElementById('subjectGroup');
    const subjectSelect = document.getElementById('subject');
    
    // 只有在原因为"错漏"时才显示科目选择
    if (reason === '错漏') {
        subjectGroup.style.display = 'block';
        subjectSelect.setAttribute('required', 'required');
    } else {
        subjectGroup.style.display = 'none';
        subjectSelect.removeAttribute('required');
    }
}

// 表单验证
function validateForm() {
    const nickname = document.getElementById('nickname').value.trim();
    const reason = document.getElementById('reason').value;
    const subject = document.getElementById('subject').value;
    const content = document.getElementById('content').value.trim();
    
    if (!nickname) {
        alert('请输入昵称');
        return false;
    }
    
    if (!reason) {
        alert('请选择上报原因');
        return false;
    }
    
    // 只有在原因为"错漏"时才验证科目
    if (reason === '错漏' && !subject) {
        alert('请选择上报科目');
        return false;
    }
    
    if (!content) {
        alert('请输入具体内容');
        return false;
    }
    
    return true;
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查本地存储的暗黑模式设置
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
    updateDarkModeButton();
    
    // 绑定上报原因变化事件
    const reasonSelect = document.getElementById('reason');
    reasonSelect.addEventListener('change', toggleSubjectField);
    
    // 绑定表单提交事件
    const form = document.getElementById('feedbackForm');
    form.addEventListener('submit', function(e) {
        if (!validateForm()) {
            e.preventDefault();
        }
    });
    
    // 初始化科目选择框状态
    toggleSubjectField();
});