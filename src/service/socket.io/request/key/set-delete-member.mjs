import * as sharedIoRedis from '../../shared.mjs'

const consolePrefix = 'socket.io key list delete index'

export default async (options) => {
    const {socket, payload} = options;

    const redis = socket.p3xrs.ioredis

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const {key, value} = payload;

        await redis.sremBuffer(key, value)

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
