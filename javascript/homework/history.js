// history.js

// ===== 深色模式 =====
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    var isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    updateDarkModeButton();
}

function updateDarkModeButton() {
    var button = document.querySelector('.dark-mode-toggle');
    if (document.body.classList.contains('dark-mode')) {
        button.textContent = '☀️';
    } else {
        button.textContent = '🌙';
    }
}

// ===== 筛选逻辑 =====
var currentGrade = '全部';
var currentTerm = '全部';
var searchText = '';
var gradeSort = 'desc';  // 九→七
var weekSort = 'asc';    // 小→大

function applyFilter() {
    var cards = document.querySelectorAll('.week-card');
    var visibleCount = 0;
    var search = searchText.trim().toLowerCase();
    // 别名：上册/下册 → 上学期/下学期
    search = search.replace(/上册/g, '上学期').replace(/下册/g, '下学期');

    cards.forEach(function(card) {
        var grade = card.dataset.grade;
        var term = card.dataset.term;
        var cardSearch = (card.dataset.search || '').toLowerCase();

        var gradeMatch = currentGrade === '全部' || grade === currentGrade;
        var termMatch = currentTerm === '全部' || term === currentTerm;
        var searchMatch = !search || cardSearch.indexOf(search) !== -1;

        if (gradeMatch && termMatch && searchMatch) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    document.getElementById('no-results').style.display = visibleCount === 0 ? 'block' : 'none';
    document.getElementById('resultInfo').textContent = '共 ' + visibleCount + ' 个结果';
}

// ===== 排序逻辑 =====
// 年级优先 → 学期 → 周数
function applySort() {
    var grid = document.getElementById('cards-grid');
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.week-card'));
    var gradeOrder = { '七年级': 7, '八年级': 8, '九年级': 9 };
    var termOrder = { '上学期': 1, '下学期': 2 };

    cards.sort(function(a, b) {
        // 主排序：年级
        var gradeA = gradeOrder[a.dataset.grade];
        var gradeB = gradeOrder[b.dataset.grade];
        if (gradeA !== gradeB) {
            return gradeSort === 'asc' ? gradeA - gradeB : gradeB - gradeA;
        }
        // 次排序：学期（方向跟随年级）
        var termA = termOrder[a.dataset.term];
        var termB = termOrder[b.dataset.term];
        if (termA !== termB) {
            return gradeSort === 'asc' ? termA - termB : termB - termA;
        }
        // 三级排序：周数
        var weekA = parseInt(a.dataset.week, 10);
        var weekB = parseInt(b.dataset.week, 10);
        return weekSort === 'asc' ? weekA - weekB : weekB - weekA;
    });

    // 重新追加（保留各卡片当前的 display 状态）
    cards.forEach(function(card) {
        grid.appendChild(card);
    });
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', function() {
    // 深色模式
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
    updateDarkModeButton();

    // 筛选按钮
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var filterType = this.dataset.filter;
            var value = this.dataset.value;

            // 同组内切换 active
            document.querySelectorAll('.filter-btn[data-filter="' + filterType + '"]').forEach(function(b) {
                b.classList.remove('active');
            });
            this.classList.add('active');

            if (filterType === 'grade') {
                currentGrade = value;
            } else if (filterType === 'term') {
                currentTerm = value;
            }

            applyFilter();
        });
    });

    // 搜索框
    document.getElementById('searchInput').addEventListener('input', function() {
        searchText = this.value;
        applyFilter();
    });

    // 排序下拉菜单
    document.getElementById('gradeSort').addEventListener('change', function() {
        gradeSort = this.value;
        applySort();
    });
    document.getElementById('weekSort').addEventListener('change', function() {
        weekSort = this.value;
        applySort();
    });

    // 初始排序 + 计数
    applySort();
    applyFilter();
});
