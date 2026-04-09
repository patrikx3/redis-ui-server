const consolePrefix = 'socket.io vectorset getattr'

export default async (options) => {
    const {socket, payload} = options;

    try {
        const redis = socket.p3xrs.ioredis
        const { key, element } = payload

        const raw = await redis.call('VGETATTR', key, element)

        // Parse flat string "field\nvalue\nfield\nvalue" or null
        const attrs = {}
        if (raw && typeof raw === 'string') {
            const parts = raw.split('\n')
            for (let i = 0; i < parts.length; i += 2) {
                if (parts[i]) attrs[parts[i]] = parts[i + 1] || ''
            }
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            attributes: attrs,
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
