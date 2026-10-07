# 网页版音乐下载器实现计划

## Context
用户有一款 Python(Tkinter) 桌面版音乐下载器 `music_update/latest.py`（数据源 Hi歌曲网 higequ.com），希望做一个网页版：精美 UI + 深色模式（与其他页面同步）。已确认 higequ.com 不返回 CORS 头，浏览器无法直接抓取，必须服务器端代理 —— 沿用项目既有的 Netlify Edge Function 方案（`netlify/edge-functions/chat-stream.ts` 先例）。已用 curl 实测确认：搜索/播放页 HTML 结构与 Python 正则匹配、UTF-8 编码、音频 CDN（kuwo.cn）支持 Range 请求。

## 文件清单
1. **新建** `netlify/edge-functions/music-api.ts` — 唯一后端代理，3 条路由
2. **新建** `music.html`（项目根目录）— 前端页面，纯原生 HTML/CSS/JS
3. **不改** `netlify.toml` — `/api/chat` 为精确重定向，不拦 `/api/music/*`；Edge Function 自动发现

## 1) Edge Function `netlify/edge-functions/music-api.ts`
`export const config = { path: ['/api/music/search', '/api/music/song', '/api/music/dl'] }`（Netlify 支持 path 数组），沿用 chat-stream.ts 的写法。上游请求统一带 Chrome UA。

- **`GET /api/music/search?keyword=X&page=N`**
  - 并行 fetch 两个站点页：`https://higequ.com/s/{encodeURIComponent(keyword)}/{2N-1}/` 和 `/2N/`
  - 总页数：`共\s*<span[^>]*>(\d+)</span>\s*页` → `Math.ceil(sitePages/2)`
  - 结果正则：`<div class="result-item" data-rid="(\d+)">[\s\S]*?<div class="result-title">([^<]+)</div>[\s\S]*?<div class="result-artist">([^<]+)</div>`（逐页收集）
  - 返回 `{ results: [{id,title,artist}], total_pages }`；任一页失败返回对应错误 JSON

- **`GET /api/music/song?id=X`**
  - 抓 `https://higequ.com/player/{id}/`
  - 依次解析（复刻 latest.py）：歌名 `<h2 id="music-title">`（含 ` - ` 截断前半）→ 歌手 `<span id="music-artist">` → 封面 `<meta property="og:image">` 或 `<img id="album-cover">` → 音频 URL：`<source src="...\.(mp3|aac|m4a|flac)">` → 直接 `.mp3` → `kuwo.cn` → base64 `let code="..."`（`atob` + UTF-8 解码）
  - 歌词：`<div class="lyric-line" data-time="([^"]+)"[^>]*>([^<]+)</div>` → `{t, text}` 数组；无 data-time 则降级纯文本数组
  - 返回 `{ title, artist, cover_url, audio_url, audio_format, song_id, lyrics[], lrc[{t,text}] }`

- **`GET /api/music/dl?url=X&name=Y[&inline=1]`**
  - 域名白名单校验（防 SSRF 开放代理）：`new URL(url).hostname` 必须以 `kuwo.cn` 或 `higequ.com` 结尾
  - 透传 `Range`/`If-Range` 请求头，fetch 上游后原样透传 `upstream.body` + 状态码（206 保留，供 `<audio>` 拖动进度）+ Content-Type/Length/Range/Accept-Ranges
  - `inline=1`：用音频 Content-Type（试听用）；否则 `Content-Disposition: attachment; filename*=UTF-8''{encodeURIComponent(name)}`（RFC5987，中文文件名必须 filename*）
  - `name` 先 `decodeURIComponent`，再剥离 `\ / : * ? " < > |` 与非法字符

## 2) 前端 `music.html`
**深色模式（与其他页面同步）**：完全复用 ai.html 机制 —— `:root` + `body.dark-mode` 覆盖 CSS 变量，`localStorage 'darkMode'`（'true'=深色），加载时 `applyTheme(localStorage.getItem('darkMode')==='true')`，顶栏切换按钮翻转并存 localStorage。同源共享同一 key，即天然全站同步。配色沿用：浅色 `--bg:#f5f6f8 --surface:#fff --accent:#2ea043`，深色 `--bg:#0b0f14 --surface:#141c26 --accent:#3fb950`。

**布局**（响应式，移动端单列堆叠）：
- 顶栏：品牌（🎵 音乐下载器 + 副标题"数据来源：Hi歌曲网"）+ 深色模式按钮
- 搜索区：输入框 + 搜索按钮
- 双栏：左侧搜索结果列表（歌名/歌手）+ 分页（上一页/下一页/页码）；右侧详情卡（封面、歌名、歌手、格式徽标、`<audio controls preload="metadata">` 试听、下载音频、下载 LRC、歌词面板）

**JS 状态机**：`state = { keyword, page, totalPages, results, currentSong }`
- `doSearch()`：fetch `/api/music/search`，加载态 + 错误 toast；分页缓存 `Map`（keyword+page 为键，上限防膨胀，关键词变化清空）
- `openSong(id)`：fetch `/api/music/song`，渲染封面/详情/歌词，试听 `<audio src="/api/music/dl?url=..&inline=1">`
- 下载：普通 `<a href="/api/music/dl?url=..&name=..">`（服务端保证 attachment），文件名 `{title} - {artist}{ext}`；LRC 在前端从 `lrc[{t,text}]` 生成 `[MM:SS] 文本`
- 无歌词 → "暂无歌词"并禁用 LRC 按钮；非 2xx → toast；`audio.onerror` → 提示可能已下架
- 页脚保留与 Python 一致的数据来源/内部使用声明

## 实现顺序
1. 写 `music-api.ts`
2. 写 `music.html`
3. 本地验证（见下）

## 验证
- **本地全流程**：临时写 `proxy_local.py`（`http.server` 子类，镜像 edge function 三路由逻辑 + 静态文件服务，仅用于验证，验证后删除），起在本地端口，浏览器打开 `music.html` 实测：搜索"月亮" → 点开一首 → 试听拖动进度（验证 Range）→ 下载音频 → 下载 LRC → 切深色/浅色并验证 localStorage 'darkMode' 与其他页同步。
- **API 冒烟**：`curl /api/music/search?keyword=月亮&page=1`、`curl /api/music/song?id=159822`、`curl -r 0-99 /api/music/dl?...` 应返回 206。
- **部署**：推到 Netlify 后（edge function 自动生效），线上 `ailinmc.top/music.html` 复测。
