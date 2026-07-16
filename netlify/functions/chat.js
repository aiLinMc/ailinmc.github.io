const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL_NAME = 'deepseek-v4-flash';  // 根据你的模型调整

exports.handler = async (event, context) => {
    // 1. 只允许 POST 请求
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    // 2. 检查密钥是否存在
    if (!API_KEY) {
        console.error('环境变量 DEEPSEEK_API_KEY 未设置');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: '服务器配置错误' })
        };
    }

    try {
        // 3. 解析前端发来的数据
        const { messages, temperature = 0.8, max_tokens = 4000 } = JSON.parse(event.body);

        // 4. 转发请求给 DeepSeek
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: messages,
                temperature: temperature,
                max_tokens: max_tokens,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('DeepSeek API 错误:', errorText);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: errorText })
            };
        }

        const data = await response.json();
        // 5. 直接返回 DeepSeek 的响应
        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('函数内部错误:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};