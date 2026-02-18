const mainText = document.getElementById('mainText');
const musicPlayerBtn = document.getElementById('musicPlayerBtn');
const musicText = document.getElementById('musicText');
const backgroundMusic = document.getElementById('backgroundMusic');
const danmakuBtn = document.getElementById('danmakuBtn');
const danmakuPanel = document.getElementById('danmakuPanel');
const closeDanmakuPanel = document.getElementById('closeDanmakuPanel');
const danmakuInput = document.getElementById('danmakuInput');
const sendDanmaku = document.getElementById('sendDanmaku');
const danmakuList = document.getElementById('danmakuList');
const danmakuContainer = document.getElementById('danmakuContainer');
const toast = document.getElementById('toast');

let isPlaying = false;
let danmakuMessages = JSON.parse(localStorage.getItem('danmakuMessages')) || [];
let originalCp = '';
let showCp = true;
let isBanned = false;
let toastTimeout = null;

// ###############################################
// 违禁词列表
const bannedWords = [
    "林子淳","lzc","23",
    "yslf","lsjz","玉树临风","龙生九子"
];
// ###############################################

const BANNED_MESSAGE = '不要做那些你不该做的事';

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function checkBannedWords(text) {
    return bannedWords.some(word => text.toLowerCase().includes(word.toLowerCase()));
}

function showToast(message, type = 'success') {
    // 清除之前的定时器，避免多个提示叠加影响计时
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    
    toastTimeout = setTimeout(() => {
        toast.className = 'toast';
        toastTimeout = null;
    }, 3000);
}

function updateMainText() {
    const cp = getUrlParameter('cp');
    const isMobile = window.innerWidth <= 768;
    
    if (cp) {
        originalCp = cp;
        isBanned = checkBannedWords(cp);
        
        if (isBanned) {
            mainText.textContent = BANNED_MESSAGE;
            mainText.style.fontSize = isMobile ? '40px' : '80px';
        } else {
            if (showCp) {
                mainText.textContent = cp;
            } else {
                mainText.textContent = '99';
            }
            
            if (cp.length > 12) {
                mainText.style.fontSize = isMobile ? '28px' : '60px';
            } else if (cp.length > 8) {
                mainText.style.fontSize = isMobile ? '36px' : '80px';
            } else {
                mainText.style.fontSize = isMobile ? '50px' : '150px';
            }
        }
    }
}

function createFloatingText(text, isDanmaku = false) {
    const element = document.createElement('div');
    element.className = 'danmaku-item';
    element.textContent = text;
    
    const size = Math.random() * 40 + 20;
    const opacity = Math.random() * 0.5 + 0.3;
    const speed = Math.random() * 8 + 5;
    const left = Math.random() * 80 + 10;
    const drift = (Math.random() - 0.5) * 200 + 'px';
    
    element.style.fontSize = size + 'px';
    element.style.opacity = opacity;
    element.style.animationDuration = speed + 's';
    element.style.left = left + '%';
    element.style.setProperty('--drift', drift);
    
    danmakuContainer.appendChild(element);
    
    setTimeout(() => {
        element.remove();
    }, speed * 1000);
}

function createStars() {
    const starsContainer = document.getElementById('stars');
    const starCount = 100;

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.width = Math.random() * 3 + 1 + 'px';
        star.style.height = star.style.width;
        star.style.animationDelay = Math.random() * 3 + 's';
        starsContainer.appendChild(star);
    }
}

function startFloatingTexts() {
    setInterval(() => {
        if (Math.random() < 0.6) {
            if (danmakuMessages.length > 0 && Math.random() < 0.4) {
                const randomDanmaku = danmakuMessages[Math.floor(Math.random() * danmakuMessages.length)];
                createFloatingText(randomDanmaku.text, true);
            } else {
                createFloatingText('99');
            }
        }
    }, 300);
}

function renderDanmakuList() {
    danmakuList.innerHTML = '';
    danmakuMessages.forEach((msg, index) => {
        const item = document.createElement('div');
        item.className = 'danmaku-item-list';
        item.innerHTML = `
            <span>${msg.text}</span>
            <div class="danmaku-item-actions">
                <button class="edit-btn" onclick="editDanmaku(${index})">编辑</button>
                <button class="delete-btn" onclick="deleteDanmaku(${index})">删除</button>
            </div>
        `;
        danmakuList.appendChild(item);
    });
}

function saveDanmakuMessages() {
    localStorage.setItem('danmakuMessages', JSON.stringify(danmakuMessages));
}

function sendDanmakuMessage() {
    const text = danmakuInput.value.trim();
    
    if (!text) {
        showToast('请输入文本', 'error');
        return;
    }
    
    if (checkBannedWords(text)) {
        showToast('弹幕包含违禁词，发送失败', 'error');
        return;
    }
    
    danmakuMessages.push({
        text: text,
        timestamp: Date.now()
    });
    
    saveDanmakuMessages();
    renderDanmakuList();
    danmakuInput.value = '';
    showToast('弹幕发送成功');
    
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            createFloatingText(text, true);
        }, i * 300);
    }
}

function editDanmaku(index) {
    const newText = prompt('编辑弹幕:', danmakuMessages[index].text);
    if (newText !== null && newText.trim()) {
        if (checkBannedWords(newText)) {
            showToast('弹幕包含违禁词，修改失败', 'error');
            return;
        }
        danmakuMessages[index].text = newText.trim();
        saveDanmakuMessages();
        renderDanmakuList();
        showToast('弹幕修改成功');
    }
}

function deleteDanmaku(index) {
    if (confirm('确定要删除这条弹幕吗？')) {
        danmakuMessages.splice(index, 1);
        saveDanmakuMessages();
        renderDanmakuList();
        showToast('弹幕删除成功');
    }
}

function toggleMusic() {
    if (isPlaying) {
        backgroundMusic.pause();
        musicText.textContent = '播放音乐';
        musicPlayerBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    } else {
        backgroundMusic.play();
        musicText.textContent = '暂停音乐';
        musicPlayerBtn.style.background = 'rgba(255, 255, 255, 0.4)';
    }
    isPlaying = !isPlaying;
}

function toggleDanmakuPanel() {
    if (danmakuPanel.style.display === 'none') {
        danmakuPanel.style.display = 'block';
    } else {
        danmakuPanel.style.display = 'none';
    }
}

musicPlayerBtn.addEventListener('click', toggleMusic);
danmakuBtn.addEventListener('click', toggleDanmakuPanel);
closeDanmakuPanel.addEventListener('click', toggleDanmakuPanel);
sendDanmaku.addEventListener('click', sendDanmakuMessage);

mainText.addEventListener('click', () => {
    if (!originalCp || isBanned) {
        return;
    }
    
    showCp = !showCp;
    updateMainText();
});

danmakuInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendDanmakuMessage();
    }
});

backgroundMusic.addEventListener('ended', () => {
    isPlaying = false;
    musicText.textContent = '播放音乐';
    musicPlayerBtn.style.background = 'rgba(255, 255, 255, 0.2)';
});

window.editDanmaku = editDanmaku;
window.deleteDanmaku = deleteDanmaku;

document.addEventListener('DOMContentLoaded', () => {
    updateMainText();
    createStars();
    startFloatingTexts();
    renderDanmakuList();
});
