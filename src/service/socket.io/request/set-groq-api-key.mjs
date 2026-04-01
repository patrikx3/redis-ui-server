import fs from 'fs'

export default async (options) => {
    const { socket, payload } = options

    try {
        if (p3xrs.cfg.groqApiKeyReadonly === true) {
            throw new Error('GROQ_API_KEY_READONLY')
        }

        const apiKey = (payload.apiKey || '').trim()

        // Update runtime config
        p3xrs.cfg.groqApiKey = apiKey || undefined

        // Persist to p3xrs.json
        if (p3xrs.configPath) {
            try {
                const raw = fs.readFileSync(p3xrs.configPath, 'utf8')
                const config = JSON.parse(raw)
                if (!config.p3xrs || typeof config.p3xrs !== 'object') {
                    config.p3xrs = {}
                }
                if (apiKey) {
                    config.p3xrs.groqApiKey = apiKey
                } else {
                    delete config.p3xrs.groqApiKey
                }
                fs.writeFileSync(p3xrs.configPath, JSON.stringify(config, null, 4))
            } catch (e) {
                console.error('failed to persist groqApiKey', e.message)
            }
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
