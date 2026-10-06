# newfu 停服纪念站实现计划

## Context
Minecraft 服务器 "newfu"（服主 皑菱(lzc)）于 2026.10.5 17:00 停服。用户需要一个纪念网站，核心内容是：
- 展示停服公告全文（用户提供的公告文案）
- 展示纪念文（AI 代笔的抒情纪念文，位于 Hero 之后、公告之前，落款服主 皑菱(lzc)）
- 下载精选截图（`assets\images\mc_screenshots\` 内 40 张 1920×1080 PNG，每张 3–6MB，共约 180MB）
- 数据回顾 + 服主落款

已确认决策：生成缩略图供画廊快速加载；下载方式 = 每张单独下载 + 一键打包全部 zip + 顺带 NewfuMetro 材质包；只做独立页 `newfu.html`（不改 index.html）。

## 产出文件
| 文件 | 类型 | 说明 |
|---|---|---|
| `newfu.html` | 新建 | 纪念站本体（自包含单文件 HTML/CSS/JS，仿 index.html 深色主题风格） |
| `scripts/make_mc_gallery.py` | 新建 | 一次性构建脚本：生成缩略图 + 打包全部截图为 zip（可重复运行） |
| `assets/images/mc_screenshots_thumbs/*.jpg` | 生成 | 缩略图（JPEG q85、宽度 640px） |
| `assets/downloads/mc_screenshots.zip` | 生成 | 全部截图打包（约 180MB），zip 内平铺文件名，不含缩略图 |
| `assets/images/mc_screenshots/*.png` | 不动 | 原图（下载来源） |
| `newfu/NewfuMetro.zip` | 不动 | 地铁画作材质包（222KB），一并提供下载 |

## newfu.html 页面结构
复用 index.html 的 CSS 变量（--bg #0b0f14 / --surface #141c26 / --border #223040 / --text #e6edf3 / --muted #8b98a5 / --accent #3fb950）、`.bg-grid` 方块网格背景、`.bg-glow` 光晕、`.card` 卡片样式、`.reveal` 入场动画，全部内联。

1. **Hero**：服务器名 `newfu`（mono 字体 + accent 色）、主标题「停服纪念」、日期「2026.10.5 17:00 停服」、一句挽词
2. **纪念文**（Hero 之后、公告之前）：AI 代笔的抒情纪念文，基于服务器经历（一年余运营、两次服务器端大迁移、n 次崩溃、数十个 Boss、数千种结构、多个维度探索）成文，落款服主 皑菱(lzc)；排版同公告（pre-wrap + 首行缩进），用户可后续审阅修改文案
3. **停服公告**：`.announcement` 卡片，文案**原样保留**，`white-space: pre-wrap` 保换行，正文 `text-indent: 2em` 首行缩进，落款不缩进
4. **数据回顾**：六张统计卡（运营一年多 / 两次服务器端大迁移 / n 次崩溃 / 数十个 Boss / 数千种结构 / 多个维度）
5. **截图画廊**（见下）
6. **下载区**：两张下载卡片 —— 全部截图 zip（标注约 180MB）、NewfuMetro 材质包（222KB），均带 `download` 属性
7. **Footer**：`© 2026 皑菱 aiLinMc` + 一行纪念语

## 截图画廊
**分类**（40 张已逐一核对）：

| 分类 | 张数 | 文件 |
|---|---|---|
| 玩家之家 | 14 | lyc的家_1~5、lzc的家_1~3、tzx的家_1~3、xml的家、zzh的家_1~2 |
| 聚居地 | 3 | 聚居地_新、聚居地_新.远景、聚居地_旧 |
| 工业 | 6 | 工业_1~5、旧熔炉 |
| 交通 | 2 | 交通_1、交通_2 |
| 建筑地标 | 5 | 楼阁、永恒星光_1~4 |
| 活动合影 | 8 | 合照_1、合照_2、合照_2.1、双人_1、双人_2、中秋、生物捕捉、农夫乐事 |
| 风景奇观 | 2 | 暮色森林、浮岛 |

**数据驱动渲染**：JS 数组 `const GALLERY = [{title, files:[...]}, ...]`，路径由文件名派生：
```js
const thumb = n => `assets/images/mc_screenshots_thumbs/${n.slice(0, -4)}.jpg`;
const full  = n => `assets/images/mc_screenshots/${n}`;
```
（必须用 `slice(0,-4)` 截掉 `.png`，不能用 split(".")，否则 "聚居地_新.远景.png" 截错。）

**交互**：缩略图 `<img loading="lazy">` 网格 → 点击开灯箱（复用 ai.html 的极简 `.lightbox`：fixed 遮罩、`.show{display:grid}`、点遮罩/Esc 关闭；打开时才赋原图 src，不预载 3–6MB 原图）；灯箱内显示文件名 + 「下载原图」按钮；每张卡片一个独立下载小按钮（stopPropagation）；画廊顶部「下载全部 zip」按钮。

## 构建脚本 scripts/make_mc_gallery.py 要点
- 用 `Path(__file__).resolve().parents[1]` 定位项目根，任意 cwd 可运行
- 遍历 `assets/images/mc_screenshots/*.png`（过滤 `.lower().endswith(".png")`）
- 每张 `Image.open().convert("RGB")` → `thumbnail((640,640))` → 存 `mc_screenshots_thumbs/{name[:-4]}.jpg`（q85、optimize），目录 `os.makedirs(exist_ok=True)`
- `zipfile` 打包全部 png 到 `assets/downloads/mc_screenshots.zip`（ZIP_DEFLATED、arcname 只取文件名平铺；写前删旧 zip 保证幂等；不打缩略图；zip 所在目录互不包含不会装进自己）
- 输出统计（张数、耗时、zip 大小）便于确认

## 坑与对策
- 中文文件名：Python3 zipfile 自动 UTF-8 标志；同源 `<a download>` 浏览器按 UTF-8 处理，OK
- Netlify 静态文件无单文件大小上限，但首次部署约 360MB（原图+zip）上传慢，页面上标注 zip 体积让用户按需下载
- 本地验证必须用 `python -m http.server`（http 服务），`file://` 下 download 属性失效
- 若本地预览改过 newfu.html，浏览器可能缓存旧版，验证时加 `?v=N` 破缓存

## 验证
1. 运行 `python scripts/make_mc_gallery.py`，确认 40 张缩略图生成、zip 生成且大小合理
2. `python -m http.server` 本地起服务，访问 newfu.html：
   - 公告文案与原公告逐字一致
   - 纪念文渲染正常、位置在 Hero 之后公告之前
   - 画廊 7 类分组显示、缩略图懒加载正常
   - 点缩略图开灯箱显示原图、Esc/遮罩关闭、灯箱内下载正常
   - 卡片下载按钮、下载全部 zip、NewfuMetro 材质包下载均正常
   - 中文文件名下载名正确
3. 用 grep 比对 GALLERY 数组文件名与磁盘 `mc_screenshots` 目录一一对应
