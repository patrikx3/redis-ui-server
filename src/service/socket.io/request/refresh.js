const sharedIoRedis = require('../shared')

//const consolePrefix = 'socket.io refresh redis'

module.exports = async(options) => {
    const {socket } = options;

    const redis = socket.p3xrs.ioredis

    try {
        const result = await sharedIoRedis.getFullInfo({
            redis: redis,
        })

        socket.emit(options.responseEvent, {
            status: 'ok',
            info: result.info,
            keys: result.keys,
            keysType: result.keysType
        })
    } catch(e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e
        })

    }

}