let expression = [];
let cursorPosition = 0;
let cursorContext = 'main';
let activeFractionId = null;
let activeRootId = null;
let activeSuperscriptId = null;
let activeSubscriptId = null;
let isUpperCase = false;
let isGreekMode = false;
let cursorVisible = true;
let cursorBlinkInterval = null;
let currentMode = 'normal';
let usedLetter = null;
let usedEqualitySign = false;
const lowercaseLetters = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'z', 'x', 'c', 'v', 'b', 'n', 'm'];
const uppercaseLetters = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Z', 'X', 'C', 'V', 'B', 'N', 'M'];
const greekLowercase = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω', 'Γ', 'Δ', 'Θ', 'Λ'];
const greekUppercase = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Λ', 'Μ', 'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω', 'α', 'β', 'γ', 'δ'];
const TERM_SEPARATORS = ['+', '-', '=', '≠', '<', '>', '≤', '≥'];
const EQUALITY_SIGNS = ['=', '≠', '<', '>', '≤', '≥'];
let lastResultLatex = '';
let lastResultText = '';
let lastProcessLatex = [];
let lastProcessText = [];
let allowImaginary = false;

function init() {
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
    // 加载虚数解开关状态
    const savedImaginary = localStorage.getItem(STORAGE_PREFIX + 'allowImaginary');
    if (savedImaginary !== null) {
        allowImaginary = savedImaginary === 'true';
        const toggle = document.getElementById('imaginaryToggle');
        if (toggle) {
            toggle.checked = allowImaginary;
        }
    }
    updateDarkModeButton();
    render();
    setupKeyboard();
    renderKeyboardKaTeX();
    updateKeyboardDisplay();
    updateModeButtons();
    startCursorBlink();

    loadFromUrlParams();
}

function setMode(mode) {
    saveCurrentExpression();
    currentMode = mode;
    usedLetter = null;
    usedEqualitySign = false;
    updateModeButtons();
    updateKeyboardDisplay();
    loadSavedExpression(mode);
    localStorage.setItem(STORAGE_PREFIX + 'mode', mode);
    
    const noticeEl = document.getElementById('modeNotice');
    if (noticeEl) {
        noticeEl.textContent = mode === 'equation' ? '目前只支持一元方程。方程组功能开发中，敬请期待' : '';
    }

    // 显示/隐藏方程选项
    const equationOptions = document.getElementById('equationOptions');
    if (equationOptions) {
        equationOptions.style.display = mode === 'equation' ? 'flex' : 'none';
    }

    // 如果历史记录面板是打开的，重新渲染当前模式的历史
    const historyPanel = document.getElementById('historyPanel');
    if (historyPanel && historyPanel.style.display !== 'none') {
        renderHistory();
    }
}

function toggleImaginary() {
    const toggle = document.getElementById('imaginaryToggle');
    allowImaginary = toggle.checked;
    localStorage.setItem(STORAGE_PREFIX + 'allowImaginary', allowImaginary);
    updateKeyboardDisplay();
}

function updateModeButtons() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === currentMode) {
            btn.classList.add('active');
        }
    });
}

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

function startCursorBlink() {
    if (cursorBlinkInterval) clearInterval(cursorBlinkInterval);
    cursorBlinkInterval = setInterval(() => {
        cursorVisible = !cursorVisible;
        render();
    }, 530);
}

function resetCursorBlink() {
    cursorVisible = true;
    clearInterval(cursorBlinkInterval);
    startCursorBlink();
}

function setupKeyboard() {
    document.querySelectorAll('.key').forEach(key => {
        key.addEventListener('click', handleKeyClick);
    });
    
    document.querySelectorAll('.keyboard-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const page = tab.dataset.page;
            document.querySelectorAll('.keyboard-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.keyboard-page').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.querySelector(`.keyboard-page[data-page="${page}"]`).classList.add('active');
        });
    });
    
    document.addEventListener('keydown', handlePhysicalKeyboard);
}

function renderKeyboardKaTeX() {
    document.querySelectorAll('.katex').forEach(span => {
        const latex = span.textContent;
        katex.render(latex, span, {
            throwOnError: false,
            displayMode: false
        });
    });
}

function renderMath(element, latex) {
    if (!latex) {
        element.textContent = '-';
        return;
    }
    try {
        katex.render(latex, element, {
            throwOnError: false,
            displayMode: true
        });
    } catch (e) {
        element.textContent = latex;
    }
}

function handleKeyClick(e) {
    const key = e.currentTarget;
    if (key.classList.contains('disabled')) return;

    const action = key.dataset.action;
    const value = key.dataset.value;
    const type = key.dataset.type;
    const power = key.dataset.power;

    resetCursorBlink();
    if (action) {
        if (action === 'insertSuperscript') {
            insertSuperscript(power);
        } else if (action === 'insertSubscript') {
            insertSubscript();
        } else {
            handleAction(action);
        }
    } else if (type === 'sqrt') {
        insertSqrt();
    } else if (type === 'cuberoot') {
        insertCubeRoot();
    } else if (type === 'nthroot') {
        showNthRootInput();
    } else if (value) {
        insertValue(value);
    }
}

function handleAction(action) {
    switch(action) {
        case 'moveLeft':
            moveCursorLeft();
            break;
        case 'moveRight':
            moveCursorRight();
            break;
        case 'delete':
            deleteAtCursor();
            break;
        case 'clear':
            clearExpression();
            break;
        case 'simplify':
            simplifyExpression();
            break;
        case 'confirmRoot':
            confirmNthRoot();
            break;
        case 'cancelRoot':
            cancelNthRoot();
            break;
        case 'insertSuperscript':
            insertSuperscript();
            break;
        case 'insertSubscript':
            insertSubscript();
            break;
        case 'toggleCase':
            toggleCase();
            break;
        case 'toggleGreek':
            toggleGreek();
            break;
        case 'moveToStart':
            moveToStart();
            break;
        case 'moveToEnd':
            moveToEnd();
            break;
        case 'moveToTermStart':
            moveToTermStart();
            break;
        case 'moveToTermEnd':
            moveToTermEnd();
            break;
        case 'moveToPrevTermEnd':
            moveToPrevTermEnd();
            break;
        case 'moveToNextTermStart':
            moveToNextTermStart();
            break;
    }
}

function toggleCase() {
    isUpperCase = !isUpperCase;
    updateKeyboardDisplay();
}

function toggleGreek() {
    isGreekMode = !isGreekMode;
    updateKeyboardDisplay();
}

function updateKeyboardDisplay() {
    const caseBtn = document.getElementById('caseBtn');
    const greekBtn = document.getElementById('greekBtn');

    if (!caseBtn || !greekBtn) return;

    caseBtn.textContent = isUpperCase ? '切换为小写' : '切换为大写';
    greekBtn.textContent = isGreekMode ? '切换为英文字母' : '切换为希腊字母';

    let letters = lowercaseLetters;
    if (isGreekMode && isUpperCase) {
        letters = greekUppercase;
    } else if (isGreekMode) {
        letters = greekLowercase;
    } else if (isUpperCase) {
        letters = uppercaseLetters;
    }

    document.querySelectorAll('.letter').forEach((btn, index) => {
        if (letters[index]) {
            btn.dataset.value = letters[index];
            btn.textContent = letters[index];
        }
    });

    document.querySelectorAll('.key').forEach(btn => {
        btn.classList.remove('disabled');
    });

    if (currentMode === 'calculator') {
        document.querySelectorAll('.letter').forEach(btn => btn.classList.add('disabled'));
        document.querySelectorAll('.key[data-action="toggleCase"]').forEach(btn => btn.classList.add('disabled'));
        document.querySelectorAll('.key[data-action="toggleGreek"]').forEach(btn => btn.classList.add('disabled'));
        document.querySelectorAll('.key[data-value="="]').forEach(btn => btn.classList.add('disabled'));
        document.querySelectorAll('.key[data-value="!="]').forEach(btn => btn.classList.add('disabled'));
        document.querySelectorAll('.key[data-value="<"]').forEach(btn => btn.classList.add('disabled'));
        document.querySelectorAll('.key[data-value=">"]').forEach(btn => btn.classList.add('disabled'));
        document.querySelectorAll('.key[data-value="<="]').forEach(btn => btn.classList.add('disabled'));
        document.querySelectorAll('.key[data-value=">="]').forEach(btn => btn.classList.add('disabled'));
    } else if (currentMode === 'equation') {
        document.querySelectorAll('.letter').forEach(btn => {
            const letterValue = btn.dataset.value;
            if (usedLetter && usedLetter !== letterValue) {
                btn.classList.add('disabled');
            }
            // 未允许虚数时禁用i
            if (!allowImaginary && (letterValue === 'i' || letterValue === 'I')) {
                btn.classList.add('disabled');
            }
        });
        // 禁用"符号与函数"中的i
        document.querySelectorAll('.key[data-value="i"]').forEach(btn => {
            if (!allowImaginary) {
                btn.classList.add('disabled');
            }
        });
        document.querySelectorAll('.key[data-action="toggleCase"]').forEach(btn => btn.classList.add('disabled'));
        document.querySelectorAll('.key[data-action="toggleGreek"]').forEach(btn => btn.classList.add('disabled'));

        if (usedEqualitySign) {
            document.querySelectorAll('.key[data-value="="]').forEach(btn => btn.classList.add('disabled'));
            document.querySelectorAll('.key[data-value="!="]').forEach(btn => btn.classList.add('disabled'));
            document.querySelectorAll('.key[data-value="<"]').forEach(btn => btn.classList.add('disabled'));
            document.querySelectorAll('.key[data-value=">"]').forEach(btn => btn.classList.add('disabled'));
            document.querySelectorAll('.key[data-value="<="]').forEach(btn => btn.classList.add('disabled'));
            document.querySelectorAll('.key[data-value=">="]').forEach(btn => btn.classList.add('disabled'));
        }
    } else if (currentMode === 'factor') {
        document.querySelectorAll('.key[data-value="="]').forEach(btn => btn.classList.add('disabled'));
        document.querySelectorAll('.key[data-value="!="]').forEach(btn => btn.classList.add('disabled'));
        document.querySelectorAll('.key[data-value="<"]').forEach(btn => btn.classList.add('disabled'));
        document.querySelectorAll('.key[data-value=">"]').forEach(btn => btn.classList.add('disabled'));
        document.querySelectorAll('.key[data-value="<="]').forEach(btn => btn.classList.add('disabled'));
        document.querySelectorAll('.key[data-value=">="]').forEach(btn => btn.classList.add('disabled'));
    }
}

function handlePhysicalKeyboard(e) {
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        resetCursorBlink();
        moveCursorLeft();
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        resetCursorBlink();
        moveCursorRight();
    } else if (e.key === 'Backspace') {
        e.preventDefault();
        resetCursorBlink();
        deleteAtCursor();
    } else if (e.key === 'Delete') {
        e.preventDefault();
        resetCursorBlink();
        deleteAtCursor();
    } else if (e.key === 'Escape') {
        resetCursorBlink();
        clearExpression();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        simplifyExpression();
    } else {
        const key = e.key;
        if (isKeyAllowed(key)) {
            e.preventDefault();
            resetCursorBlink();
            insertValue(key);
        }
    }
}

function isKeyAllowed(key) {
    if (!key || key.length !== 1) return false;
    
    const isNumber = /[0-9]/.test(key);
    const isLetter = /[a-zA-Z]/.test(key);
    const isOperator = ['+', '-', '*', '/'].includes(key);
    const isBracket = ['(', ')', '[', ']'].includes(key);
    const isEqualitySign = EQUALITY_SIGNS.includes(key);
    const isSpecial = ['.', ',', '%'].includes(key);
    
    if (currentMode === 'calculator') {
        if (isLetter) return false;
        if (isEqualitySign) return false;
    } else if (currentMode === 'equation') {
        if (isLetter && usedLetter && key !== usedLetter) return false;
        if (isEqualitySign && usedEqualitySign) return false;
        if (!allowImaginary && (key === 'i' || key === 'I')) return false;
    } else if (currentMode === 'factor') {
        if (isEqualitySign) return false;
    }
    
    return isNumber || isLetter || isOperator || isBracket || isEqualitySign || isSpecial;
}

function insertValue(value) {
    insertValueInternal(value);
}

function insertValueInternal(value) {
    if (value === '/') {
        insertFraction();
        return;
    }
    
    if (currentMode === 'equation') {
        const mathConstants = ['π', 'e', 'i'];
        const isMathConstant = mathConstants.includes(value);
        const isLetter = /[a-zA-Zα-ωΑ-Ω]/.test(value);
        const isEqualitySign = EQUALITY_SIGNS.includes(value);
        if (isLetter && !isMathConstant && !usedLetter) {
            usedLetter = value;
        } else if (isEqualitySign && !usedEqualitySign) {
            usedEqualitySign = true;
        }
        updateKeyboardDisplay();
    }
    const node = createNode(value);
    insertNode(node);
    render();
    autoSave();
}

function createNode(value) {
    return {
        type: 'text',
        value: value,
        id: Date.now() + Math.random()
    };
}

function cursorLatex() {
    // 返回可见或不可见的闪烁光标占位符
    return cursorVisible ? '\\underline{\\phantom{a}}' : '\\phantom{\\underline{a}}';
}

