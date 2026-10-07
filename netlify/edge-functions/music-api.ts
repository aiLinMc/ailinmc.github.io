// 音乐下载器后端代理：抓取 Hi歌曲网(higequ.com) 的搜索与歌曲详情，并代理音频试听/下载。
//
// 为什么放在 Edge Function：higequ.com 不返回 CORS 头，浏览器无法直接抓取，
// 必须由服务器端代理。音频 CDN（kuwo.cn）支持 Range 请求，Edge Function 可
// 长时间流式透传（与 chat-stream.ts 同理：等待上游的时间不计入 CPU 限额）。

const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const HIGEQ = 'https://higequ.com';

const json = (status: number, data: unknown): Response =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

// base64 解码为 UTF-8 字符串（用于 `let code = "..."` 降级取音频链接）
function b64ToUtf8(s: string): string {
    try {
        const binary = atob(s);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    } catch {
        return '';
    }
}

// 从音频 URL 提取扩展名（忽略查询串/锚点，避免 .aac?v=xxx 被误判）
function formatOf(audioUrl: string): string {
    const m = audioUrl.match(/\.(mp3|aac|m4a|flac)(?:[?#]|$)/i);
    return m ? '.' + m[1].toLowerCase() : '.mp3';
}

function parseSearchPage(html: string): Array<{ id: string; title: string; artist: string }> {
    const results: Array<{ id: string; title: string; artist: string }> = [];
    const pattern =
        /<div class="result-item" data-rid="(\d+)">[\s\S]*?<div class="result-title">([^<]+)<\/div>[\s\S]*?<div class="result-artist">([^<]+)<\/div>/g;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) {
        results.push({ id: m[1], title: m[2].trim(), artist: m[3].trim() });
    }
    return results;
}

// 首页「热门歌曲」区块解析（trending-item 结构，带 goPlayer('id')）
function parseTrending(html: string): Array<{ id: string; title: string; artist: string }> {
    const results: Array<{ id: string; title: string; artist: string }> = [];
    const pattern =
        /<div class="trending-item" onclick="goPlayer\('(\d+)'\)">[\s\S]*?<div class="trending-title">([^<]+)<\/div>[\s\S]*?<div class="trending-artist">([^<]+)<\/div>/g;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) {
        results.push({ id: m[1], title: m[2].trim(), artist: m[3].trim() });
    }
    return results;
}

async function handleHot(): Promise<Response> {
    const [home, rege] = await Promise.all([
        fetch(`${HIGEQ}/`, { headers: { 'User-Agent': UA } }),
        fetch(`${HIGEQ}/rege/`, { headers: { 'User-Agent': UA } }),
    ]);
    if (!home.ok && !rege.ok) {
        return json(502, { error: '热门歌曲获取失败，请稍后重试' });
    }
    const homeHtml = home.ok ? await home.text() : '';
    const regeHtml = rege.ok ? await rege.text() : '';
    // 首页热门（6首）在前，/rege/ 榜单在后，按 id 去重
    const seen = new Set<string>();
    const results: Array<{ id: string; title: string; artist: string }> = [];
    for (const r of [...parseTrending(homeHtml), ...parseSearchPage(regeHtml)]) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        results.push(r);
    }
    return json(200, { results, source: 'higequ-hot' });
}

// ==================== AI 推荐 ====================

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions';
const AI_MODEL = 'deepseek-v4-flash';

class RecommendError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

// 调用 DeepSeek 生成风格相近的歌曲建议（JSON 输出）。
// 注意：deepseek-v4-flash 是推理模型，reasoning_content 可能吃掉全部 max_tokens，
// 导致 content 在半截处被截断（finish_reason: length）。因此 max_tokens 给足 4096，
// 且内容为空 / 解析失败时重试最多 3 次兜底。
async function aiSuggest(history: string[]): Promise<Array<{ title: string; artist?: string }>> {
    const apiKey = Netlify.env.get('DEEPSEEK_API_KEY');
    if (!apiKey) throw new RecommendError('AI 推荐暂未配置', 500);

    const system =
        '你是音乐推荐助手。根据用户的搜索历史，推荐 8 首风格相近、在华语音乐中广为人知的歌曲。\n' +
        '要求：\n' +
        '1. 歌名必须是常见、在音乐网站上能找到的歌曲\n' +
        '2. 不要推荐与搜索词完全相同的歌曲\n' +
        '3. 只输出严格 JSON：{"songs":[{"title":"歌名","artist":"歌手"}]}，不要输出其他内容';

    for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 45000);
        let resp: Response;
        try {
            resp = await fetch(DEEPSEEK_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: `用户搜索历史：${history.join('、')}` },
                    ],
                    temperature: 0.7,
                    max_tokens: 4096,
                    response_format: { type: 'json_object' },
                }),
                signal: controller.signal,
            });
        } catch {
            clearTimeout(timer);
            throw new RecommendError('AI 服务请求失败，请稍后重试', 502);
        }
        clearTimeout(timer);
        if (!resp.ok) throw new RecommendError(`AI 服务错误（${resp.status}）`, 502);

        const data = (await resp.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const content =
            (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
        const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        if (!cleaned) continue;
        let parsed: { songs?: Array<{ title?: string; artist?: string }> };
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            continue;
        }
        const songs = (parsed.songs || [])
            .slice(0, 8)
            .map((s) => ({
                title: (s.title || '').trim().slice(0, 60),
                artist: (s.artist || '').trim().slice(0, 60),
            }))
            .filter((s) => s.title);
        if (songs.length) return songs;
    }
    throw new RecommendError('AI 返回内容解析失败', 502);
}

