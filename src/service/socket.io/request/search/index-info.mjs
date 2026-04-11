export default async (options) => {
    const {socket, payload} = options

    try {
        const redis = socket.p3xrs.ioredis
        const result = await redis.call('FT.INFO', payload.index)

        // Parse alternating key-value array into object
        const info = {}
        for (let i = 0; i < result.length; i += 2) {
            const key = result[i]
            const value = result[i + 1]
            info[key] = value
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            data: info,
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
