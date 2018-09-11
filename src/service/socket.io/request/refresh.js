const sharedIoRedis = require('../shared')

const consolePrefix = 'socket.io refresh redis disconnect'

module.exports = async(options) => {
    const {socket } = options;

    const redis = socket.p3xrs.ioredis

    try {
       const results = await Promise.all([
           redis.info(),
           sharedIoRedis.getStreamKeys({
               redis: redis,
           })
       ])

        socket.emit(options.responseEvent, {
            status: 'ok',
            info: results[0],
            keys: results[1]
        })
    } catch(e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: error
        })

    }

}