import Groq from 'groq-sdk'

export default async (options) => {
    const { socket, payload } = options

    try {
        const apiKey = (payload.apiKey || '').trim()

        if (!apiKey) {
            socket.emit(options.responseEvent, { status: 'ok', valid: true })
            return
        }

        if (!apiKey.startsWith('gsk_') || apiKey.length < 20) {
            socket.emit(options.responseEvent, { status: 'ok', valid: false, message: 'Invalid key format' })
            return
        }

        const client = new Groq({ apiKey })
        await client.chat.completions.create({
            messages: [{ role: 'user', content: 'test' }],
            model: 'openai/gpt-oss-120b',
            max_tokens: 1,
        })

        socket.emit(options.responseEvent, { status: 'ok', valid: true })
    } catch (e) {
        console.error('validate-groq-api-key error', e.message)
        socket.emit(options.responseEvent, { status: 'ok', valid: false, message: e.message })
    }
}
