const consolePrefix = 'socket.io string-digest'

export default async (options) => {
    const { socket, payload } = options

    try {
        const redis = socket.p3xrs.ioredis
        const { key } = payload

        const digest = await redis.call('DIGEST', key)

        socket.emit(options.responseEvent, {
            status: 'ok',
            digest: digest,
        })
    } catch (e) {
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
