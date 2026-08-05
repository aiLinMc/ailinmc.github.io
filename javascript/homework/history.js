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

// ===== 筛选逻辑（多选模式）=====
var selectedGrades = new Set(); // 不含"全部"，真实有效值集合
var selectedTerms = new Set();  // 不含"全部"，真实有效值集合
var searchText = '';
var gradeSort = 'desc';  // 九→七
var weekSort = 'asc';    // 小→大

// 各筛选项组的"全部有效值"（用于判断"全部"按钮派生状态）
var GRADE_ALL = ['七年级', '八年级', '九年级'];
var TERM_ALL = ['上学期', '下学期'];

// 根据当前选中值重绘按钮高亮状态
function updateFilterButtonsUI() {
    // ---- 年级组 ----
    var gradeAllBtn = document.querySelector('.filter-btn[data-filter="grade"][data-value="全部"]');
    var gradeAllOn = GRADE_ALL.every(function(v) { return selectedGrades.has(v); });
    if (gradeAllBtn) {
        gradeAllBtn.classList.toggle('active', gradeAllOn);
    }
    document.querySelectorAll('.filter-btn[data-filter="grade"]').forEach(function(btn) {
        var v = btn.dataset.value;
        if (v === '全部') return; // "全部"已上面处理
        btn.classList.toggle('active', selectedGrades.has(v));
    });

    // ---- 学期组 ----
    var termAllBtn = document.querySelector('.filter-btn[data-filter="term"][data-value="全部"]');
    var termAllOn = TERM_ALL.every(function(v) { return selectedTerms.has(v); });
    if (termAllBtn) {
        termAllBtn.classList.toggle('active', termAllOn);
    }
    document.querySelectorAll('.filter-btn[data-filter="term"]').forEach(function(btn) {
        var v = btn.dataset.value;
        if (v === '全部') return;
        btn.classList.toggle('active', selectedTerms.has(v));
    });
}

// ===== 混合搜索：中文 + 拼音（全拼/首字母/前缀）任意混合 =====
// 支持：第三z → "第" + "三" + 周(z)，diyi → 第一，jiux → 九下(x)，等等
function mixedSearch(query, text, pinyinMap) {
    // 允许跳过卡片中不匹配的字符（子序列匹配），query 全部被消费即成功
    var q = 0, t = 0;
    while (q < query.length && t < text.length) {
        var tc = text.charAt(t);
        var qc = query.charAt(q);

        // 卡片字符：ASCII（数字/英文字母）—— 只允许精确相等
        if (tc <= '\u007f') {
            if (tc.toLowerCase() === qc) { q++; t++; }
            else { t++; }
            continue;
        }

        // 卡片字符：中文 → 查拼音
        var py = pinyinMap[tc];
        if (!py) { t++; continue; } // 未知汉字，跳过

        // 查询字符：中文 —— 只有精确同一个字才匹配
        if (qc >= '\u4e00' && qc <= '\u9fff') {
            if (tc === qc) { q++; t++; }
            else { t++; }
            continue;
        }

        // 查询：ASCII，卡片：汉字 —— 拼音匹配（优先最长：全拼 > 前缀 > 首字母）
        var matched = false;
        var pyLen = py.length;
        // 1) 全拼
        if (q + pyLen <= query.length && query.substring(q, q + pyLen) === py) {
            q += pyLen; t++; matched = true;
        }
        // 2) 拼音前缀（长度 pyLen-1 到 2，先尝试更长的）
        if (!matched) {
            for (var k = pyLen - 1; k >= 2; k--) {
                if (q + k <= query.length && query.substring(q, q + k) === py.substring(0, k)) {
                    q += k; t++; matched = true; break;
                }
            }
        }
        // 3) 首字母（长度 1）
        if (!matched && qc === py.charAt(0)) {
            q++; t++; matched = true;
        }
        // 都没匹配：跳过当前汉字，尝试下一个
        if (!matched) { t++; }
    }
    return q >= query.length;
}

// 预处理：统一去掉分隔符并转小写
function normalizeQuery(s) {
    return s.replace(/['"\s\-·]/g, '').toLowerCase();
}

function applyFilter() {
    var cards = document.querySelectorAll('.week-card');
    var visibleCount = 0;

    // 原始输入 + 中文别名替换（上册→上学期等）两份都尝试（去掉分隔符 / 不去掉分隔符各自的别名版）
    var raw = searchText.trim();
    var rawAlias = raw.replace(/上册/g, '上学期').replace(/下册/g, '下学期');

    var q1 = normalizeQuery(raw);            // 原始（无分隔符，小写）
    var q2 = normalizeQuery(rawAlias);       // 别名替换后（无分隔符，小写）
    var qRawLower = raw.toLowerCase();
    var qAliasLower = rawAlias.toLowerCase();

    // 外部拼音映射表（定义在 history.html 内联脚本中，history.js 后加载，直接访问全局）
    var pinyinMap = window.PINYIN_MAP || {};

    cards.forEach(function(card) {
        var grade = card.dataset.grade;
        var term = card.dataset.term;
        var cardSearch = card.dataset.search || '';

        // 多选 OR：组内任一选中项匹配即可；组内全熄灭 → 不匹配任何卡片
        var gradeMatch = selectedGrades.size > 0 && selectedGrades.has(grade);
        var termMatch = selectedTerms.size > 0 && selectedTerms.has(term);

        var searchMatch = !q1; // 空查询 → 全匹配
        if (!searchMatch) {
            var cardSearchLower = cardSearch.toLowerCase();
            searchMatch = (cardSearchLower.indexOf(qRawLower) !== -1)
                || (cardSearchLower.indexOf(qAliasLower) !== -1)
                || (q1 && mixedSearch(q1, cardSearch, pinyinMap))
                || (q2 && q2 !== q1 && mixedSearch(q2, cardSearch, pinyinMap));
        }

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

    // 初始选中：两个组都选全部（所有项都点亮，进入页面即显示全部作业）
    GRADE_ALL.forEach(function(v) { selectedGrades.add(v); });
    TERM_ALL.forEach(function(v) { selectedTerms.add(v); });
    updateFilterButtonsUI();

    // ---- 筛选按钮点击（多选 + 全部按钮联动）----
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var filterType = this.dataset.filter;
            var value = this.dataset.value;
            var allValues = (filterType === 'grade') ? GRADE_ALL : TERM_ALL;
            var set = (filterType === 'grade') ? selectedGrades : selectedTerms;

            if (value === '全部') {
                // "全部"按钮：点击时切换【全选 / 全不选】
                var allOn = allValues.every(function(v) { return set.has(v); });
                if (allOn) {
                    // 原本全选 → 全部取消（set 变空 → 结果卡片全部消失）
                    allValues.forEach(function(v) { set.delete(v); });
                } else {
                    // 原本没全选 → 全部添加（→ 全部按钮派生 active = true）
                    allValues.forEach(function(v) { set.add(v); });
                }
            } else {
                // 普通筛选项：切换自身开/关
                if (set.has(value)) set.delete(value);
                else set.add(value);
            }

            updateFilterButtonsUI();
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