function insertNode(node) {
    if (cursorContext === 'fraction-numerator') {
        let fraction = findFractionAtCursor();
        if (!fraction) fraction = findParentFraction();
        if (fraction) {
            fraction.numerator.splice(cursorPosition, 0, node);
            cursorPosition = Math.min(cursorPosition + 1, fraction.numerator.length);
            return;
        }
    } else if (cursorContext === 'fraction-denominator') {
        let fraction = findFractionAtCursor();
        if (!fraction) fraction = findParentFraction();
        if (fraction) {
            fraction.denominator.splice(cursorPosition, 0, node);
            cursorPosition = Math.min(cursorPosition + 1, fraction.denominator.length);
            return;
        }
    } else if (cursorContext === 'sqrt-content' || cursorContext === 'cuberoot-content' || cursorContext === 'nthroot-content') {
        const root = findRootAtCursor();
        if (root) {
            root.content.splice(cursorPosition, 0, node);
            cursorPosition = Math.min(cursorPosition + 1, root.content.length);
            return;
        }
    } else if (cursorContext === 'superscript') {
        const sup = findSuperscriptAtCursor();
        if (sup) {
            sup.exponent.splice(cursorPosition, 0, node);
            cursorPosition = Math.min(cursorPosition + 1, sup.exponent.length);
            return;
        }
    } else if (cursorContext === 'subscript') {
        const sub = findSubscriptAtCursor();
        if (sub) {
            sub.subscript.splice(cursorPosition, 0, node);
            cursorPosition = Math.min(cursorPosition + 1, sub.subscript.length);
            return;
        }
    }

    expression.splice(cursorPosition, 0, node);
    cursorPosition = Math.min(cursorPosition + 1, expression.length);
}

function insertFraction() {
    const fraction = {
        type: 'fraction',
        numerator: [],
        denominator: [],
        id: Date.now() + Math.random()
    };

    let arr, pos;
    if (cursorContext === 'main') {
        arr = expression;
        pos = cursorPosition;
    } else if (cursorContext === 'fraction-numerator' || cursorContext === 'fraction-denominator') {
        const parentFrac = findParentFraction();
        if (parentFrac) {
            arr = cursorContext === 'fraction-numerator' ? parentFrac.numerator : parentFrac.denominator;
            pos = cursorPosition;
        } else {
            arr = expression;
            pos = cursorPosition;
        }
    } else if (cursorContext === 'sqrt-content' || cursorContext === 'cuberoot-content' || cursorContext === 'nthroot-content') {
        const root = findRootAtCursor();
        if (root) {
            arr = root.content;
            pos = cursorPosition;
        } else {
            insertNode(fraction);
            cursorContext = 'fraction-numerator';
            activeFractionId = fraction.id;
            cursorPosition = 0;
            render();
            return;
        }
    } else if (cursorContext === 'superscript') {
        const sup = findSuperscriptAtCursor();
        if (sup) {
            arr = sup.exponent;
            pos = cursorPosition;
        } else {
            insertNode(fraction);
            cursorContext = 'fraction-numerator';
            activeFractionId = fraction.id;
            cursorPosition = 0;
            render();
            return;
        }
    } else if (cursorContext === 'subscript') {
        const sub = findSubscriptAtCursor();
        if (sub) {
            arr = sub.subscript;
            pos = cursorPosition;
        } else {
            insertNode(fraction);
            cursorContext = 'fraction-numerator';
            activeFractionId = fraction.id;
            cursorPosition = 0;
            render();
            return;
        }
    } else {
        // 其他未知上下文，直接插入空分数
        insertNode(fraction);
        cursorContext = 'fraction-numerator';
        activeFractionId = fraction.id;
        cursorPosition = 0;
        render();
        return;
    }

    // 查找当前项
    const termInfo = findCurrentTerm(arr, pos);
    if (termInfo) {
        let termNodes = termInfo.term;
        termNodes = stripOuterParentheses(termNodes);
        fraction.numerator = createParenthesizedContent(termNodes);
        arr.splice(termInfo.start, termInfo.length, fraction);
        // 有项时，光标跳到分母等待输入
        cursorContext = 'fraction-denominator';
        activeFractionId = fraction.id;
        cursorPosition = 0;
    } else {
        // 无项时，插入空分数，光标放在分子
        arr.splice(pos, 0, fraction);
        cursorContext = 'fraction-numerator';
        activeFractionId = fraction.id;
        cursorPosition = 0;
    }

    render();
}

function findCurrentTerm(arr, pos) {
    if (pos === 0 || arr.length === 0) return null;

    let start = 0;
    let depth = 0;
    let i;
    for (i = pos - 1; i >= 0; i--) {
        const node = arr[i];
        if (node.type === 'text') {
            if (node.value === ')' || node.value === '）') {
                depth++;
            } else if (node.value === '(' || node.value === '（') {
                depth--;
                if (depth === 0) { start = i; break; }
            } else if (depth === 0 && (node.value === '+' || node.value === '-' || 
                                    node.value === '=' || node.value === '≠' || 
                                    node.value === '<' || node.value === '>' ||
                                    node.value === '≤' || node.value === '≥')) {
            start = i + 1;
            break;
        }
        }
    }
    if (i < 0 && depth === 0) start = 0;
    if (depth > 0) return null;

    const length = pos - start;
    if (length <= 0) return null;
    const term = arr.slice(start, pos);
    return { start, length, term };
}

function stripOuterParentheses(nodes) {
    if (!nodes || nodes.length < 2) return nodes;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (first.type === 'text' && last.type === 'text') {
        if ((first.value === '(' && last.value === ')') || (first.value === '（' && last.value === '）')) {
            return nodes.slice(1, nodes.length - 1);
        }
    }
    return nodes;
}

function createParenthesizedContent(nodes) {
    if (!nodes || nodes.length === 0) return nodes;

    const hasOperator = nodes.some(n => {
        if (n.type === 'text') return n.value === '+' || n.value === '-' || n.value === '×' || n.value === '÷';
        return n.type === 'fraction' || n.type === 'sqrt' || n.type === 'cuberoot' ||
               n.type === 'nthroot' || n.type === 'superscript' || n.type === 'subscript';
    });

    if (!hasOperator && nodes.length === 1) {
        const n = nodes[0];
        if (n.type === 'text' && n.value.length === 1) return nodes;
    }

    if (hasOperator) {
        const result = [];
        result.push({ type: 'text', value: '(', id: Date.now() + Math.random() });
        result.push(...nodes);
        result.push({ type: 'text', value: ')', id: Date.now() + Math.random() });
        return result;
    }
    return nodes;
}

function findParentFraction() {
    return findFractionByIdRecursive(expression, activeFractionId);
}

function findFractionByIdRecursive(arr, targetId) {
    for (const node of arr) {
        if (node.type === 'fraction') {
            if (node.id === targetId) return node;
            let found = findFractionByIdRecursive(node.numerator, targetId);
            if (found) return found;
            found = findFractionByIdRecursive(node.denominator, targetId);
            if (found) return found;
        } else if (node.type === 'sqrt' || node.type === 'cuberoot' || node.type === 'nthroot') {
            if (node.content) {
                let found = findFractionByIdRecursive(node.content, targetId);
                if (found) return found;
            }
        } else if (node.type === 'superscript') {
            if (node.exponent) {
                let found = findFractionByIdRecursive(node.exponent, targetId);
                if (found) return found;
            }
        } else if (node.type === 'subscript') {
            if (node.subscript) {
                let found = findFractionByIdRecursive(node.subscript, targetId);
                if (found) return found;
            }
        }
    }
    return null;
}

function insertSqrt() {
    const sqrt = { type: 'sqrt', content: [], id: Date.now() + Math.random() };
    insertNode(sqrt);
    activeRootId = sqrt.id;
    cursorContext = 'sqrt-content';
    cursorPosition = 0;
    render();
}

function insertCubeRoot() {
    const cuberoot = { type: 'cuberoot', content: [], id: Date.now() + Math.random() };
    insertNode(cuberoot);
    activeRootId = cuberoot.id;
    cursorContext = 'cuberoot-content';
    cursorPosition = 0;
    render();
}

function insertNthRoot(n) {
    const nthroot = { type: 'nthroot', index: n, content: [], id: Date.now() + Math.random() };
    insertNode(nthroot);
    activeRootId = nthroot.id;
    cursorContext = 'nthroot-content';
    cursorPosition = 0;
    render();
}

function showNthRootInput() {
    document.getElementById('nthRootInput').classList.add('show');
    document.getElementById('rootIndex').focus();
}

function confirmNthRoot() {
    const n = parseInt(document.getElementById('rootIndex').value) || 3;
    document.getElementById('nthRootInput').classList.remove('show');
    insertNthRoot(n);
}

function cancelNthRoot() {
    document.getElementById('nthRootInput').classList.remove('show');
}

function insertSuperscript(power) {
    const sup = { 
        type: 'superscript', 
        exponent: [], 
        id: Date.now() + Math.random() 
    };
    
    if (power !== undefined && power !== '') {
        sup.exponent.push(createNode(power));
    }
    
    insertNode(sup);
    cursorContext = 'superscript';
    activeSuperscriptId = sup.id;
    cursorPosition = sup.exponent.length;
    render();
}

function insertSubscript() {
    const sub = { type: 'subscript', subscript: [], id: Date.now() + Math.random() };
    insertNode(sub);
    cursorContext = 'subscript';
    activeSubscriptId = sub.id;
    cursorPosition = sub.subscript.length;
    render();
}

function findFractionAtCursor() {
    if (cursorContext === 'fraction-numerator' || cursorContext === 'fraction-denominator') {
        return findParentFraction();
    }
    for (let i = expression.length - 1; i >= 0; i--) {
        if (expression[i].type === 'fraction') return expression[i];
    }
    return null;
}

function findRootAtCursor() {
    return findRootByIdRecursive(expression, activeRootId);
}

function findRootByIdRecursive(arr, targetId) {
    for (const node of arr) {
        if (node.type === 'sqrt' || node.type === 'cuberoot' || node.type === 'nthroot') {
            if (node.id === targetId) return node;
            if (node.content) {
                let found = findRootByIdRecursive(node.content, targetId);
                if (found) return found;
            }
        } else if (node.type === 'fraction') {
            let found = findRootByIdRecursive(node.numerator, targetId);
            if (found) return found;
            found = findRootByIdRecursive(node.denominator, targetId);
            if (found) return found;
        } else if (node.type === 'superscript') {
            if (node.exponent) {
                let found = findRootByIdRecursive(node.exponent, targetId);
                if (found) return found;
            }
        } else if (node.type === 'subscript') {
            if (node.subscript) {
                let found = findRootByIdRecursive(node.subscript, targetId);
                if (found) return found;
            }
        }
    }
    return null;
}

function findSuperscriptAtCursor() {
    return findSuperscriptInNested(expression, activeSuperscriptId);
}

function findSuperscriptInNested(arr, targetId) {
    for (const node of arr) {
        if (node.type === 'superscript') {
            if (node.id === targetId) {
                return node;
            }
            if (node.exponent) {
                const found = findSuperscriptInNested(node.exponent, targetId);
                if (found) return found;
            }
        } else if (node.type === 'fraction') {
            let found = findSuperscriptInNested(node.numerator, targetId);
            if (found) return found;
            found = findSuperscriptInNested(node.denominator, targetId);
            if (found) return found;
        } else if (node.type === 'sqrt' || node.type === 'cuberoot' || node.type === 'nthroot') {
            if (node.content) {
                const found = findSuperscriptInNested(node.content, targetId);
                if (found) return found;
            }
        } else if (node.type === 'subscript') {
            if (node.subscript) {
                const found = findSuperscriptInNested(node.subscript, targetId);
                if (found) return found;
            }
        }
    }
    return null;
}

function findSubscriptAtCursor() {
    return findSubscriptInNested(expression, activeSubscriptId);
}

function findSubscriptInNested(arr, targetId) {
    for (const node of arr) {
        if (node.type === 'subscript') {
            if (node.id === targetId) {
                return node;
            }
            if (node.subscript) {
                const found = findSubscriptInNested(node.subscript, targetId);
                if (found) return found;
            }
        } else if (node.type === 'fraction') {
            let found = findSubscriptInNested(node.numerator, targetId);
            if (found) return found;
            found = findSubscriptInNested(node.denominator, targetId);
            if (found) return found;
        } else if (node.type === 'sqrt' || node.type === 'cuberoot' || node.type === 'nthroot') {
            if (node.content) {
                const found = findSubscriptInNested(node.content, targetId);
                if (found) return found;
            }
        } else if (node.type === 'superscript') {
            if (node.exponent) {
                const found = findSubscriptInNested(node.exponent, targetId);
                if (found) return found;
            }
        }
    }
    return null;
}

