import * as sharedIoRedis from '../shared.mjs'

const consolePrefix = 'socket.io timeseries del'

export default async (options) => {
    const {socket, payload} = options;

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const redis = socket.p3xrs.ioredis
        const key = payload.key
        const from = payload.from
        const to = payload.to

        console.info(consolePrefix, key, from, to)

        const deleted = await redis.call('TS.DEL', key, from, to)

        socket.emit(options.responseEvent, {
            status: 'ok',
            deleted: deleted,
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
