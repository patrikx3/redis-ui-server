module.exports = async (options) => {
    const {socket, payload} = options;

    const redis = socket.p3xrs.ioredis

    try {
        const ttl = await redis.ttl(payload.key)
        await redis.set(payload.key, payload.value)

        if (ttl !== -1) {
            await redis.expire(payload.key, ttl)
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e
        })

    }

}
