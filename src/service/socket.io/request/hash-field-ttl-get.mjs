const consolePrefix = 'socket.io hash-field-ttl-get'

export default async (options) => {
    const { socket, payload } = options

    try {
        const redis = socket.p3xrs.ioredis
        const { key, field } = payload

        const result = await redis.call('HTTL', key, 'FIELDS', 1, field)
        const ttl = Array.isArray(result) ? parseInt(result[0]) : -1

        socket.emit(options.responseEvent, {
            status: 'ok',
            ttl: ttl,
        })
    } catch (e) {
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
