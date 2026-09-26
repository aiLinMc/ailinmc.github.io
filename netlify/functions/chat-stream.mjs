// 流式对话接口：把 DeepSeek 的 SSE 流原样透传给前端
// 使用 Netlify Functions v2（返回 Response，支持流式响应）
const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL_NAME = 'deepseek-v4-flash';  // 根据你的模型调整（自带思考模式）

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
    if (!API_KEY) {
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
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('请求 DeepSeek 失败:', error);
        return json(502, { error: error.message });
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
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    });
};
