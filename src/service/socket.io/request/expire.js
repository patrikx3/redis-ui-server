const consolePrefix = 'socket.io expire'

module.exports = async(options) => {
    const { socket, payload } = options;

    try {
        let redis = socket.p3xrs.ioredis

        console.info(consolePrefix, payload.key, payload.ttl)

        await redis.expire(payload.key, parseInt(payload.ttl))
        
        socket.emit(options.responseEvent, {
            status: 'ok',

        })

    } catch(e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e,
        })
    }


}