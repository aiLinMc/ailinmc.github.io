# 音乐下载器 · 歌单系统实现计划

## Context

音乐下载器已拆分为三个页面（music.html 主页 / search.html 搜索 / player.html 播放），共享 `assets/js/music-common.js`（MusicCommon 模块）与 `assets/css/music.css`（CSS 变量驱动浅/深色模式）。现添加歌单系统：

- 默认歌单「我喜欢」：不可重命名、不可删除
- 用户可创建 / 重命名 / 删除自定义歌单
- 歌单以 JSON 存 localStorage（无后端数据库，纯前端功能），每首歌含 `id`、`title`、`artist`

## 数据设计（localStorage 键 `musicPlaylists`）

```json
[
  {"id": "default", "name": "我喜欢", "fixed": true, "songs": [{"id": "228908", "title": "晴天", "artist": "周杰伦"}]},
  {"id": "m9k2x1", "name": "开车", "fixed": false, "songs": []}
]
```

- 首次加载自动创建默认歌单（`id:'default'`, `name:'我喜欢'`, `fixed:true`, `songs:[]`）
- 新歌单 id：`Date.now().toString(36) + 随机段`
- 歌单名：trim 后 1–20 字，允许同名；歌曲 title 上限 60 字，入库前 trim
- 读取：JSON.parse + try/catch（沿用 getHistory 模式），损坏/非数组 → 重置为默认歌单；逐项过滤缺 id/name 的歌单、缺 id 的歌曲
- 去重策略：歌单内按 song.id 去重（重复加入返回失败）；同一首歌可加入多个不同歌单

## 改动清单

### 1. `assets/js/music-common.js`（核心存储 + 弹窗助手）

新增 `Playlists` 命名空间并导出到 MusicCommon：
- `load()` / `_save(list)` — 读/写（带损坏兜底）
- `getAll()` — 返回歌单数组（含自动创建默认歌单）
- `create(name)` — 校验（空名/超长 toast 报错），返回新歌单对象或 null
- `rename(id, name)` — `fixed:true` 拒绝
- `remove(id)` — `fixed:true` 拒绝
- `addSong(plId, {id,title,artist})` — 歌单内按 id 去重，重复返回 false
- `removeSong(plId, songId)`
- `songIn(songId)` — 返回包含该歌的歌单 id 数组（供 player 弹窗打勾）

新增通用弹窗助手：
- `openModal({title, body, onClose})` — 生成遮罩+面板，body 为 DOM 元素或 HTML 字符串，返回 close 函数；点遮罩/Esc 关闭
- `closeModal()`
- 三种用法由调用方拼 body：列表选择（checkbox 行）、输入（input+确认按钮）、确认删除（危险按钮）

> 不用原生 prompt/confirm/alert，与全站风格一致。

### 2. `assets/css/music.css`

新增（全部走现有 CSS 变量，自动适配深色）：
- `.modal-mask`（fixed inset 0、z-index 60、半透明遮罩）/ `.modal` / `.modal-head` / `.modal-body` / `.modal-actions`
- `.icon-btn`（危险小按钮）、`.btn` 基础按钮
- 歌单页：`.playlist-layout`（flex 两栏，≤840px 折叠单列）、`.pl-item`（含 `.active` 态）、`.pl-song` 歌曲行（复用 result-item 视觉）

### 3. `playlists.html`（新建，歌单管理页）

- 标准 topbar：品牌 + `.page-nav`（主页/搜索/歌单，歌单 active）+ 主题按钮
- 两栏布局：
  - 左栏：歌单列表（名称 + 歌曲数 + 操作按钮：重命名/删除；默认歌单只显示 ♥ 标识无操作）+「新建歌单」按钮
  - 右栏：选中歌单的歌曲列表（歌名 + 歌手 + 播放/移除按钮），点击歌曲 → `player.html?id=`；空态提示
- 新建/重命名：页内输入弹窗（modal + input）；删除：确认弹窗（危险按钮）
- 引用 music-common.js，操作后 toast 反馈

### 4. `player.html`（加入歌单入口）

- `.dl-btns` 新增按钮：`<button class="dl-btn ghost" id="addToPlaylist">♡ 加入歌单</button>`
- `renderDetail(s)` 缓存当前歌曲 `{id, title, artist}`
- 点击按钮打开弹窗：逐歌单列出 checkbox（已含该歌的打勾），点击切换加入/移出；弹窗底部「新建歌单」输入行（输入 → 创建 → 加入该歌）

### 5. `music.html` / `search.html` / `player.html` 导航

三个页面的 `.page-nav` 均追加 `<a class="nav-link" href="playlists.html">歌单</a>`

## 实现顺序

1. music-common.js（Playlists + modal 助手）
2. music.css（modal / 歌单页样式）
3. playlists.html（新建）
4. player.html（加入歌单按钮 + 弹窗）
5. 三个页面 nav 链接

## 验证

1. 重建临时本地代理（镜像 music-api.ts 四路由，同 `music_proxy.py` 模式，端口 8077）→ `python -m http.server` 不可用（/api/music/* 会 404），必须用代理镜像
2. 浏览器验证：
   - playlists.html：默认歌单「我喜欢」存在且无重命名/删除按钮；新建/重命名/删除歌单；重命名/删除默认歌单被拒绝（按钮不存在 + 代码守卫）；同名歌单可创建
   - 歌单内歌曲增删、点击歌曲跳 player.html 且歌手正确
   - player.html?id=228908：详情加载正常，点「加入歌单」弹窗打勾切换加入/移出，弹窗内新建歌单并加入
   - 刷新后数据持久化（localStorage）
   - 深色模式切换后 modal/歌单页样式正常；console 无报错
3. 清理临时代理与验证文件

## 不做的事

- 不改后端 music-api.ts / netlify.toml（歌单纯前端 localStorage）
- 不做歌单排序/拖拽/播放全部/多选批量操作（未要求）
