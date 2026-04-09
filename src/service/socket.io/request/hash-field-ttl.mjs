const consolePrefix = 'socket.io hash-field-ttl'

export default async (options) => {
    const { socket, payload } = options

    try {
        const redis = socket.p3xrs.ioredis
        const { key, field, ttl } = payload

        if (ttl === -1) {
            // Remove field TTL (persist)
            await redis.call('HPERSIST', key, 'FIELDS', 1, field)
        } else {
            // Set field TTL in seconds
            await redis.call('HEXPIRE', key, ttl, 'FIELDS', 1, field)
        }

        // Get remaining TTL for the field
        const remaining = await redis.call('HTTL', key, 'FIELDS', 1, field)
        const fieldTtl = Array.isArray(remaining) ? parseInt(remaining[0]) : -1

        socket.emit(options.responseEvent, {
            status: 'ok',
            ttl: fieldTtl,
        })
    } catch (e) {
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
