// 流式对话接口：把 DeepSeek 的 SSE 流原样透传给前端。
//
// 为什么必须放在 Edge Function 而不是 Serverless Function：
// Serverless Function 的**流式响应有 60 秒硬执行上限，且 Netlify 不允许调整**，
// 于是「高思考等级 + 难题」这类动辄一两分钟的思考会被拦腰掐断。
// Edge Function 只限制 50ms CPU 时间，等待上游响应的时间不计入，
// 因此可以长时间保持连接、持续把 SSE 分片推给浏览器。

const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL_NAME = 'deepseek-v4-flash';  // 自带思考模式

const json = (status, data) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });

export default async (request) => {
    // 1. 只允许 POST 请求
    if (request.method !== 'POST') {
        return json(405, { error: 'Method Not Allowed' });
    }

    // 2. 检查密钥是否存在
    const apiKey = Netlify.env.get('DEEPSEEK_API_KEY');
    if (!apiKey) {
        console.error('环境变量 DEEPSEEK_API_KEY 未设置');
        return json(500, { error: '服务器配置错误' });
    }

    let body;
    try {
        body = await request.json();
    } catch (e) {
        return json(400, { error: '请求体格式错误' });
    }

    // 3. 组装请求：思考模式相关参数仅在传入时下发
    const { messages, temperature = 0.8, max_tokens = 4000, thinking, reasoning_effort } = body;
    const payload = {
        model: MODEL_NAME,
        messages: messages,
        temperature: temperature,
        max_tokens: max_tokens,
        stream: true
    };
    if (thinking) payload.thinking = thinking;
    if (reasoning_effort) payload.reasoning_effort = reasoning_effort;

    let upstream;
    try {
        upstream = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('请求 DeepSeek 失败:', error);
        return json(502, { error: String((error && error.message) || error) });
    }

    if (!upstream.ok) {
        const errorText = await upstream.text();
        console.error('DeepSeek API 错误:', errorText);
        return json(upstream.status, { error: errorText });
    }

    // 4. 直接把上游的 SSE 流交给前端
    return new Response(upstream.body, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no'
        }
    });
};

// 只有声明了 path，Edge Function 才会被路由到；否则永远不会执行
export const config = { path: '/api/chat-stream' };