function moveCursorLeft() {
    if (cursorContext === 'fraction-numerator') {
        const fraction = findFractionAtCursor();
        if (fraction) {
            if (activeFractionId !== fraction.id) activeFractionId = fraction.id;
            if (cursorPosition > 0) {
                cursorPosition--;
                const nodeAtPos = fraction.numerator[cursorPosition];
                if (nodeAtPos && nodeAtPos.type === 'fraction') {
                    activeFractionId = nodeAtPos.id;
                    cursorContext = 'fraction-numerator';
                    cursorPosition = nodeAtPos.numerator.length;
                    render();
                    return;
                }
            } else {
                const container = findNodeContainer(fraction);
                if (container) {
                    cursorContext = container.context;
                    activeFractionId = container.parentFractionId;
                    cursorPosition = container.index;
                }
            }
        }
    } else if (cursorContext === 'fraction-denominator') {
        const fraction = findFractionAtCursor();
        if (fraction) {
            if (activeFractionId !== fraction.id) activeFractionId = fraction.id;
            if (cursorPosition > 0) {
                cursorPosition--;
                const nodeAtPos = fraction.denominator[cursorPosition];
                if (nodeAtPos && nodeAtPos.type === 'fraction') {
                    activeFractionId = nodeAtPos.id;
                    cursorContext = 'fraction-denominator';
                    cursorPosition = nodeAtPos.denominator.length;
                    render();
                    return;
                }
            } else {
                cursorContext = 'fraction-numerator';
                const lastNode = fraction.numerator.length > 0 ? fraction.numerator[fraction.numerator.length - 1] : null;
                if (lastNode && lastNode.type === 'fraction') {
                    activeFractionId = lastNode.id;
                    cursorPosition = lastNode.numerator.length;
                } else {
                    cursorPosition = fraction.numerator.length;
                }
            }
        }
    } else if (cursorContext === 'sqrt-content' || cursorContext === 'cuberoot-content' || cursorContext === 'nthroot-content') {
        const root = findRootAtCursor();
        if (root) {
            if (cursorPosition > 0) {
                cursorPosition--;
                const nodeAtPos = root.content[cursorPosition];
                if (nodeAtPos && nodeAtPos.type === 'fraction') {
                    // 左移进入根号内的分数，定位到分母末尾
                    activeFractionId = nodeAtPos.id;
                    cursorContext = 'fraction-denominator';
                    cursorPosition = nodeAtPos.denominator.length;
                    render();
                    return;
                }
            } else {
                const container = findNodeContainer(root);
                if (container) {
                    cursorContext = container.context;
                    if (root.id) activeRootId = null;
                    cursorPosition = container.index;
                }
            }
        }
    } else if (cursorContext === 'superscript') {
        const sup = findSuperscriptAtCursor();
        if (sup) {
            if (cursorPosition > 0) {
                cursorPosition--;
                const nodeAtPos = sup.exponent[cursorPosition];
                if (nodeAtPos && nodeAtPos.type === 'fraction') {
                    activeFractionId = nodeAtPos.id;
                    cursorContext = 'fraction-denominator';
                    cursorPosition = nodeAtPos.denominator.length;
                    render();
                    return;
                }
            } else {
                const container = findNodeContainer(sup);
                if (container) {
                    cursorContext = container.context;
                    activeSuperscriptId = null;
                    cursorPosition = container.index;
                }
            }
        }
    } else if (cursorContext === 'subscript') {
        const sub = findSubscriptAtCursor();
        if (sub) {
            if (cursorPosition > 0) {
                cursorPosition--;
                const nodeAtPos = sub.subscript[cursorPosition];
                if (nodeAtPos && nodeAtPos.type === 'fraction') {
                    activeFractionId = nodeAtPos.id;
                    cursorContext = 'fraction-denominator';
                    cursorPosition = nodeAtPos.denominator.length;
                    render();
                    return;
                }
            } else {
                const container = findNodeContainer(sub);
                if (container) {
                    cursorContext = container.context;
                    activeSubscriptId = null;
                    cursorPosition = container.index;
                }
            }
        }
    } else {
        // main 上下文
        if (cursorPosition > 0) {
            cursorPosition--;
            const nodeAtPos = expression[cursorPosition];
            if (nodeAtPos && nodeAtPos.type === 'fraction') {
                activeFractionId = nodeAtPos.id;
                cursorContext = 'fraction-denominator';
                cursorPosition = nodeAtPos.denominator.length;
                render();
                return;
            } else if (nodeAtPos && (nodeAtPos.type === 'sqrt' || nodeAtPos.type === 'cuberoot' || nodeAtPos.type === 'nthroot')) {
                activeRootId = nodeAtPos.id;
                cursorContext = nodeAtPos.type + '-content';
                cursorPosition = nodeAtPos.content.length;
                render();
                return;
            } else if (nodeAtPos && nodeAtPos.type === 'superscript') {
                activeSuperscriptId = nodeAtPos.id;
                cursorContext = 'superscript';
                cursorPosition = nodeAtPos.exponent.length;
                render();
                return;
            } else if (nodeAtPos && nodeAtPos.type === 'subscript') {
                activeSubscriptId = nodeAtPos.id;
                cursorContext = 'subscript';
                cursorPosition = nodeAtPos.subscript.length;
                render();
                return;
            }
            updateContextForPosition();
        }
    }
    render();
}

function moveCursorRight() {
    if (cursorContext === 'fraction-numerator') {
        const fraction = findFractionAtCursor();
        if (fraction) {
            if (activeFractionId !== fraction.id) activeFractionId = fraction.id;
            if (cursorPosition < fraction.numerator.length) {
                const nextNode = fraction.numerator[cursorPosition];
                if (nextNode && nextNode.type === 'fraction') {
                    activeFractionId = nextNode.id;
                    cursorContext = 'fraction-numerator';
                    cursorPosition = 0;
                    render();
                    return;
                }
                cursorPosition++;
            } else {
                cursorContext = 'fraction-denominator';
                const firstNode = fraction.denominator.length > 0 ? fraction.denominator[0] : null;
                if (firstNode && firstNode.type === 'fraction') {
                    activeFractionId = firstNode.id;
                    cursorContext = 'fraction-numerator';
                    cursorPosition = 0;
                } else {
                    cursorPosition = 0;
                }
            }
        }
    } else if (cursorContext === 'fraction-denominator') {
        const fraction = findFractionAtCursor();
        if (fraction) {
            if (activeFractionId !== fraction.id) activeFractionId = fraction.id;
            if (cursorPosition < fraction.denominator.length) {
                const nextNode = fraction.denominator[cursorPosition];
                if (nextNode && nextNode.type === 'fraction') {
                    activeFractionId = nextNode.id;
                    cursorContext = 'fraction-numerator';
                    cursorPosition = 0;
                    render();
                    return;
                }
                cursorPosition++;
            } else {
                const container = findNodeContainer(fraction);
                if (container) {
                    cursorContext = container.context;
                    activeFractionId = container.parentFractionId;
                    cursorPosition = container.index + 1;
                }
            }
        }
    } else if (cursorContext === 'sqrt-content' || cursorContext === 'cuberoot-content' || cursorContext === 'nthroot-content') {
        const root = findRootAtCursor();
        if (root) {
            if (cursorPosition < root.content.length) {
                const nextNode = root.content[cursorPosition];
                if (nextNode && nextNode.type === 'fraction') {
                    // 右移进入根号内的分数，定位到分子开头
                    activeFractionId = nextNode.id;
                    cursorContext = 'fraction-numerator';
                    cursorPosition = 0;
                    render();
                    return;
                }
                cursorPosition++;
            } else {
                const container = findNodeContainer(root);
                if (container) {
                    cursorContext = container.context;
                    activeRootId = null;
                    cursorPosition = container.index + 1;
                }
            }
        }
    } else if (cursorContext === 'superscript') {
        const sup = findSuperscriptAtCursor();
        if (sup) {
            if (cursorPosition < sup.exponent.length) {
                const nextNode = sup.exponent[cursorPosition];
                if (nextNode && nextNode.type === 'fraction') {
                    activeFractionId = nextNode.id;
                    cursorContext = 'fraction-numerator';
                    cursorPosition = 0;
                    render();
                    return;
                }
                cursorPosition++;
            } else {
                const container = findNodeContainer(sup);
                if (container) {
                    cursorContext = container.context;
                    activeSuperscriptId = null;
                    cursorPosition = container.index + 1;
                }
            }
        }
    } else if (cursorContext === 'subscript') {
        const sub = findSubscriptAtCursor();
        if (sub) {
            if (cursorPosition < sub.subscript.length) {
                const nextNode = sub.subscript[cursorPosition];
                if (nextNode && nextNode.type === 'fraction') {
                    activeFractionId = nextNode.id;
                    cursorContext = 'fraction-numerator';
                    cursorPosition = 0;
                    render();
                    return;
                }
                cursorPosition++;
            } else {
                const container = findNodeContainer(sub);
                if (container) {
                    cursorContext = container.context;
                    activeSubscriptId = null;
                    cursorPosition = container.index + 1;
                }
            }
        }
    } else {
        // main 上下文
        if (cursorPosition < expression.length) {
            const nodeAtPos = expression[cursorPosition];
            if (nodeAtPos && nodeAtPos.type === 'fraction') {
                activeFractionId = nodeAtPos.id;
                cursorContext = 'fraction-numerator';
                cursorPosition = 0;
                render();
                return;
            }
            cursorPosition++;
            updateContextForPosition();
        }
    }
    render();
}

function updateContextForPosition() {
    if (cursorPosition === 0) {
        cursorContext = 'main';
        activeFractionId = null;
        return;
    }
    
    if (cursorContext === 'fraction-numerator' || cursorContext === 'fraction-denominator') {
        const fraction = findFractionAtCursor();
        if (fraction) {
            const arr = cursorContext === 'fraction-numerator' ? fraction.numerator : fraction.denominator;
            if (cursorPosition > 0 && arr[cursorPosition - 1]) {
                const prevNode = arr[cursorPosition - 1];
                if (prevNode.type === 'fraction') {
                    activeFractionId = prevNode.id;
                    cursorPosition = 0;
                    return;
                }
            }
        }
        if (cursorPosition === 0) {
            cursorContext = 'main';
            activeFractionId = null;
        }
        return;
    }
    
    const prevNode = expression[cursorPosition - 1];
    if (!prevNode) { cursorContext = 'main'; return; }
    
    if (prevNode.type === 'fraction') {
        cursorContext = 'fraction-numerator';
        activeFractionId = prevNode.id;
        cursorPosition = 0;
    } else if (prevNode.type === 'sqrt' || prevNode.type === 'cuberoot' || prevNode.type === 'nthroot') {
        cursorContext = prevNode.type === 'sqrt' ? 'sqrt-content' : (prevNode.type === 'cuberoot' ? 'cuberoot-content' : 'nthroot-content');
        activeRootId = prevNode.id;
        cursorPosition = 0;
    } else if (prevNode.type === 'superscript') {
        cursorContext = 'superscript';
        activeSuperscriptId = prevNode.id;
        cursorPosition = 0;
    } else if (prevNode.type === 'subscript') {
        cursorContext = 'subscript';
        activeSubscriptId = prevNode.id;
        cursorPosition = 0;
    } else {
        cursorContext = 'main';
    }
}

function getCurrentArray() {
    if (cursorContext === 'main') return expression;
    if (cursorContext === 'sqrt-content' || cursorContext === 'cuberoot-content' || cursorContext === 'nthroot-content') {
        const root = findRootAtCursor();
        return root ? root.content : null;
    }
    if (cursorContext === 'superscript') { const sup = findSuperscriptAtCursor(); return sup ? sup.exponent : null; }
    if (cursorContext === 'subscript') { const sub = findSubscriptAtCursor(); return sub ? sub.subscript : null; }
    return null;
}

function replaceFractionWithNumerator(fraction) {
    const container = findNodeContainer(fraction);
    if (container) {
        const { arr, index } = container;
        arr.splice(index, 1, ...fraction.numerator);
        cursorContext = container.context;
        activeFractionId = container.parentFractionId;
        cursorPosition = index + fraction.numerator.length;
    }
}

