export default async (options) => {
    const { socket } = options
    try {
        const redis = socket.p3xrs.ioredis
        if (!redis) {
            socket.emit(options.responseEvent, { status: 'error', error: 'Not connected to Redis' })
            return
        }
        const result = await redis.call('MEMORY', 'DOCTOR')
        socket.emit(options.responseEvent, { status: 'ok', data: { text: result } })
    } catch (e) {
        console.error('memory/doctor failed', e)
        socket.emit(options.responseEvent, { status: 'error', error: e.message })
    }
}
