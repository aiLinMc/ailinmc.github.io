// 作业内容数据
const homeworkData = `一、文化作业（假期认真完成作业，返校后上交）
·语文
1.周末作业四。
2.预习《故乡》画思维导图。
3.背诵《鱼我所欲也》原文+翻译。
·数学
重做数学试卷，自行打印答题卡。
·英语
1.完成周记。
2.E听说。
3.2篇阅读（积累好词好句）。
4.M5U2导学案剩下的练习。
5.更正听写，准备默写。
·物理
第九周午练卷。
·化学
课本P105-106、P115-116。
·道法 
周末作业试卷的选择题和材料题1-3小题。
·历史 
1.完成第3课学案。
2.整理历史资料（知识清单、目录关键词、考前两张复习资料）如有缺，私聊历史老师电子版自行打印。


二、备忘
◆剪指甲，整头发！穿白鞋（洗干净），外套拉拉链，衣服不要破洞，注意个人卫生，做好规范仪容仪表。
◆体育要求男生带7号篮球，女生带4号足球。
◆禁止携带违禁物品到学校。`;

// 最后更新日期（在此处修改）
const lastUpdateDate = "更新于2025年10月31日";

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
        // 检测 "◆" 开头的行 - 加上·
        else if (line.startsWith('◆')) {
            const content = line.substring(1).trim();
            if (!inList) {
                formattedHTML += '<ul class="bullet-list">';
                inList = true;
            }
            formattedHTML += `<li>${content}</li>`;
        }
        // 检测 "·" 开头的行 - 加粗但不加·
        else if (line.startsWith('·')) {
            const content = line.substring(1).trim();
            if (inList) {
                formattedHTML += '</ul>';
                inList = false;
            }
            formattedHTML += `<div class="normal-text"><span class="bold-text">${content}</span></div>`;
        }
        // 其他内容 - 普通文本，不加·
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
    
    const homeworkContent = document.getElementById('homework-content');
    homeworkContent.innerHTML = formatHomework(homeworkData);
    
    // 设置最后更新日期
    document.getElementById('date-info').textContent = `${lastUpdateDate}`;
});