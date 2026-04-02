import * as sharedIoRedis from '../shared.mjs'

const consolePrefix = 'socket.io timeseries add'

export default async (options) => {
    const {socket, payload} = options;

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const redis = socket.p3xrs.ioredis
        const key = payload.key
        const timestamp = payload.timestamp || '*'
        const value = payload.value

        console.info(consolePrefix, key, timestamp, value)

        const result = await redis.call('TS.ADD', key, timestamp, value, 'ON_DUPLICATE', 'LAST')

        socket.emit(options.responseEvent, {
            status: 'ok',
            timestamp: result,
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