function deleteAtCursor() {
    // 智能删除：如果不在分数内部，且光标左侧是分数，则自动进入分母末尾再删
    if (cursorContext !== 'fraction-numerator' && cursorContext !== 'fraction-denominator') {
        const arr = getCurrentArray();
        if (arr && cursorPosition > 0) {
            const prevNode = arr[cursorPosition - 1];
            if (prevNode && prevNode.type === 'fraction') {
                activeFractionId = prevNode.id;
                cursorContext = 'fraction-denominator';
                cursorPosition = prevNode.denominator.length;
                deleteAtCursor();
                return;
            }
        }
    }

    if (cursorContext === 'fraction-numerator') {
        const fraction = findFractionAtCursor();
        if (fraction && cursorPosition > 0) {
            fraction.numerator.splice(cursorPosition - 1, 1);
            cursorPosition--;
        }
    } else if (cursorContext === 'fraction-denominator') {
        const fraction = findFractionAtCursor();
        if (fraction) {
            if (cursorPosition > 0) {
                fraction.denominator.splice(cursorPosition - 1, 1);
                cursorPosition--;
            } else {
                if (fraction.denominator.length === 0) replaceFractionWithNumerator(fraction);
            }
        }
    } else if (cursorContext === 'sqrt-content' || cursorContext === 'cuberoot-content' || cursorContext === 'nthroot-content') {
        const root = findRootAtCursor();
        if (root) {
            if (cursorPosition > 0) {
                root.content.splice(cursorPosition - 1, 1);
                cursorPosition--;
            } else if (root.content.length === 0) {
                // 删除空根号，保留删除前在父数组中的位置
                const container = findNodeContainer(root);
                deleteNode(root);
                if (container) {
                    cursorContext = container.context;
                    cursorPosition = container.index; // 留在原根号的位置
                }
            }
        }
    } else if (cursorContext === 'superscript') {
        const sup = findSuperscriptAtCursor();
        if (sup) {
            if (cursorPosition > 0) {
                sup.exponent.splice(cursorPosition - 1, 1);
                cursorPosition--;
            } else if (sup.exponent.length === 0) {
                const container = findNodeContainer(sup);
                deleteNode(sup);
                if (container) {
                    cursorContext = container.context;
                    cursorPosition = container.index;
                }
            }
        }
    } else if (cursorContext === 'subscript') {
        const sub = findSubscriptAtCursor();
        if (sub) {
            if (cursorPosition > 0) {
                sub.subscript.splice(cursorPosition - 1, 1);
                cursorPosition--;
            } else if (sub.subscript.length === 0) {
                const container = findNodeContainer(sub);
                deleteNode(sub);
                if (container) {
                    cursorContext = container.context;
                    cursorPosition = container.index;
                }
            }
        }
    } else {
        // main 上下文
        if (cursorPosition > 0) {
            expression.splice(cursorPosition - 1, 1);
            cursorPosition--;
        }
    }
    if (currentMode === 'equation') {
        if (usedLetter && !findValueInExpression(usedLetter)) {
            usedLetter = null;
        }
        if (usedEqualitySign && !findEqualitySignInExpression()) {
            usedEqualitySign = false;
        }
        updateKeyboardDisplay();
    }
    render();
    autoSave();
}

function deleteNode(node) {
    if (deleteNodeRecursive(expression, node)) {
        // 仅清除与删除节点相关的活跃 ID，避免悬挂引用
        if (node.id === activeFractionId) activeFractionId = null;
        if (node.id === activeRootId) activeRootId = null;
        if (node.id === activeSuperscriptId) activeSuperscriptId = null;
        if (node.id === activeSubscriptId) activeSubscriptId = null;
        // 不更改 cursorContext 和 cursorPosition，由调用者处理
        return true;
    }
    return false;
}

function deleteNodeRecursive(arr, node) {
    const idx = arr.indexOf(node);
    if (idx !== -1) { arr.splice(idx, 1); return true; }
    for (const item of arr) {
        if (item.type === 'fraction') {
            if (item.numerator && deleteNodeRecursive(item.numerator, node)) return true;
            if (item.denominator && deleteNodeRecursive(item.denominator, node)) return true;
        } else if (item.type === 'sqrt' || item.type === 'cuberoot' || item.type === 'nthroot') {
            if (item.content && deleteNodeRecursive(item.content, node)) return true;
        } else if (item.type === 'superscript') {
            if (item.exponent && deleteNodeRecursive(item.exponent, node)) return true;
        } else if (item.type === 'subscript') {
            if (item.subscript && deleteNodeRecursive(item.subscript, node)) return true;
        }
    }
    return false;
}

function clearExpression() {
    clearExpressionInternal();
    localStorage.removeItem(getStorageKey('expression', currentMode));
}

function clearExpressionInternal() {
    expression = [];
    cursorPosition = 0;
    cursorContext = 'main';
    activeFractionId = null;
    activeRootId = null;
    activeSuperscriptId = null;
    activeSubscriptId = null;
    usedLetter = null;
    usedEqualitySign = false;
    updateKeyboardDisplay();
    document.getElementById('resultContent').textContent = '';
    document.getElementById('resultContent').classList.remove('error');
    const resultToolbar = document.getElementById('resultToolbar');
    if (resultToolbar) resultToolbar.style.display = 'none';
    lastResultLatex = '';
    lastResultText = '';
    lastProcessLatex = [];
    lastProcessText = [];
    render();
}

function findValueInExpression(value) {
    return findValueRecursive(expression, value);
}

function findValueRecursive(arr, value) {
    for (const node of arr) {
        if (node.type === 'text' && node.value === value) {
            return true;
        } else if (node.type === 'fraction') {
            if (findValueRecursive(node.numerator, value)) return true;
            if (findValueRecursive(node.denominator, value)) return true;
        } else if (node.type === 'sqrt' || node.type === 'cuberoot' || node.type === 'nthroot') {
            if (node.content && findValueRecursive(node.content, value)) return true;
        } else if (node.type === 'superscript') {
            if (node.exponent && findValueRecursive(node.exponent, value)) return true;
        } else if (node.type === 'subscript') {
            if (node.subscript && findValueRecursive(node.subscript, value)) return true;
        }
    }
    return false;
}

function findEqualitySignInExpression() {
    return findEqualitySignRecursive(expression);
}

function findEqualitySignRecursive(arr) {
    for (const node of arr) {
        if (node.type === 'text' && EQUALITY_SIGNS.includes(node.value)) {
            return true;
        } else if (node.type === 'fraction') {
            if (findEqualitySignRecursive(node.numerator)) return true;
            if (findEqualitySignRecursive(node.denominator)) return true;
        } else if (node.type === 'sqrt' || node.type === 'cuberoot' || node.type === 'nthroot') {
            if (node.content && findEqualitySignRecursive(node.content)) return true;
        } else if (node.type === 'superscript') {
            if (node.exponent && findEqualitySignRecursive(node.exponent)) return true;
        } else if (node.type === 'subscript') {
            if (node.subscript && findEqualitySignRecursive(node.subscript)) return true;
        }
    }
    return false;
}

