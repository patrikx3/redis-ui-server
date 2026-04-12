import { ensureReadonlyConnection } from '../../shared.mjs'

export default async (options) => {
    const { socket } = options
    try {
        ensureReadonlyConnection({ socket })
        const redis = socket.p3xrs.ioredis
        if (!redis) {
            socket.emit(options.responseEvent, { status: 'error', error: 'Not connected to Redis' })
            return
        }
        await redis.slowlog('RESET')
        socket.emit(options.responseEvent, { status: 'ok' })
    } catch (e) {
        console.error('monitor/slowlog-reset failed', e)
        socket.emit(options.responseEvent, { status: 'error', error: e.message })
    }
}
