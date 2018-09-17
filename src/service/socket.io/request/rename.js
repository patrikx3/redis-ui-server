const consolePrefix = 'socket.io rename key'

const sharedIoRedis = require('../shared')

module.exports = async(options) => {
    const { socket, payload } = options;

    try {
        let redis = socket.p3xrs.ioredis

        console.info(consolePrefix, payload.key)

        await redis.rename(payload.key, payload.keyNew)

        const result = await sharedIoRedis.getFullInfo({
            redis: redis,
        })

        socket.emit(options.responseEvent, {
            status: 'ok',
            info: result.info,
            keys: result.keys,
            keysInfo: result.keysInfo,
        })

    } catch(e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e,
        })
    }


}