async function simplifyExpression() {
    const resultElement = document.getElementById('resultContent');
    if (simplifyExpression._running) return;
    simplifyExpression._running = true;

    resultElement.innerHTML = '<span class="loading-text">正在计算...</span>';
    resultElement.classList.remove('error');

    try {
        const latex = expressionToLatexForAI();
        const cleanLatex = latex.replace(/\\underline\{\\phantom\{a\}\}/g, '')
                               .replace(/\\phantom\{\\underline\{a\}\}/g, '')
                               .trim();

        if (!cleanLatex) {
            resultElement.innerHTML = '<span class="error-text">请输入表达式</span>';
            return;
        }

        // 统一的输出格式要求
        const formatInstruction = [
            "输出格式必须严格如下：",
            "---",
            "（这里放置过程，每一步一行，使用LaTeX格式）",
            "---",
            "===",
            "（这里放置最终结果，使用LaTeX格式）",
            "===",
            "不要添加任何其他内容，包括解释、评论或广告。"
        ].join('\n');

        let taskDescription;
        if (currentMode === 'calculator') {
            taskDescription = [
                "你的任务：接收一个 LaTeX 数学表达式（仅含数字和运算符），计算其数值结果。",
                "计算过程只需展示逐步计算，无需文字说明。",
                "计算过程示例：{原式}{换行}={第一步}{换行}=...，以此类推，每步单独一行（过程的第一行单独显示原式，过程的第二行显示第一步，等号不要单独占一行！）。",
                "如果表达式包含语法错误或无意义内容，在===结果===之间输出\"无法计算\"，不要输出其他内容。",
                "所有表达式必须使用 LaTeX 格式。"
            ].join('\n');
        } else if (currentMode === 'equation') {
            if (allowImaginary) {
                taskDescription = [
                    "你的任务：接收一个 LaTeX 方程或不等式，求解未知数。",
                    "求解过程只需展示逐步变形，无需文字说明。",
                    "计算过程示例：3x+5=11{换行}3x=6{换行}...=...，以此类推，每步单独一行。",
                    "如果是多个根，用 x_1=..., x_2=... 的形式。",
                    "允许存在虚数解。",
                    "如果方程无解或无法求解，在===结果===之间输出\"无解\"，不要输出其他内容。",
                    "所有表达式必须使用 LaTeX 格式。"
                ].join('\n');
            } else {
                taskDescription = [
                    "你的任务：接收一个 LaTeX 方程或不等式，求解未知数。",
                    "求解过程只需展示逐步变形，无需文字说明。",
                    "计算过程示例：3x+5=11{换行}3x=6{换行}...=...[部分多次方程要用到判别式：“Δ=...”]，以此类推，每步单独一行。",
                    "如果是多个根，用 x_1=..., x_2=... 的形式。",
                    "忽略虚数解，只输出实数解。若表达式有根号-1等虚数项，直接在结果中输出\"无实数解\"。",
                    "如果方程无实数解或无法求解，在===结果===之间输出\"无实数解\"，不要输出其他内容。",
                    "所有表达式必须使用 LaTeX 格式。"
                ].join('\n');
            }
        } else if (currentMode === 'factor') {
            taskDescription = [
                "你的任务：接收一个 LaTeX 代数表达式，将其因式分解。",
                "因式分解过程只需展示逐步变形，无需文字说明。",
                "计算过程示例：{原式}{换行}={第一步}{换行}=...，以此类推，每步单独一行（过程的第一行单独显示原式，过程的第二行显示第一步，等号不要单独占一行！）。",
                "如果表达式包含语法错误或无法因式分解，在===结果===之间输出\"无法因式分解\"，不要输出其他内容。",
                "所有表达式必须使用 LaTeX 格式。"
            ].join('\n');
        } else {
            taskDescription = [
                "你的任务：接收一个 LaTeX 代数表达式，输出其化简后的 LaTeX 结果。",
                "化简过程只需展示逐步变形，无需文字说明。",
                "计算过程示例：{原式}{换行}={第一步}{换行}=...，以此类推，每步单独一行（过程的第一行单独显示原式，过程的第二行显示第一步，等号不要单独占一行！）。",
                "如果表达式包含语法错误或无法化简，在===结果===之间输出\"无法化简\"，不要输出其他内容。",
                "所有表达式必须使用 LaTeX 格式。"
            ].join('\n');
        }

        const prompt = [
            taskDescription,
            formatInstruction,
            "",
            "输入的表达式：",
            cleanLatex
        ].join('\n');

        const url = `https://text.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        // 特殊处理 429 错误
        if (response.status === 429) {
            resultElement.innerHTML = '<span class="error-text">请求过于频繁(429)，请稍后再试</span>';
            return;
        }

        if (!response.ok) throw new Error(`服务器错误 (${response.status})`);

        const text = await response.text();

        // 解析返回格式：--- ... --- === 结果 ===
        const parts = text.split('===');
        if (parts.length < 2) {
            resultElement.innerHTML = '<span class="error-text">计算失败，响应格式异常，请稍后重试</span>';
            return;
        }

        // 过程部分：第一个 === 之前的内容，去掉首尾的 --- 标记
        let processPart = parts[0].replace(/^---\s*|\s*---$/g, '').trim();
        // 结果部分：第一个 === 和第二个 === 之间
        let resultPart = parts[1].trim();
        // 如果结果为空，但过程后面可能有有效结果（例如没有第二个 ===），尝试用最后一段非空
        if (!resultPart && parts.length > 2) {
            resultPart = parts[2].trim();
        }

        // 清理数学模式标记的通用函数
        function cleanMathTags(str) {
            if (!str) return '';
            let s = str.trim();
            // 去除行内 \(...\) 包裹
            if (s.startsWith('\\(') && s.endsWith('\\)')) s = s.slice(2, -2).trim();
            // 去除单行显示 \[...\] 包裹
            else if (s.startsWith('\\[') && s.endsWith('\\]')) s = s.slice(2, -2).trim();
            // 去除 $...$ 或 $$...$$ 包裹（可能混合）
            else if (s.startsWith('$$') && s.endsWith('$$')) s = s.slice(2, -2).trim();
            else if (s.startsWith('$') && s.endsWith('$')) s = s.slice(1, -1).trim();
            return s;
        }

        // 清理过程行
        const processLines = processPart.split('\n')
            .map(line => cleanMathTags(line))
            .filter(line => line && line !== '---');

        // 清理最终结果
        let cleanResult = cleanMathTags(resultPart);

        // 保存结果
        lastResultLatex = cleanResult;
        lastResultText = latexToReadableText(cleanResult);
        lastProcessLatex = processLines;
        lastProcessText = processLines.map(line => latexToReadableText(line));

        // 添加到历史记录
        const expressionText = expressionToReadableText();
        if (expressionText && lastResultText && lastResultText !== '无法计算' && lastResultText !== '无法化简' && lastResultText !== '无解') {
            addToHistory(expressionText, lastResultText);
        }

        // 显示结果工具栏
        const resultToolbar = document.getElementById('resultToolbar');
        if (resultToolbar) {
            resultToolbar.style.display = 'flex';
            resultToolbar.style.gap = '10px';
            resultToolbar.style.justifyContent = 'center';
        }

        // 渲染结果（前置显示）
        let resultHtml = '<div class="result-final" style="margin-bottom: 8px;">';
        if (cleanResult && cleanResult !== '无法计算' && cleanResult !== '无法化简' && cleanResult !== '无解') {
            try {
                const tempDiv = document.createElement('div');
                katex.render(cleanResult, tempDiv, {
                    throwOnError: false,
                    displayMode: true
                });
                resultHtml += tempDiv.innerHTML;
            } catch (e) {
                resultHtml += cleanResult;
            }
        } else {
            resultHtml += `<span class="error-text">${cleanResult || '计算失败'}</span>`;
        }
        resultHtml += '</div>';

        // 修改：蓝色可点击文本替代按钮
        const toggleBtnId = 'toggleProcessBtn_' + Date.now();
        resultHtml += `<span id="${toggleBtnId}" style="color: #007bff; cursor: pointer; text-decoration: underline; font-size: 0.95rem;">展开过程</span>`;
        resultHtml += '<div class="process-detail" style="display:none; margin-top:10px; text-align:left;">';
        if (processLines.length > 0) {
            processLines.forEach(line => {
                resultHtml += '<div class="process-step" style="margin:4px 0;">';
                try {
                    const tempDiv = document.createElement('div');
                    katex.render(line, tempDiv, {
                        throwOnError: false,
                        displayMode: false
                    });
                    resultHtml += tempDiv.innerHTML;
                } catch (e) {
                    resultHtml += line;
                }
                resultHtml += '</div>';
            });
        } else {
            resultHtml += '<span class="no-process">无详细过程</span>';
        }
        resultHtml += '</div>';

        resultElement.innerHTML = resultHtml;

        // 绑定展开/收起事件
        const toggleBtn = document.getElementById(toggleBtnId);
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function () {
                const detail = resultElement.querySelector('.process-detail');
                if (detail.style.display === 'none') {
                    detail.style.display = 'block';
                    this.textContent = '收起过程';
                } else {
                    detail.style.display = 'none';
                    this.textContent = '展开过程';
                }
            });
        }

    } catch (err) {
        if (err.name === 'AbortError') {
            resultElement.innerHTML = '<span class="error-text">计算超时，请检查网络或稍后重试</span>';
        } else {
            resultElement.innerHTML = `<span class="error-text">计算失败：${err.message}</span>`;
        }
    } finally {
        simplifyExpression._running = false;
    }
}

async function copyAsText() {
    const text = expressionToReadableText();
    if (!text) {
        showToast('请先输入表达式');
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        showToast('已复制为数学表达式');
    } catch (err) {
        showToast('复制失败');
    }
}

async function copyAsLatex() {
    const latex = expressionToLatex().replace(/\\underline\{\\phantom\{a\}\}/g, '')
                                      .replace(/\\phantom\{\\underline\{a\}\}/g, '')
                                      .trim();
    if (!latex) {
        showToast('请先输入表达式');
        return;
    }
    try {
        await navigator.clipboard.writeText(latex);
        showToast('已复制为LaTeX代码');
    } catch (err) {
        showToast('复制失败');
    }
}



function showToast(message) {
    const existing = document.querySelector('.toast-message');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:5px;z-index:1000;font-size:14px;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function expressionToReadableText() {
    if (expression.length === 0) return '';
    return expression.map(node => nodeToReadableText(node)).join('');
}

function nodeToReadableText(node) {
    if (node.type === 'text') {
        if (node.value === '*') return '·';
        if (node.value === '/') return '÷';
        if (node.value === '\\times ') return '·';
        if (node.value === '\\div ') return '÷';
        return node.value;
    }
    if (node.type === 'fraction') {
        const num = fractionNodesToText(node.numerator);
        const den = fractionNodesToText(node.denominator);
        return `(${num})÷(${den})`;
    }
    if (node.type === 'sqrt') {
        const content = contentNodesToText(node.content);
        return `√(${content})`;
    }
    if (node.type === 'cuberoot') {
        const content = contentNodesToText(node.content);
        return `∛(${content})`;
    }
    if (node.type === 'nthroot') {
        const content = contentNodesToText(node.content);
        return `${node.index}√(${content})`;
    }
    if (node.type === 'superscript') {
        const base = contentNodesToText(node.exponent.length > 0 ? [{type:'text',value:'^'}] : []);
        const exp = contentNodesToText(node.exponent);
        return `(${exp})`;
    }
    if (node.type === 'subscript') {
        const content = contentNodesToText(node.subscript);
        return `_${content}`;
    }
    return '';
}

function fractionNodesToText(nodes) {
    if (!nodes || nodes.length === 0) return '';
    return nodes.map(n => nodeToReadableText(n)).join('');
}

function contentNodesToText(nodes) {
    if (!nodes || nodes.length === 0) return '';
    return nodes.map(n => nodeToReadableText(n)).join('');
}



function latexToReadableText(latex) {
    if (!latex) return '';
    let text = latex;
    
    const greekMap = {
        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\epsilon': 'ε',
        '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ', '\\lambda': 'λ', '\\mu': 'μ',
        '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ', '\\sigma': 'σ',
        '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ', '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
        '\\Alpha': 'Α', '\\Beta': 'Β', '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ',
        '\\Lambda': 'Λ', '\\Mu': 'Μ', '\\Nu': 'Ν', '\\Xi': 'Ξ', '\\Pi': 'Π',
        '\\Rho': 'Ρ', '\\Sigma': 'Σ', '\\Tau': 'Τ', '\\Upsilon': 'Υ', '\\Phi': 'Φ',
        '\\Chi': 'Χ', '\\Psi': 'Ψ', '\\Omega': 'Ω', '\\infty': '∞', '\\pi': 'π'
    };
    
    for (const [latexCmd, char] of Object.entries(greekMap)) {
        text = text.replace(new RegExp(latexCmd, 'g'), char);
    }
    
    text = text.replace(/\\times\s*/g, '·');
    text = text.replace(/\\div\s*/g, '÷');
    text = text.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)÷($2)');
    text = text.replace(/\\sqrt\{([^}]*)\}/g, '√($1)');
    text = text.replace(/\^2/g, '²');
    text = text.replace(/\^3/g, '³');
    text = text.replace(/\^(\d+)/g, '^($1)');
    text = text.replace(/\\left/g, '');
    text = text.replace(/\\right/g, '');
    text = text.replace(/[{}]/g, '');
    text = text.replace(/\\\w+\s*/g, '');
    
    return text.trim();
}

async function copyResultAsText() {
    if (!lastResultText) {
        showToast('无结果可复制');
        return;
    }
    try {
        await navigator.clipboard.writeText(lastResultText);
        showToast('已复制结果表达式');
    } catch (err) {
        showToast('复制失败');
    }
}

async function copyResultAsLatex() {
    if (!lastResultLatex) {
        showToast('无结果可复制');
        return;
    }
    try {
        await navigator.clipboard.writeText(lastResultLatex);
        showToast('已复制结果LaTeX');
    } catch (err) {
        showToast('复制失败');
    }
}

async function exportProcess() {
    if (lastProcessText.length === 0) {
        showToast('无过程可导出');
        return;
    }
    const processText = lastProcessText.join('\n');
    const originalExpression = expressionToReadableText();
    const modeNames = { normal: '化简', factor: '因式分解', calculator: '计算', equation: '方程求解' };
    const modeName = modeNames[currentMode] || '计算';
    let content = `数学${modeName}过程\n`;
    content += `原表达式：${originalExpression}\n`;
    content += `---\n`;
    content += processText;
    content += `\n---\n`;
    content += `结果：${lastResultText}`;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `数学${modeName}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('已下载计算过程');
}

function formatDateTimeForFile() {
    const dt = new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    const h = String(dt.getHours()).padStart(2, '0');
    const mi = String(dt.getMinutes()).padStart(2, '0');
    const s = String(dt.getSeconds()).padStart(2, '0');
    return y + '-' + m + '-' + d + '_' + h + '-' + mi + '-' + s;
}

async function exportResultImage() {
    const isDark = document.body.classList.contains('dark-mode');
    const bgColor = isDark ? '#1a1a2e' : 'linear-gradient(135deg,#667eea,#764ba2)';
    const cardBg = isDark ? '#2d2d3a' : '#ffffff';
    const textColor = isDark ? '#e0e0e0' : '#333';
    const subTextColor = isDark ? '#aaa' : '#666';

    const exportCard = document.createElement('div');
    exportCard.style.cssText = 'position:fixed;left:-9999px;top:0;width:600px;padding:40px;background:' + bgColor + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

    const modeNames = { normal: '化简', factor: '因式分解', calculator: '计算', equation: '方程求解' };
    const modeName = modeNames[currentMode] || '计算';

    const innerCard = document.createElement('div');
    innerCard.style.cssText = 'background:' + cardBg + ';border-radius:16px;padding:30px;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

    const header = document.createElement('div');
    header.style.cssText = 'text-align:center;margin-bottom:25px;';
    header.innerHTML = '<h1 style="color:' + textColor + ';font-size:1.5rem;margin:0 0 5px;">📐 数学' + modeName + '</h1><span style="display:inline-block;background:#667eea;color:white;padding:4px 12px;border-radius:20px;font-size:0.85rem;">' + modeName + '</span>';

    const expressionSection = document.createElement('div');
    expressionSection.style.cssText = 'margin-bottom:20px;';
    expressionSection.innerHTML = '<div style="color:' + subTextColor + ';font-size:0.85rem;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">原表达式</div><div style="background:' + (isDark ? '#383850' : '#f8f9fa') + ';border-radius:10px;padding:20px;text-align:center;font-size:1.3rem;color:' + textColor + ';" id="exportExpr"></div>';

    innerCard.appendChild(header);
    innerCard.appendChild(expressionSection);

    if (lastProcessLatex && lastProcessLatex.length > 0) {
        const processSection = document.createElement('div');
        processSection.style.cssText = 'margin-bottom:20px;';
        processSection.innerHTML = '<div style="color:' + subTextColor + ';font-size:0.85rem;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">推导过程</div><div style="background:' + (isDark ? '#383850' : '#f8f9fa') + ';border-radius:10px;padding:15px 20px;" id="exportProcess"></div>';
        innerCard.appendChild(processSection);
    }

    const resultSection = document.createElement('div');
    resultSection.style.cssText = 'margin-bottom:20px;';
    resultSection.innerHTML = '<div style="color:' + subTextColor + ';font-size:0.85rem;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">结果</div><div style="background:linear-gradient(135deg,#4CAF50,#2e7d32);border-radius:10px;padding:20px;text-align:center;color:white;font-size:1.4rem;font-weight:bold;" id="exportRes"></div>';

    const footer = document.createElement('div');
    footer.style.cssText = 'text-align:center;margin-top:20px;padding-top:15px;border-top:1px solid ' + (isDark ? '#555' : '#eee') + ';color:' + subTextColor + ';font-size:0.85rem;';
    footer.innerHTML = '牛逼的代数计算器 · www.yyxc.fun/maths.html';

    innerCard.appendChild(resultSection);
    innerCard.appendChild(footer);
    exportCard.appendChild(innerCard);
    document.body.appendChild(exportCard);

    const exprEl = document.getElementById('exportExpr');
    const resEl = document.getElementById('exportRes');

    const originalLatex = expressionToLatexForAI().replace(/\\underline\{\\phantom\{a\}\}/g, '').replace(/\\phantom\{\\underline\{a\}\}/g, '').trim();
    renderMath(exprEl, originalLatex);
    renderMath(resEl, lastResultLatex || '');

    if (lastProcessLatex && lastProcessLatex.length > 0) {
        const processEl = document.getElementById('exportProcess');
        lastProcessLatex.forEach(function(step) {
            const div = document.createElement('div');
            div.style.cssText = 'padding:6px 0;border-bottom:1px solid ' + (isDark ? '#555' : '#eee') + ';font-size:1.1rem;text-align:left;color:' + textColor + ';';
            renderMath(div, step);
            processEl.appendChild(div);
        });
    }

    try {
        const canvas = await html2canvas(exportCard, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            logging: false
        });
        document.body.removeChild(exportCard);
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = canvas.width;
        croppedCanvas.height = Math.max(canvas.height - 10, 1);
        const ctx = croppedCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height - 10, 0, 0, canvas.width, canvas.height - 10);
        const link = document.createElement('a');
        link.download = '数学结果_' + formatDateTimeForFile() + '.png';
        link.href = croppedCanvas.toDataURL('image/png');
        link.click();
        showToast('已导出图片');
    } catch (err) {
        document.body.removeChild(exportCard);
        showToast('导出图片失败');
        console.error(err);
    }
}

function expressionToLatex() {
    let result = '';
    for (let i = 0; i < expression.length; i++) {
        if (cursorContext === 'main' && cursorPosition === i) {
            result += cursorLatex();
        }
        result += nodeToLatex(expression[i]);
    }
    if (cursorContext === 'main' && cursorPosition === expression.length) {
        result += cursorLatex();
    }
    return result;
}

function nodeToLatex(node) {
    if (node.type === 'text') return textToLatex(node.value);
    if (node.type === 'fraction') return fractionToLatex(node);
    if (node.type === 'sqrt') return sqrtToLatex(node);
    if (node.type === 'cuberoot') return cuberootToLatex(node);
    if (node.type === 'nthroot') return nthrootToLatex(node);
    if (node.type === 'superscript') return superscriptToLatex(node);
    if (node.type === 'subscript') return subscriptToLatex(node);
    return '';
}