// 在 higequ 搜索建议歌名，返回第一条匹配；带歌手时优先歌手匹配项
async function searchFirst(title: string, artist?: string) {
    try {
        const resp = await fetch(`${HIGEQ}/s/${encodeURIComponent(title)}/1/`, {
            headers: { 'User-Agent': UA },
        });
        if (!resp.ok) return null;
        const html = await resp.text();
        const pageResults = parseSearchPage(html);
        if (!pageResults.length) return null;
        if (artist) {
            const hit = pageResults.find((r) => r.artist === artist);
            if (hit) return hit;
        }
        return pageResults[0];
    } catch {
        return null;
    }
}

async function handleRecommend(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json(405, { error: 'Method Not Allowed' });
    let body: { history?: unknown };
    try {
        body = await request.json();
    } catch {
        return json(400, { error: '请求体格式错误' });
    }
    const history = (Array.isArray(body.history) ? body.history : [])
        .filter((h): h is string => typeof h === 'string')
        .map((h) => h.trim().slice(0, 30))
        .filter(Boolean)
        .slice(0, 20);
    if (!history.length) return json(400, { error: '缺少搜索历史，先搜索几首歌再试' });

    let songs: Array<{ title: string; artist?: string }>;
    try {
        songs = await aiSuggest(history);
    } catch (e) {
        if (e instanceof RecommendError) return json(e.status, { error: e.message });
        return json(502, { error: String((e as Error).message || e) });
    }
    if (!songs.length) return json(502, { error: 'AI 未返回有效推荐' });

    const results: Array<{ id: string; title: string; artist: string }> = [];
    const missing: string[] = [];
    for (const s of songs) {
        const hit = await searchFirst(s.title, s.artist);
        if (hit) results.push(hit);
        else missing.push(s.title);
        if (results.length >= 8) break;
    }
    return json(200, { results, missing });
}

async function handleSearch(url: URL): Promise<Response> {
    const keyword = (url.searchParams.get('keyword') || '').trim();
    if (!keyword) return json(400, { error: '缺少 keyword 参数' });
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const site1 = page * 2 - 1;
    const site2 = page * 2;
    const [r1, r2] = await Promise.all([
        fetch(`${HIGEQ}/s/${encodeURIComponent(keyword)}/${site1}/`, {
            headers: { 'User-Agent': UA },
        }),
        fetch(`${HIGEQ}/s/${encodeURIComponent(keyword)}/${site2}/`, {
            headers: { 'User-Agent': UA },
        }),
    ]);
    if (!r1.ok && !r2.ok) {
        return json(502, {
            error: `上游搜索失败（${r1.status} / ${r2.status}），请稍后重试`,
        });
    }
    const html1 = r1.ok ? await r1.text() : '';
    const html2 = r2.ok ? await r2.text() : '';
    const results = [...parseSearchPage(html1), ...parseSearchPage(html2)];
    const totalMatch = html1.match(/共\s*<span[^>]*>(\d+)<\/span>\s*页/);
    const siteTotal = totalMatch ? parseInt(totalMatch[1], 10) : 1;
    return json(200, { results, total_pages: Math.ceil(siteTotal / 2) });
}

