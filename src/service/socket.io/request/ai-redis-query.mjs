const AI_NETWORK_URL_PROD = 'https://network.corifeus.com'
const AI_NETWORK_URL_DEV = 'http://localhost:8003'

function getNetworkUrl() {
    if (typeof p3xrs.cfg.aiNetworkUrl === 'string' && p3xrs.cfg.aiNetworkUrl.length > 0) {
        return p3xrs.cfg.aiNetworkUrl
    }
    const isDev = process.env.NODE_ENV === 'development'
    return isDev ? AI_NETWORK_URL_DEV : AI_NETWORK_URL_PROD
}

export default async (options) => {
    const { socket, payload } = options

    try {
        const { prompt, context } = payload

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            throw new Error('AI_PROMPT_REQUIRED')
        }

        const networkUrl = getNetworkUrl()
        console.info('ai-redis-query using network URL:', networkUrl)
        let response
        try {
            response = await fetch(`${networkUrl}/public/ai/redis-query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt.trim(),
                    context: context || {},
                    apiKey: p3xrs.cfg.groqApiKey || undefined,
                }),
            })
        } catch (fetchError) {
            throw new Error('AI service is not reachable')
        }

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
            throw new Error(`AI service returned invalid response (${response.status})`)
        }

        const data = await response.json()

        if (data.status !== 'ok') {
            throw new Error(data.message || 'AI query failed')
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            command: data.data.command,
            explanation: data.data.explanation,
        })
    } catch (e) {
        console.error('ai-redis-query error', e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
