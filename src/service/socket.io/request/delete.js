const consolePrefix = 'socket.io del key'

const sharedIoRedis = require('../shared')

module.exports = async (options) => {
    const {socket, payload} = options;

    try {
        let redis = socket.p3xrs.ioredis

        console.info(consolePrefix, payload.key)

        await redis.del(payload.key)

        await sharedIoRedis.getFullInfoAndSendSocket({
            redis: redis,
            responseEvent: options.responseEvent,
            socket: socket,
            payload: {
                match: payload.match,
            },
        })

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }


}