function textToLatex(text) {
    const specialChars = {
        'π': '\\pi', '∞': '\\infty', 'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
        'ε': '\\epsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta', 'λ': '\\lambda', 'μ': '\\mu',
        'ν': '\\nu', 'ξ': '\\xi', 'ο': '\\omicron', 'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau',
        'υ': '\\upsilon', 'φ': '\\phi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
        'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda', 'Μ': '\\Mu', 'Ν': '\\Nu',
        'Ξ': '\\Xi', 'Ο': '\\Omicron', 'Π': '\\Pi', 'Ρ': '\\Rho', 'Σ': '\\Sigma', 'Τ': '\\Tau',
        'Υ': '\\Upsilon', 'Φ': '\\Phi', 'Χ': '\\Chi', 'Ψ': '\\Psi', 'Ω': '\\Omega'
    };
    if (specialChars[text]) return specialChars[text];
    if (text === '*') return '\\cdot ';
    if (text === '/') return '\\div ';
    return text;
}

function textToLatexForAI(text) {
    const specialChars = {
        'π': '\\pi', '∞': '\\infty', 'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
        'ε': '\\epsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta', 'λ': '\\lambda', 'μ': '\\mu',
        'ν': '\\nu', 'ξ': '\\xi', 'ο': '\\omicron', 'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau',
        'υ': '\\upsilon', 'φ': '\\phi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
        'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda', 'Μ': '\\Mu', 'Ν': '\\Nu',
        'Ξ': '\\Xi', 'Ο': '\\Omicron', 'Π': '\\Pi', 'Ρ': '\\Rho', 'Σ': '\\Sigma', 'Τ': '\\Tau',
        'Υ': '\\Upsilon', 'Φ': '\\Phi', 'Χ': '\\Chi', 'Ψ': '\\Psi', 'Ω': '\\Omega'
    };
    if (specialChars[text]) return specialChars[text];
    if (text === '*') return '\\times ';
    if (text === '/') return '\\div ';
    return text;
}

function nodeToLatexForAI(node) {
    if (node.type === 'text') return textToLatexForAI(node.value);
    if (node.type === 'fraction') return fractionToLatex(node);
    if (node.type === 'sqrt') return sqrtToLatex(node);
    if (node.type === 'cuberoot') return cuberootToLatex(node);
    if (node.type === 'nthroot') return nthrootToLatex(node);
    if (node.type === 'superscript') return superscriptToLatex(node);
    if (node.type === 'subscript') return subscriptToLatex(node);
    return '';
}

function expressionToLatexForAI() {
    let result = '';
    for (let i = 0; i < expression.length; i++) {
        result += nodeToLatexForAI(expression[i]);
    }
    return result;
}

function fractionToLatex(fraction) {
    const isActiveFraction = fraction.id === activeFractionId;
    let numLatex = '', denLatex = '';

    if (cursorContext === 'fraction-numerator' && isActiveFraction) {
        for (let i = 0; i < fraction.numerator.length; i++) {
            if (cursorPosition === i) numLatex += cursorLatex();
            numLatex += nodeToLatex(fraction.numerator[i]);
        }
        if (cursorPosition === fraction.numerator.length) numLatex += cursorLatex();
    } else {
        numLatex = fraction.numerator.map(n => nodeToLatex(n)).join('');
    }

    if (cursorContext === 'fraction-denominator' && isActiveFraction) {
        for (let i = 0; i < fraction.denominator.length; i++) {
            if (cursorPosition === i) denLatex += cursorLatex();
            denLatex += nodeToLatex(fraction.denominator[i]);
        }
        if (cursorPosition === fraction.denominator.length) denLatex += cursorLatex();
    } else {
        denLatex = fraction.denominator.map(n => nodeToLatex(n)).join('');
    }

    const num = numLatex || (isActiveFraction && cursorContext === 'fraction-numerator' ? cursorLatex() : '');
    const den = denLatex || (isActiveFraction && cursorContext === 'fraction-denominator' ? cursorLatex() : '');

    return `\\frac{${num}}{${den}}`;
}

function sqrtToLatex(sqrt) {
    let contentLatex = '';
    const isActiveRoot = sqrt.id === activeRootId && cursorContext === 'sqrt-content';
    if (isActiveRoot) {
        for (let i = 0; i < sqrt.content.length; i++) {
            if (cursorPosition === i) contentLatex += cursorLatex();
            contentLatex += nodeToLatex(sqrt.content[i]);
        }
        if (cursorPosition === sqrt.content.length) contentLatex += cursorLatex();
    } else {
        contentLatex = sqrt.content.map(n => nodeToLatex(n)).join('');
    }
    const content = contentLatex || (isActiveRoot ? cursorLatex() : ''); // 改为 ''
    return `\\sqrt{${content}}`;
}

function cuberootToLatex(cuberoot) {
    let contentLatex = '';
    const isActiveRoot = cuberoot.id === activeRootId && cursorContext === 'cuberoot-content';
    if (isActiveRoot) {
        for (let i = 0; i < cuberoot.content.length; i++) {
            if (cursorPosition === i) contentLatex += cursorLatex();
            contentLatex += nodeToLatex(cuberoot.content[i]);
        }
        if (cursorPosition === cuberoot.content.length) contentLatex += cursorLatex();
    } else {
        contentLatex = cuberoot.content.map(n => nodeToLatex(n)).join('');
    }
    const content = contentLatex || (isActiveRoot ? cursorLatex() : ''); // 改为 ''
    return `\\sqrt[3]{${content}}`;
}

function nthrootToLatex(nthroot) {
    let contentLatex = '';
    const isActiveRoot = nthroot.id === activeRootId && cursorContext === 'nthroot-content';
    if (isActiveRoot) {
        for (let i = 0; i < nthroot.content.length; i++) {
            if (cursorPosition === i) contentLatex += cursorLatex();
            contentLatex += nodeToLatex(nthroot.content[i]);
        }
        if (cursorPosition === nthroot.content.length) contentLatex += cursorLatex();
    } else {
        contentLatex = nthroot.content.map(n => nodeToLatex(n)).join('');
    }
    const content = contentLatex || (isActiveRoot ? cursorLatex() : ''); // 改为 ''
    return `\\sqrt[${nthroot.index}]{${content}}`;
}

function superscriptToLatex(sup) {
    let expLatex = '';
    const isActiveSup = sup.id === activeSuperscriptId && cursorContext === 'superscript';
    if (isActiveSup) {
        for (let i = 0; i < sup.exponent.length; i++) {
            if (cursorPosition === i) expLatex += cursorLatex();
            expLatex += nodeToLatex(sup.exponent[i]);
        }
        if (cursorPosition === sup.exponent.length) expLatex += cursorLatex();
    } else {
        expLatex = sup.exponent.map(n => nodeToLatex(n)).join('');
    }
    const exp = expLatex || (isActiveSup ? cursorLatex() : ''); // 改为 ''
    return `^{${exp}}`;
}

function subscriptToLatex(sub) {
    let subLatex = '';
    const isActiveSub = sub.id === activeSubscriptId && cursorContext === 'subscript';
    if (isActiveSub) {
        for (let i = 0; i < sub.subscript.length; i++) {
            if (cursorPosition === i) subLatex += cursorLatex();
            subLatex += nodeToLatex(sub.subscript[i]);
        }
        if (cursorPosition === sub.subscript.length) subLatex += cursorLatex();
    } else {
        subLatex = sub.subscript.map(n => nodeToLatex(n)).join('');
    }
    const sb = subLatex || (isActiveSub ? cursorLatex() : ''); // 改为 ''
    return `_{${sb}}`;
}

function simplifyLatex(latex) {
    latex = latex.replace(/\\underline\{\\phantom\{a\}\}/g, '');
    latex = latex.replace(/\\phantom\{\\underline\{a\}\}/g, '');
    latex = simplifyPowers(latex);
    latex = simplifyFractions(latex);
    latex = latex.replace(/\\times\s*\\times/g, '\\times').replace(/\\div\s*\\div/g, '\\div');
    latex = latex.replace(/\+\s*-/g, '-').replace(/-\s*\+/g, '-').replace(/--/g, '+').replace(/\+\+/g, '+');
    return latex;
}

function simplifyPowers(latex) {
    const baseWithPower = /([a-zA-Z0-9])\^{([^}]+)}/g;
    let matches = [], match;
    while ((match = baseWithPower.exec(latex)) !== null) {
        matches.push({ base: match[1], power: match[2], fullMatch: match[0], index: match.index });
    }
    let result = '', lastIndex = 0;
    for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        result += latex.substring(lastIndex, m.index);
        const nextMatch = matches[i + 1];
        const lookAhead = nextMatch ? latex.substring(m.index + m.fullMatch.length, nextMatch.index) : latex.substring(m.index + m.fullMatch.length);
        if (lookAhead.startsWith('\\times ') || lookAhead.startsWith('\\times')) {
            if (nextMatch && m.base === nextMatch.base) {
                try {
                    const p1 = parseInt(m.power), p2 = parseInt(nextMatch.power);
                    if (!isNaN(p1) && !isNaN(p2)) {
                        const combined = p1 + p2;
                        if (combined === 1) result += m.base;
                        else if (combined === 0) result += '1';
                        else result += `${m.base}^{${combined}}`;
                        lastIndex = nextMatch.index + nextMatch.fullMatch.length;
                        i++;
                        continue;
                    }
                } catch (e) {}
            }
        }
        result += m.fullMatch;
        lastIndex = m.index + m.fullMatch.length;
    }
    result += latex.substring(lastIndex);
    const standalonePowers = result.match(/([a-zA-Z])\^{([^}]+)}/g) || [];
    for (const p of standalonePowers) {
        const base = p.charAt(0), pow = p.match(/\^{([^}]+)}/)[1];
        if (pow === '0') result = result.replace(p, '1');
        else if (pow === '1') result = result.replace(p, base);
    }
    return result;
}

function simplifyFractions(latex) {
    const fractionPattern = /\\frac\{([^}]+)\}\{([^}]+)\}/g;
    let result = latex, match;
    while ((match = fractionPattern.exec(latex)) !== null) {
        const num = match[1].trim(), den = match[2].trim();
        if (num === den) result = result.replace(match[0], '1');
        else if (num === '0') result = result.replace(match[0], '0');
        else if (den === '1') result = result.replace(match[0], num);
        else {
            const numVal = tryParseFraction(num), denVal = tryParseFraction(den);
            if (numVal !== null && denVal !== null && denVal !== 0) {
                const gcdVal = calculateGCD(Math.abs(numVal), Math.abs(denVal));
                const newNum = numVal / gcdVal, newDen = denVal / gcdVal;
                if (newDen < 0) result = result.replace(match[0], `-\\frac{${Math.abs(newNum)}}{${Math.abs(newDen)}}`);
                else if (newDen === 1) result = result.replace(match[0], String(newNum));
                else result = result.replace(match[0], `\\frac{${newNum}}{${newDen}}`);
            }
        }
        fractionPattern.lastIndex = 0;
    }
    return result;
}

function tryParseFraction(str) {
    if (/^-?\d+$/.test(str)) return parseInt(str);
    return null;
}

function calculateGCD(a, b) {
    a = Math.abs(Math.floor(a)); b = Math.abs(Math.floor(b));
    if (a === 0) return b; if (b === 0) return a;
    while (b) { const t = b; b = a % b; a = t; }
    return a;
}

function findNodeContainer(node) {
    function search(arr, parentFractionId, context) {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i] === node) return { arr, index: i, context, parentFractionId };
            const item = arr[i];
            if (item.type === 'fraction') {
                let found = search(item.numerator, item.id, 'fraction-numerator');
                if (found) return found;
                found = search(item.denominator, item.id, 'fraction-denominator');
                if (found) return found;
            } else if (item.type === 'sqrt' || item.type === 'cuberoot' || item.type === 'nthroot') {
                if (item.content) {
                    const ctx = item.type === 'sqrt' ? 'sqrt-content' : (item.type === 'cuberoot' ? 'cuberoot-content' : 'nthroot-content');
                    const found = search(item.content, null, ctx);
                    if (found) return found;
                }
            } else if (item.type === 'superscript') {
                if (item.exponent) { const found = search(item.exponent, null, 'superscript'); if (found) return found; }
            } else if (item.type === 'subscript') {
                if (item.subscript) { const found = search(item.subscript, null, 'subscript'); if (found) return found; }
            }
        }
        return null;
    }
    return search(expression, null, 'main');
}

// ------------------ 光标快速定位函数 ------------------
function getCurrentContextArray() {
    if (cursorContext === 'main') return expression;
    if (cursorContext === 'fraction-numerator' || cursorContext === 'fraction-denominator') {
        const frac = findFractionAtCursor();
        if (!frac) return null;
        return cursorContext === 'fraction-numerator' ? frac.numerator : frac.denominator;
    }
    if (cursorContext.startsWith('sqrt') || cursorContext.startsWith('cuberoot') || cursorContext.startsWith('nthroot')) {
        const root = findRootAtCursor();
        return root ? root.content : null;
    }
    if (cursorContext === 'superscript') {
        const sup = findSuperscriptAtCursor();
        return sup ? sup.exponent : null;
    }
    if (cursorContext === 'subscript') {
        const sub = findSubscriptAtCursor();
        return sub ? sub.subscript : null;
    }
    return null;
}

// 跳转到整个表达式的开头（主表达式下标 0）
function moveToStart() {
    resetCursorBlink();
    cursorContext = 'main';
    cursorPosition = 0;
    activeFractionId = null;
    activeRootId = null;
    activeSuperscriptId = null;
    activeSubscriptId = null;
    render();
}

