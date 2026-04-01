export default async (options) => {
    const {socket} = options

    try {
        const redis = socket.p3xrs.ioredis
        const indexes = await redis.call('FT._LIST')

        socket.emit(options.responseEvent, {
            status: 'ok',
            data: Array.isArray(indexes) ? indexes : [],
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
