export default async (options) => {
    const { socket, payload } = options
    try {
        const redis = socket.p3xrs.ioredis
        if (!redis) {
            socket.emit(options.responseEvent, { status: 'error', error: 'Not connected to Redis' })
            return
        }
        const info = await redis.call('ACL', 'GETUSER', payload.username)
        const result = {}
        for (let i = 0; i < info.length; i += 2) {
            result[info[i]] = info[i + 1]
        }
        socket.emit(options.responseEvent, { status: 'ok', data: result })
    } catch (e) {
        console.error('acl/get-user failed', e)
        socket.emit(options.responseEvent, { status: 'error', error: e.message })
    }
}
