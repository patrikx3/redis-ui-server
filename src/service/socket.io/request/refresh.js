const sharedIoRedis = require('../shared')

//const consolePrefix = 'socket.io refresh redis'

module.exports = async (options) => {
    const {socket, payload} = options;

    const redis = socket.p3xrs.ioredis

    try {

        await sharedIoRedis.getFullInfoAndSendSocket({
            redis: redis,
            responseEvent: options.responseEvent,
            socket: socket,
            payload: payload,
        })

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e
        })

    }

}