async function handleSong(url: URL): Promise<Response> {
    const id = (url.searchParams.get('id') || '').trim();
    if (!/^\d+$/.test(id)) return json(400, { error: '无效的歌曲 ID' });
    const resp = await fetch(`${HIGEQ}/player/${id}/`, { headers: { 'User-Agent': UA } });
    if (!resp.ok) return json(resp.status, { error: `页面请求失败：${resp.status}` });
    const html = await resp.text();

    // 歌名（含 " - " 时截断前半，与桌面版一致）
    let title = '未知歌名';
    let m = html.match(/<h2[^>]*id="music-title"[^>]*>([^<]+)<\/h2>/);
    if (m) {
        title = m[1].trim();
        if (title.includes(' - ')) title = title.split(' - ', 1)[0].trim();
    } else {
        m = html.match(/<title>([^<]+)<\/title>/);
        if (m) {
            title = m[1].replace(/MP3下载|在线试听/g, '').trim();
            if (title.includes(' - ')) title = title.split(' - ', 1)[0].trim();
        }
    }

    // 歌手
    let artist = '未知歌手';
    m = html.match(/<span[^>]*id="music-artist"[^>]*>([^<]+)<\/span>/);
    if (m) artist = m[1].trim();

    // 封面
    let coverUrl: string | null = null;
    m = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
    if (!m) m = html.match(/<img[^>]*id="album-cover"[^>]*src="([^"]+)"/);
    if (m) coverUrl = m[1];

    // 音频链接：逐级降级（复刻 latest.py）
    let audioUrl: string | null = null;
    m = html.match(/<source\s+src="([^"]+\.(?:mp3|aac|m4a|flac))"/i);
    if (m) audioUrl = m[1];
    if (!audioUrl) {
        m = html.match(/https?:\/\/[^\s"']+\.mp3/i);
        if (m) audioUrl = m[0];
    }
    if (!audioUrl) {
        m = html.match(/https?:\/\/[^\s"']+kuwo\.cn[^\s"']+\.(?:aac|mp3|m4a)/i);
        if (m) audioUrl = m[0];
    }
    if (!audioUrl) {
        m = html.match(/let\s+code\s*=\s*"([^"]+)"/);
        if (m) {
            const real = b64ToUtf8(m[1]);
            if (real.startsWith('http')) audioUrl = real;
        }
    }
    const audioFormat = audioUrl ? formatOf(audioUrl) : '.mp3';

    // 歌词：优先带 data-time 时间戳；无时间戳时降级为纯文本
    const lrc: Array<{ t: number; text: string }> = [];
    const lyrics: string[] = [];
    const lrcPattern = /<div class="lyric-line"\s*data-time="([^"]+)"[^>]*>([^<]+)<\/div>/g;
    let lm: RegExpExecArray | null;
    while ((lm = lrcPattern.exec(html)) !== null) {
        const t = parseFloat(lm[1]);
        const text = lm[2].trim();
        lrc.push({ t, text });
        lyrics.push(text);
    }
    if (lrc.length === 0) {
        const textPattern = /<div class="lyric-line"[^>]*>([^<]+)<\/div>/g;
        while ((lm = textPattern.exec(html)) !== null) lyrics.push(lm[1].trim());
    }

    return json(200, {
        title,
        artist,
        cover_url: coverUrl,
        audio_url: audioUrl,
        audio_format: audioFormat,
        song_id: id,
        lyrics: lyrics.length ? lyrics : ['暂无歌词'],
        lrc,
        page_url: `${HIGEQ}/player/${id}/`,
    });
}

// 代理试听/下载：校验域名白名单（防 SSRF 开放代理），透传 Range 支持 <audio> 拖动
async function handleDl(request: Request, url: URL): Promise<Response> {
    const target = url.searchParams.get('url') || '';
    const name = decodeURIComponent(url.searchParams.get('name') || '');
    const inline = url.searchParams.get('inline') === '1';
    if (!target) return json(400, { error: '缺少 url 参数' });

    let upstreamUrl: URL;
    try {
        upstreamUrl = new URL(target);
    } catch {
        return json(400, { error: '无效的 url 参数' });
    }
    const host = upstreamUrl.hostname.toLowerCase();
    if (!host.endsWith('kuwo.cn') && !host.endsWith('higequ.com')) {
        return json(400, { error: '不允许代理该域名' });
    }

    const headers: Record<string, string> = { 'User-Agent': UA, Referer: 'https://higequ.com/' };
    const range = request.headers.get('range');
    if (range) headers['Range'] = range;
    const ifRange = request.headers.get('if-range');
    if (ifRange) headers['If-Range'] = ifRange;

    let upstream: Response;
    try {
        upstream = await fetch(target, { headers });
    } catch {
        return json(502, { error: '音频获取失败，请稍后重试' });
    }
    if (!upstream.ok && upstream.status !== 206) {
        return json(upstream.status, { error: `音频请求失败：${upstream.status}` });
    }

    const out = new Headers({ 'Cache-Control': 'no-cache, no-transform' });
    const passthrough = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag'];
    for (const h of passthrough) {
        const v = upstream.headers.get(h);
        if (v) out.set(h, v);
    }
    if (!inline) {
        const safeName = (name || 'download').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
        out.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`);
    }
    return new Response(upstream.body, { status: upstream.status, headers: out });
}

export default async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = url.pathname;
    try {
        if (pathname === '/api/music/search') return await handleSearch(url);
        if (pathname === '/api/music/song') return await handleSong(url);
        if (pathname === '/api/music/dl') return await handleDl(request, url);
        if (pathname === '/api/music/hot') return await handleHot();
        if (pathname === '/api/music/recommend') return await handleRecommend(request);
        return json(404, { error: 'Not Found' });
    } catch (e) {
        return json(500, { error: String((e && (e as Error).message) || e) });
    }
};

export const config = {
    path: ['/api/music/search', '/api/music/song', '/api/music/dl', '/api/music/hot', '/api/music/recommend'],
};