// 跳转到整个表达式的末尾
function moveToEnd() {
    resetCursorBlink();
    cursorContext = 'main';
    cursorPosition = expression.length;
    activeFractionId = null;
    activeRootId = null;
    activeSuperscriptId = null;
    activeSubscriptId = null;
    render();
}

// 跳到当前项的开头
function moveToTermStart() {
    resetCursorBlink();
    const arr = getCurrentContextArray();
    if (!arr) return;
    if (cursorPosition === 0) { render(); return; }
    const termInfo = findCurrentTerm(arr, cursorPosition);
    if (termInfo) {
        cursorPosition = termInfo.start;
    } else {
        // 若没有项，光标最多移到 0
        cursorPosition = 0;
    }
    render();
}

// 跳到当前项的末尾（光标在项内容之后）
function moveToTermEnd() {
    resetCursorBlink();
    const arr = getCurrentContextArray();
    if (!arr) return;
    if (cursorPosition === arr.length) { render(); return; }
    const termInfo = findCurrentTerm(arr, cursorPosition);
    if (termInfo) {
        cursorPosition = termInfo.start + termInfo.length;
    } else {
        cursorPosition = arr.length;
    }
    render();
}

// 跳到上一项的末尾
function moveToPrevTermEnd() {
    resetCursorBlink();
    const arr = getCurrentContextArray();
    if (!arr || arr.length === 0) return;
    // 获取当前项
    const termInfo = findCurrentTerm(arr, cursorPosition);
    if (!termInfo) {
        // 没有当前项（如在 +、- 之后），直接移到开头
        cursorPosition = 0;
        render();
        return;
    }
    // 查找前一项
    const prevTerm = findCurrentTerm(arr, termInfo.start); // start 位置即当前项开头，向左找前一项
    if (prevTerm) {
        cursorPosition = prevTerm.start + prevTerm.length; // 前一项的末尾
    } else {
        // 前一项不存在，移到数组开头
        cursorPosition = 0;
    }
    render();
}

// 跳到下一项的开头
function moveToNextTermStart() {
    resetCursorBlink();
    const arr = getCurrentContextArray();
    if (!arr || arr.length === 0) return;
    const termInfo = findCurrentTerm(arr, cursorPosition);
    if (!termInfo) {
        // 没有当前项，则移动到数组末尾
        cursorPosition = arr.length;
        render();
        return;
    }
    const nextStart = findNextTermStart(arr, termInfo.start + termInfo.length);
    cursorPosition = nextStart;
    render();
}

// 辅助：从 pos 开始查找下一项的开头（跳过可能的 +、- 符号）
function findNextTermStart(arr, pos) {
    for (let i = pos; i < arr.length; i++) {
        const node = arr[i];
        // 遇到 + 或 - 则跳过，继续找
        if (node.type === 'text' && (node.value === '+' || node.value === '-')) {
            continue;
        }
        // 否则就是下一项的开头（包括括号、数字、变量、分数等）
        return i;
    }
    return arr.length; // 没有下一项，落在末尾
}

function render() {
    const container = document.getElementById('expressionContent');
    if (expression.length === 0 && cursorContext === 'main') {
        container.innerHTML = '<span style="color: #999; font-size: 1.2rem;">点击下方按钮输入表达式</span>';
        return;
    }
    let latex = expressionToLatex();
    try {
        katex.render(latex, container, { throwOnError: false, displayMode: false });
    } catch (e) {
        container.textContent = latex;
    }
}

const STORAGE_PREFIX = 'maths_';
const AUTO_SAVE_DELAY = 500;
let autoSaveTimeout = null;
let cursor = { index: 0, level: [] };

function getStorageKey(type, mode) {
    return STORAGE_PREFIX + type + '_' + mode;
}

function autoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        saveCurrentExpression();
    }, AUTO_SAVE_DELAY);
}

function saveCurrentExpression() {
    try {
        const data = {
            expression: expression,
            cursorPosition: cursorPosition,
            cursorContext: cursorContext,
            activeFractionId: activeFractionId,
            activeRootId: activeRootId,
            activeSuperscriptId: activeSuperscriptId,
            activeSubscriptId: activeSubscriptId,
            usedLetter: usedLetter,
            usedEqualitySign: usedEqualitySign
        };
        localStorage.setItem(getStorageKey('expression', currentMode), JSON.stringify(data));
    } catch (e) {
        console.error('保存失败:', e);
    }
}

function loadSavedExpression(mode) {
    try {
        const data = localStorage.getItem(getStorageKey('expression', mode));
        if (data) {
            const parsed = JSON.parse(data);
            expression = parsed.expression || [];
            cursorPosition = parsed.cursorPosition || 0;
            cursorContext = parsed.cursorContext || 'main';
            activeFractionId = parsed.activeFractionId || null;
            activeRootId = parsed.activeRootId || null;
            activeSuperscriptId = parsed.activeSuperscriptId || null;
            activeSubscriptId = parsed.activeSubscriptId || null;
            usedLetter = parsed.usedLetter || null;
            usedEqualitySign = parsed.usedEqualitySign || false;
            updateKeyboardDisplay();
            render();
        } else {
            clearExpressionInternal();
        }
    } catch (e) {
        console.error('加载失败:', e);
        clearExpressionInternal();
    }
}

function addToHistory(expressionText, resultText) {
    try {
        const history = getHistory(currentMode);
        const item = {
            id: Date.now(),
            mode: currentMode,
            modeName: getModeName(currentMode),
            expression: expressionText,
            result: resultText,
            time: new Date().toISOString()
        };
        history.unshift(item);
        if (history.length > 50) {
            history.pop();
        }
        localStorage.setItem(getStorageKey('history', currentMode), JSON.stringify(history));
    } catch (e) {
        console.error('添加历史记录失败:', e);
    }
}

function getHistory(mode) {
    try {
        const data = localStorage.getItem(getStorageKey('history', mode));
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function getModeName(mode) {
    const names = {
        'normal': '化简模式',
        'factor': '因式分解',
        'calculator': '计算模式',
        'equation': '方程模式'
    };
    return names[mode] || mode;
}

function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    if (date.getFullYear() !== now.getFullYear()) {
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        });
    }

    return date.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleHistory() {
    const panel = document.getElementById('historyPanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        renderHistory();
    } else {
        panel.style.display = 'none';
    }
}

function renderHistory() {
    const list = document.getElementById('historyList');
    const history = getHistory(currentMode);
    
    if (history.length === 0) {
        list.innerHTML = '<div class="history-empty">该模式下暂无历史记录</div>';
        return;
    }
    
    list.innerHTML = history.map(item => `
        <div class="history-item" onclick="useHistoryItem(${item.id})">
            <div class="history-mode">${item.modeName}</div>
            <div class="history-expression">${escapeHtml(item.expression)}</div>
            <div class="history-result">${escapeHtml(item.result)}</div>
            <div class="history-time">${formatTime(item.time)}</div>
        </div>
    `).join('');
}

function useHistoryItem(id) {
    const history = getHistory(currentMode);
    const item = history.find(h => h.id === id);
    if (!item) return;
    
    toggleHistory();
    showToast('正在恢复表达式...');
    
    setTimeout(() => {
        clearExpressionInternal();
        for (let char of item.expression) {
            insertValueInternal(char);
        }
        showToast('已恢复');
    }, 100);
}

function clearHistory() {
    if (confirm('确定要清空历史记录吗？')) {
        localStorage.removeItem(getStorageKey('history', currentMode));
        renderHistory();
        showToast('历史记录已清空');
    }
}

function loadFromUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('expr')) return;

    const expr = params.get('expr');
    const mode = params.get('mode');
    const imaginary = params.get('imaginary');

    if (mode && ['normal', 'factor', 'calculator', 'equation'].includes(mode)) {
        currentMode = mode;
        updateModeButtons();
        updateKeyboardDisplay();
        const noticeEl = document.getElementById('modeNotice');
        if (noticeEl) {
            noticeEl.textContent = mode === 'equation' ? '目前只支持一元方程。方程组功能开发中，敬请期待' : '';
        }
        const equationOptions = document.getElementById('equationOptions');
        if (equationOptions) {
            equationOptions.style.display = mode === 'equation' ? 'flex' : 'none';
        }
    }

    if (imaginary === '1') {
        allowImaginary = true;
        const toggle = document.getElementById('imaginaryToggle');
        if (toggle) toggle.checked = true;
    }

    if (expr) {
        clearExpressionInternal();
        try {
            const decoded = decodeURIComponent(expr);
            latexToExpression(decoded);
        } catch (e) {
            console.error('解析分享链接失败:', e);
        }
    }

    updateKeyboardDisplay();
    render();
    history.replaceState({}, '', window.location.pathname);
}

function latexToExpression(latex) {
    const tokens = tokenizeLatex(latex);
    for (const token of tokens) {
        if (token.type === 'text') {
            insertValueInternal(token.value);
        } else if (token.type === 'fraction') {
            const savedCursorContext = cursorContext;
            const savedActiveFractionId = activeFractionId;
            insertFraction();
            if (token.numerator) {
                latexToExpression(token.numerator);
            }
            const fractions = findAllFractions();
            if (fractions.length > 0) {
                const lastFrac = fractions[fractions.length - 1];
                activeFractionId = lastFrac.id;
                cursorContext = 'fraction-denominator';
                cursorPosition = lastFrac.denominator.length;
                render();
            }
            if (token.denominator) {
                for (let i = 0; i < lastFrac.denominator.length; i++) {
                    lastFrac.denominator.pop();
                }
                cursorPosition = 0;
                latexToExpression(token.denominator);
            }
        } else if (token.type === 'sqrt') {
            insertSqrt();
            if (token.content) {
                for (let i = 0; i < activeRoot.content.length; i++) {
                    activeRoot.content.pop();
                }
                cursorPosition = 0;
                latexToExpression(token.content);
            }
        } else if (token.type === 'superscript') {
            insertSuperscript();
            if (token.exponent) {
                const sup = findSuperscriptAtCursor();
                if (sup) {
                    for (let i = 0; i < sup.exponent.length; i++) {
                        sup.exponent.pop();
                    }
                    cursorPosition = 0;
                    latexToExpression(token.exponent);
                }
            }
        }
    }
}

function findAllFractions() {
    const result = [];
    function find(arr) {
        for (const node of arr) {
            if (node.type === 'fraction') {
                result.push(node);
                if (node.numerator) find(node.numerator);
                if (node.denominator) find(node.denominator);
            } else if (node.type === 'sqrt' || node.type === 'cuberoot' || node.type === 'nthroot') {
                if (node.content) find(node.content);
            } else if (node.type === 'superscript') {
                if (node.exponent) find(node.exponent);
            } else if (node.type === 'subscript') {
                if (node.subscript) find(node.subscript);
            }
        }
    }
    find(expression);
    return result;
}

function tokenizeLatex(latex) {
    const tokens = [];
    let i = 0;
    latex = latex.replace(/\\\s+/g, ' ');

    while (i < latex.length) {
        if (latex[i] === '\\') {
            const cmd = latex.slice(i).match(/^\\(\\[a-zA-Z]+|.)/);
            if (cmd) {
                const cmdName = cmd[1];
                if (cmdName === 'frac') {
                    const { content, endIndex } = parseFractionArgs(latex, i + cmd[0].length);
                    tokens.push(content);
                    i = endIndex;
                    continue;
                } else if (cmdName === 'sqrt') {
                    const { content, endIndex } = parseSqrtArgs(latex, i + cmd[0].length);
                    tokens.push(content);
                    i = endIndex;
                    continue;
                } else if (['times', 'div', 'cdot', 'alpha', 'beta', 'gamma', 'delta', 'pi', 'infty', 'sum', 'prod'].includes(cmdName)) {
                    const charMap = {
                        '\\times': '*', '\\div': '/', '\\cdot': '*',
                        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ',
                        '\\delta': 'δ', '\\pi': 'π', '\\infty': '∞'
                    };
                    tokens.push({ type: 'text', value: charMap[cmd[0]] || cmdName });
                    i += cmd[0].length;
                    continue;
                } else {
                    tokens.push({ type: 'text', value: cmdName });
                    i += cmd[0].length;
                    continue;
                }
            }
        } else if (latex[i] === '^') {
            let exp = '';
            i++;
            if (latex[i] === '{') {
                const end = latex.indexOf('}', i);
                exp = latex.slice(i + 1, end);
                i = end + 1;
            } else {
                exp = latex[i];
                i++;
            }
            if (tokens.length > 0 && tokens[tokens.length - 1].type === 'superscript') {
                tokens[tokens.length - 1].exponent += '^' + exp;
            } else {
                tokens.push({ type: 'superscript', exponent: exp });
            }
            continue;
        } else if (/[a-zA-Z0-9]/.test(latex[i])) {
            tokens.push({ type: 'text', value: latex[i] });
            i++;
            continue;
        } else if (/[+\-*/=.,%()\[\]]/.test(latex[i])) {
            tokens.push({ type: 'text', value: latex[i] });
            i++;
            continue;
        }
        i++;
    }
    return tokens;
}

