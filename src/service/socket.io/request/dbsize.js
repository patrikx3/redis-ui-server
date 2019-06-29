module.exports = async(options) => {
    const { socket, payload } = options;

    try {
        let redis = socket.p3xrs.ioredis

        const dbsize = await redis.dbsize()

        socket.emit(options.responseEvent, {
            dbsize,
        })

    } catch(e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e,
        })
    }


}