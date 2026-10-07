# 音乐下载器新增「热门歌曲」「AI 推荐」「搜索历史」实现计划

## Context
在已上线的网页版音乐下载器（`music.html` + `netlify/edge-functions/music-api.ts`）基础上新增三块功能：
1. **热门歌曲**：接入 higequ.com 首页「热门歌曲」区块（6首，`trending-item` 结构）+ `/rege/` 热歌榜单页（30首，与搜索结果同构的 `result-item`），**合并按 id 去重**（用户已确认两处合并）。
2. **AI 推荐**：基于用户**搜索关键词**（仅此依据，用户已确认），复用已有 DeepSeek 集成（`DEEPSEEK_API_KEY` 已在 Netlify 环境变量，chat-stream.ts 先例）。
3. **搜索历史**：本地记录搜索关键词并展示（用户额外要求）。

已调研确认：
- 首页热门区块正则：`<div class="trending-item" onclick="goPlayer\('(\d+)'\)">[\s\S]*?<div class="trending-title">([^<]+)</div>[\s\S]*?<div class="trending-artist">([^<]+)</div>`
- `/rege/` 页 30 条，`result-item` 结构与搜索页一致 → 直接复用 `parseSearchPage()`
- DeepSeek 非流式调用模式：POST `https://api.deepseek.com/chat/completions`，model `deepseek-v4-flash`，可带 `response_format:{type:'json_object'}` 强制 JSON

## 文件修改

### 1) `netlify/edge-functions/music-api.ts`（修改，新增 2 路由）
- **`GET /api/music/hot`**：
  - 并行 fetch `https://higequ.com/`（首页）与 `https://higequ.com/rege/`
  - 首页用 `parseTrending(html)`：匹配上述 trending 正则，产出 `{id,title,artist}`
  - `/rege/` 复用现有 `parseSearchPage(html)`
  - 合并：trending 在前，按 id 去重（保留首次出现），返回 `{ results: [{id,title,artist}], source: 'higequ-hot' }`
- **`POST /api/music/recommend`**：
  - 校验 method 为 POST；解析 body `{ history: string[] }`，裁剪：最多 20 条、每条去空白且 ≤30 字符
  - 若无 `Netlify.env.get('DEEPSEEK_API_KEY')` → 500 `{error:'AI 推荐暂未配置'}`
  - 组装 messages（system 提示：基于搜索历史推荐 8 首风格相近中文歌曲，返回 JSON `{"songs":[{"title","artist"}]}`，不与搜索词重复）；调 DeepSeek 非流式，`response_format:{type:'json_object'}`，`max_tokens:1200`，AbortController 超时 ~45s
  - 解析 `choices[0].message.content` 的 JSON（兼容 ```json 围栏，strip 后 parse，失败则返回 502）
  - 对每个建议歌名在 higequ 搜索页 1（复用搜索逻辑，取第一条；建议带歌手且首条歌手不匹配时，遍历该页结果找歌手匹配项）
  - 返回 `{ results: 找到的[{id,title,artist}], missing: 未找到的歌名数组 }`（cap 8 首）
- **config.path** 扩为 `['/api/music/search','/api/music/song','/api/music/dl','/api/music/hot','/api/music/recommend']`

### 2) `music.html`（修改）
- **搜索历史**：
  - localStorage key `musicSearchHistory`（去重、最近在前、上限 20）
  - 搜索成功时记录关键词；在搜索框下方渲染 chips（点击→填入并搜索，✕ 删除，尾部「清空」按钮）
- **Tab 栏**（搜索结果面板头部下方）：`🔍 搜索 | 🔥 热门歌曲 | ✨ AI 推荐`；`state.tab` 控制
  - 搜索 tab：现有逻辑 + 分页
  - 热门 tab：fetch `/api/music/hot` → 渲染到同一结果列表（编号 1-N，隐藏分页）
  - AI tab：无历史时提示"先搜索几首歌再试"；有历史则 POST `/api/music/recommend` → 渲染结果；`missing` 的歌名以弱样式列出（"未能找到：xxx"）
  - 结果点击一律走现有 `openSong(id)`（详情面板不变）
- 切 tab 时提示文案（`searchHint`）相应更新；加载态复用现有 `setLoading` 骨架

## 实现顺序
1. 改 `music-api.ts`（新增 hot/recommend + config.path）
2. 改 `music.html`（历史 chips + tab + 两接口接入）
3. 本地验证

## 验证
- 临时本地代理镜像新增路由后 curl：`/api/music/hot` 应返回 ≥30 条（含去重）；`/api/music/recommend` 需 `$env:DS_KEY` 且给历史数组，返回若干结果（DeepSeek 真实调用，仅本地人工验证，密钥不写进站点文件）
- 浏览器实测：搜索记录 chips 出现/点击/删除/清空 → 热门 tab 出 36 首 → 点开详情正常 → AI tab（有历史时）出推荐列表 → 深色模式不回归
- 验证后清理临时文件
