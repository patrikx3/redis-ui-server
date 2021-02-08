const sharedIoRedis = require('../shared')

const consolePrefix = 'socket.io stream delete timestamp id'

const utils = require('corifeus-utils')

module.exports = async (options) => {
    const {socket, payload} = options;

    const redis = socket.p3xrs.ioredis

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const {key, streamTimestamp} = payload;

        await redis.xdel(key, streamTimestamp)

        socket.emit(options.responseEvent, {
            status: 'ok',
        })

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message
        })

    }

}
