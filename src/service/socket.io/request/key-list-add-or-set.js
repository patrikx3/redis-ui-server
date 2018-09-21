const consolePrefix = 'socket.io key list add or set'
const sharedIoRedis = require('../shared')

module.exports = async(options) => {
    const {socket,payload } = options;

    const redis = socket.p3xrs.ioredis

    try {
        const  { model, key } = payload;

        console.log(key, model)
        await redis.lset(key, model.index, model.value)

        await sharedIoRedis.getFullInfoAndSendSocket({
            redis: redis,
            responseEvent: options.responseEvent,
            socket: socket,
            extend: {
                key: key
            }
        })
    } catch(e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e
        })

    }

}