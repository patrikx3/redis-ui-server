/**
 * Get TTL for all fields in a hash key (Redis 8.0+ HTTL command).
 * Returns { fieldTtls: { fieldName: ttlSeconds, ... } }
 */
export default async (options) => {
    const { socket, payload } = options

    try {
        const redis = socket.p3xrs.ioredis
        const { key, fields } = payload

        if (!fields || fields.length === 0) {
            socket.emit(options.responseEvent, { status: 'ok', fieldTtls: {} })
            return
        }

        // HTTL key FIELDS count field [field ...]
        const result = await redis.call('HTTL', key, 'FIELDS', fields.length, ...fields)

        const fieldTtls = {}
        if (Array.isArray(result)) {
            for (let i = 0; i < fields.length && i < result.length; i++) {
                fieldTtls[fields[i]] = parseInt(result[i])
            }
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            fieldTtls,
        })
    } catch (e) {
        // Redis < 8.0 doesn't support HTTL — return empty
        socket.emit(options.responseEvent, {
            status: 'ok',
            fieldTtls: {},
        })
    }
}
