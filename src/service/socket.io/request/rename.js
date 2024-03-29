const consolePrefix = 'socket.io rename key'

const sharedIoRedis = require('../shared')

module.exports = async (options) => {
    const {socket, payload} = options;

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        let redis = socket.p3xrs.ioredis

        console.info(consolePrefix, payload.key)

        await redis.rename(payload.key, payload.keyNew)

        /*
        await sharedIoRedis.getFullInfoAndSendSocket({
            redis: redis,
            responseEvent: options.responseEvent,
            socket: socket,
            payload: payload,

        })
         */

        socket.emit(options.responseEvent, {
            status: 'ok',
        })

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }


}
