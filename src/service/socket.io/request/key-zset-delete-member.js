const consolePrefix = 'socket.io key zsit delete member'

module.exports = async (options) => {
    const {socket, payload} = options;

    const redis = socket.p3xrs.ioredis

    try {
        const {key, value} = payload;

        console.log(consolePrefix, payload)
        await redis.zrem(key, value)

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
