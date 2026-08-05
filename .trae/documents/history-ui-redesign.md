# history.html UI 重设计 + 筛选功能

## Context
当前 history.html 使用手风琴折叠布局，每次只能看一个学期，查找特定周的作业需要反复展开/折叠。用户希望去掉折叠改为全部平铺，并增加筛选功能（年级+学期+搜索）快速定位。保留橙色主题。

## 改动文件

### 1. `history.html` — 结构重写
- 去掉手风琴折叠结构（`semester-container` / `semester-header` / `semester-content`）
- 在 header 下方添加筛选栏：
  - 年级筛选按钮组：全部 | 七年级 | 八年级 | 九年级
  - 学期筛选按钮组：全部 | 上学期 | 下学期
  - 搜索框：输入周数（如 "3" 或 "第三"）
- 所有周卡片直接平铺在一个网格容器 `#cards-grid` 中
- 每张卡片携带 `data-grade`、`data-term`、`data-week` 属性供筛选
- 数据数组增加 `grade` 和 `term` 字段：

```javascript
const semesters = [
    { title: '九年级下学期', folder: '九下', grade: '九年级', term: '下学期', weeks: [...], hasPng: true },
    { title: '九年级上学期', folder: '九上', grade: '九年级', term: '上学期', weeks: range(1,21), hasPng: true },
    // ... 其余四个学期同理
];
```

- 每张卡片结构：
```html
<div class="week-card" data-grade="九年级" data-term="下学期" data-week="3">
    <span class="card-tag tag-九">九下</span>
    <h3 class="week-title">第三周</h3>
    <div class="download-links">
        <a href="..." class="download-link pdf" download="...">下载PDF</a>
        <a href="..." class="download-link" download="...">下载图片</a>
    </div>
</div>
```

### 2. `css/homework/history.css` — 样式重写
- 保留橙色渐变 header、深色模式、dark-mode-toggle
- 新增筛选栏样式 `.filter-bar`：固定在 header 下方，按钮组用 chip 样式
- `.filter-btn` / `.filter-btn.active`：橙色系高亮选中态
- 搜索框 `.filter-search`：圆角输入框
- `.cards-grid`：响应式网格 `repeat(auto-fill, minmax(240px, 1fr))`
- `.week-card`：白底圆角卡片，hover 上浮
- `.card-tag`：左上角彩色小标签区分年级（七=绿、八=蓝、九=橙）
- 筛选隐藏的卡片用 `display:none`
- 空结果提示 `.no-results`

### 3. `javascript/homework/history.js` — 逻辑重写
- 保留 `toggleDarkMode()` / `updateDarkModeButton()` / DOMContentLoaded 暗色初始化
- 删除 `toggleSemester()`（不再需要折叠）
- 新增筛选逻辑：
  - `currentGrade` / `currentTerm` / `searchText` 三个状态
  - `applyFilter()`：遍历所有 `.week-card`，根据 data 属性和搜索文本切换 `display`
  - 年级/学期按钮点击 → 更新 active 状态 → 调用 `applyFilter()`
  - 搜索框 `input` 事件 → 更新 `searchText` → 调用 `applyFilter()`
  - 无匹配时显示 `.no-results` 提示

### 4. `javascript/homework/history_pdf-download.js` — 无需修改
PDF 下载拦截逻辑不变，仍通过 `a.download-link.pdf` 选择器绑定。

## 验证
1. 打开 history.html，确认所有 ~110 张周卡片平铺显示
2. 点击"八年级"筛选 → 只显示八上+八下的卡片
3. 再点击"上学期" → 只显示八上的卡片
4. 搜索框输入"3" → 只显示第3周（所有年级）
5. 清空筛选 → 恢复全部卡片
6. 切换深色模式 → 样式正常
7. 点击"下载PDF" → Blob 下载正常触发
8. 手机宽度下网格自适应单列
