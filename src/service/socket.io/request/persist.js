const sharedIoRedis = require('../shared')

const consolePrefix = 'socket.io persists'

module.exports = async (options) => {
    const {socket, payload} = options;

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        let redis = socket.p3xrs.ioredis

        await redis.persist(payload.key)

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