function parseFractionArgs(latex, start) {
    let content = { type: 'fraction', numerator: '', denominator: '' };
    let depth = 0;
    let current = 'numerator';
    let i = start;
    let arg = '';

    while (i < latex.length) {
        const ch = latex[i];
        if (ch === '{') {
            depth++;
            if (depth === 1) continue;
            arg += ch;
        } else if (ch === '}') {
            depth--;
            if (depth === 0) {
                if (current === 'numerator') {
                    content.numerator = arg;
                    current = 'denominator';
                } else {
                    content.denominator = arg;
                }
                return { content, endIndex: i + 1 };
            }
            arg += ch;
        } else if (depth === 1) {
            if (ch === ' ' || ch === '\t') {
                i++;
                continue;
            }
            arg += ch;
        } else {
            arg += ch;
        }
        i++;
    }
    return { content, endIndex: i };
}

function parseSqrtArgs(latex, start) {
    let content = { type: 'sqrt', content: '' };
    let depth = 0;
    let i = start;
    let arg = '';

    while (i < latex.length) {
        const ch = latex[i];
        if (ch === '[') {
            i++;
            while (i < latex.length && latex[i] !== ']') i++;
            i++;
            continue;
        }
        if (ch === '{') {
            depth++;
            if (depth === 1) continue;
            arg += ch;
        } else if (ch === '}') {
            depth--;
            if (depth === 0) {
                content.content = arg;
                return { content, endIndex: i + 1 };
            }
            arg += ch;
        } else if (depth === 1) {
            if (ch === ' ' || ch === '\t') {
                i++;
                continue;
            }
            arg += ch;
        } else {
            arg += ch;
        }
        i++;
    }
    return { content, endIndex: i };
}

function generateShareLink() {
    const latex = expressionToLatexForAI().replace(/\\underline\{\\phantom\{a\}\}/g, '')
                                           .replace(/\\phantom\{\\underline\{a\}\}/g, '')
                                           .trim();
    if (!latex) {
        showToast('请先输入表达式');
        return;
    }

    const shareData = {
        original: latex,
        originalLaTeX: latex,
        originalText: expressionToReadableText(),
        mode: currentMode,
        result: lastResultLatex || '',
        resultText: lastResultText || '',
        process: lastProcessLatex || [],
        processText: lastProcessText || []
    };

    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(shareData));

    let basePath = window.location.pathname;
    const lastSlash = basePath.lastIndexOf('/');
    if (lastSlash > 0) {
        basePath = basePath.substring(0, lastSlash + 1);
    } else {
        basePath = '/';
    }
    const baseUrl = window.location.origin + basePath + 'share.html';
    return baseUrl + '?d=' + compressed;
}

function toggleShareMenu() {
    const menu = document.getElementById('shareMenu');
    menu.classList.toggle('show');
}

document.addEventListener('click', function(e) {
    const menu = document.getElementById('shareMenu');
    if (menu && !e.target.closest('.dropdown')) {
        menu.classList.remove('show');
    }
});

async function copyShareLink() {
    document.getElementById('shareMenu').classList.remove('show');
    const url = generateShareLink();
    if (!url) return;
    try {
        await navigator.clipboard.writeText(url);
        showToast('分享链接已复制');
    } catch (err) {
        prompt('复制链接:', url);
    }
}

async function shareContent() {
    document.getElementById('shareMenu').classList.remove('show');
    const url = generateShareLink();
    if (!url) return;

    const modeNames = { normal: '化简', factor: '因式分解', calculator: '计算', equation: '方程求解' };
    const modeName = modeNames[currentMode] || '计算';

    const text = lastResultLatex
        ? `${modeName}结果：${lastResultText}`
        : `查看我的数学表达式`;

    const shareData = {
        title: `📐 数学${modeName}`,
        text: text,
        url: url
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            if (err.name !== 'AbortError') {
                copyShareLink();
            }
        }
    } else {
        copyShareLink();
    }
}

function toggleSubmenu(id) {
    const submenu = document.getElementById(id);
    if (submenu) {
        submenu.style.display = submenu.style.display === 'none' ? 'block' : 'none';
    }
}

function showForwardDialog() {
    document.getElementById('shareMenu').classList.remove('show');
    document.getElementById('forwardDialog').style.display = 'flex';
}

function closeForwardDialog() {
    document.getElementById('forwardDialog').style.display = 'none';
}

let previewCallback = null;

function showImagePreview(action) {
    if (action === 'forward') {
        closeForwardDialog();
    }
    document.getElementById('previewDialog').style.display = 'flex';
    document.getElementById('previewImage').src = '';
    document.getElementById('previewConfirmBtn').onclick = function() { confirmPreview(action); };

    generateImageDataUrl().then(function(dataUrl) {
        document.getElementById('previewImage').src = dataUrl;
    }).catch(function(err) {
        showToast('生成预览失败');
        closePreviewDialog();
    });
}

function closePreviewDialog() {
    document.getElementById('previewDialog').style.display = 'none';
}

function confirmPreview(action) {
    closePreviewDialog();
    if (action === 'export') {
        downloadImage();
    } else if (action === 'forward') {
        forwardImageData();
    }
}

function generateImageDataUrl() {
    return new Promise(function(resolve, reject) {
        const isDark = document.body.classList.contains('dark-mode');
        const bgColor = isDark ? '#1a1a2e' : 'linear-gradient(135deg,#667eea,#764ba2)';
        const cardBg = isDark ? '#2d2d3a' : '#ffffff';
        const textColor = isDark ? '#e0e0e0' : '#333';
        const subTextColor = isDark ? '#aaa' : '#666';

        const exportCard = document.createElement('div');
        exportCard.style.cssText = 'position:fixed;left:-9999px;top:0;width:600px;padding:40px;background:' + bgColor + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

        const modeNames = { normal: '化简', factor: '因式分解', calculator: '计算', equation: '方程求解' };
        const modeName = modeNames[currentMode] || '计算';

        const innerCard = document.createElement('div');
        innerCard.style.cssText = 'background:' + cardBg + ';border-radius:16px;padding:30px;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

        const header = document.createElement('div');
        header.style.cssText = 'text-align:center;margin-bottom:25px;';
        header.innerHTML = '<h1 style="color:' + textColor + ';font-size:1.5rem;margin:0 0 5px;">📐 数学' + modeName + '</h1><span style="display:inline-block;background:#667eea;color:white;padding:4px 12px;border-radius:20px;font-size:0.85rem;">' + modeName + '</span>';

        const expressionSection = document.createElement('div');
        expressionSection.style.cssText = 'margin-bottom:20px;';
        expressionSection.innerHTML = '<div style="color:' + subTextColor + ';font-size:0.85rem;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">原表达式</div><div style="background:' + (isDark ? '#383850' : '#f8f9fa') + ';border-radius:10px;padding:20px;text-align:center;font-size:1.3rem;color:' + textColor + ';" id="exportExpr"></div>';

        innerCard.appendChild(header);
        innerCard.appendChild(expressionSection);

        if (lastProcessLatex && lastProcessLatex.length > 0) {
            const processSection = document.createElement('div');
            processSection.style.cssText = 'margin-bottom:20px;';
            processSection.innerHTML = '<div style="color:' + subTextColor + ';font-size:0.85rem;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">推导过程</div><div style="background:' + (isDark ? '#383850' : '#f8f9fa') + ';border-radius:10px;padding:15px 20px;" id="exportProcess"></div>';
            innerCard.appendChild(processSection);
        }

        const resultSection = document.createElement('div');
        resultSection.style.cssText = 'margin-bottom:20px;';
        resultSection.innerHTML = '<div style="color:' + subTextColor + ';font-size:0.85rem;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">结果</div><div style="background:linear-gradient(135deg,#4CAF50,#2e7d32);border-radius:10px;padding:20px;text-align:center;color:white;font-size:1.4rem;font-weight:bold;" id="exportRes"></div>';

        const footer = document.createElement('div');
        footer.style.cssText = 'text-align:center;margin-top:20px;padding-top:15px;border-top:1px solid ' + (isDark ? '#555' : '#eee') + ';color:' + subTextColor + ';font-size:0.85rem;';
        footer.innerHTML = '牛逼的代数计算器 · www.yyxc.fun/maths.html';

        innerCard.appendChild(resultSection);
        innerCard.appendChild(footer);
        exportCard.appendChild(innerCard);
        document.body.appendChild(exportCard);

        const exprEl = document.getElementById('exportExpr');
        const resEl = document.getElementById('exportRes');

        const originalLatex = expressionToLatexForAI().replace(/\\underline\{\\phantom\{a\}\}/g, '').replace(/\\phantom\{\\underline\{a\}\}/g, '').trim();
        renderMath(exprEl, originalLatex);
        renderMath(resEl, lastResultLatex || '');

        if (lastProcessLatex && lastProcessLatex.length > 0) {
            const processEl = document.getElementById('exportProcess');
            lastProcessLatex.forEach(function(step) {
                const div = document.createElement('div');
                div.style.cssText = 'padding:6px 0;border-bottom:1px solid ' + (isDark ? '#555' : '#eee') + ';font-size:1.1rem;text-align:left;color:' + textColor + ';';
                renderMath(div, step);
                processEl.appendChild(div);
            });
        }

        html2canvas(exportCard, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            logging: false
        }).then(function(canvas) {
            document.body.removeChild(exportCard);
            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = canvas.width;
            croppedCanvas.height = Math.max(canvas.height - 10, 1);
            const ctx = croppedCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height - 10, 0, 0, canvas.width, canvas.height - 10);
            resolve(croppedCanvas.toDataURL('image/png'));
        }).catch(function(err) {
            document.body.removeChild(exportCard);
            reject(err);
        });
    });
}

function downloadImage() {
    generateImageDataUrl().then(function(dataUrl) {
        const link = document.createElement('a');
        link.download = '数学结果_' + formatDateTimeForFile() + '.png';
        link.href = dataUrl;
        link.click();
        showToast('已导出图片');
    }).catch(function(err) {
        showToast('导出图片失败');
    });
}

function forwardImageData() {
    generateImageDataUrl().then(function(dataUrl) {
        const modeNames = { normal: '化简', factor: '因式分解', calculator: '计算', equation: '方程求解' };
        const modeName = modeNames[currentMode] || '计算';

        dataUrlToBlob(dataUrl).then(function(blob) {
            if (navigator.share) {
                try {
                    const file = new File([blob], `数学${modeName}.png`, { type: 'image/png' });
                    navigator.share({ title: `📐 数学${modeName}`, files: [file] });
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = '数学结果_' + formatDateTimeForFile() + '.png';
                        a.click();
                    }
                }
            } else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = '数学结果_' + formatDateTimeForFile() + '.png';
                a.click();
            }
        });
    }).catch(function(err) {
        showToast('转发图片失败');
    });
}

function dataUrlToBlob(dataUrl) {
    return new Promise(function(resolve) {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        resolve(new Blob([u8arr], { type: mime }));
    });
}

async function forwardLink() {
    closeForwardDialog();
    const url = generateShareLink();
    if (!url) return;

    const modeNames = { normal: '化简', factor: '因式分解', calculator: '计算', equation: '方程求解' };
    const modeName = modeNames[currentMode] || '计算';
    const text = lastResultLatex ? `${modeName}结果：${lastResultText}` : `查看我的数学表达式`;

    if (navigator.share) {
        try {
            await navigator.share({ title: `📐 数学${modeName}`, text: text, url: url });
        } catch (err) {
            if (err.name !== 'AbortError') copyShareLink();
        }
    } else {
        copyShareLink();
    }
}

async function forwardTxt() {
    closeForwardDialog();
    const url = generateShareLink();
    if (!url) return;

    const modeNames = { normal: '化简', factor: '因式分解', calculator: '计算', equation: '方程求解' };
    const modeName = modeNames[currentMode] || '计算';

    let content = `数学${modeName}\n`;
    content += `原表达式：${expressionToReadableText()}\n`;
    content += `---\n`;
    if (lastProcessText && lastProcessText.length > 0) {
        lastProcessText.forEach(step => { content += step + '\n'; });
    }
    content += `---\n`;
    content += `结果：${lastResultText || lastResultLatex || '-'}\n`;
    content += `---\n链接：${url}`;

    if (navigator.share) {
        try {
            const blob = new Blob([content], { type: 'text/plain' });
            const file = new File([blob], `数学${modeName}.txt`, { type: 'text/plain' });
            await navigator.share({ title: `📐 数学${modeName}`, files: [file] });
        } catch (err) {
            if (err.name !== 'AbortError') {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
                a.download = `数学${modeName}_${formatDateTimeForFile()}.txt`;
                a.click();
            }
        }
    } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
        a.download = `数学${modeName}_${formatDateTimeForFile()}.txt`;
        a.click();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    const savedMode = localStorage.getItem(STORAGE_PREFIX + 'mode');
    if (savedMode && ['normal', 'factor', 'calculator', 'equation'].includes(savedMode)) {
        currentMode = savedMode;
        updateModeButtons();
        updateKeyboardDisplay();
        const noticeEl = document.getElementById('modeNotice');
        if (noticeEl) {
            noticeEl.textContent = savedMode === 'equation' ? '目前只支持一元方程。方程组功能开发中，敬请期待' : '';
        }
        // 显示方程选项
        const equationOptions = document.getElementById('equationOptions');
        if (equationOptions) {
            equationOptions.style.display = savedMode === 'equation' ? 'flex' : 'none';
        }
    }
    loadSavedExpression(currentMode);
});