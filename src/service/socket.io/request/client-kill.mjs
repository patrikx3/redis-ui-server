import * as sharedIoRedis from '../shared.mjs'

export default async (options) => {
    const {socket, payload} = options

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const redis = socket.p3xrs.ioredis
        await redis.client('KILL', 'ID', payload.id)

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
