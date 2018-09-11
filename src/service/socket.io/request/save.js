module.exports = async(options) => {
    const {socket } = options;

    const redis = socket.p3xrs.ioredis

    try {
        await redis.save()

        socket.emit(options.responseEvent, {
            status: 'ok',
            info: await redis.info(),
        })
    } catch(e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e
        })

    }

}