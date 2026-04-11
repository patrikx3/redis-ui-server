import * as sharedIoRedis from '../../shared.mjs'

export default async (options) => {
    const {socket, payload} = options;

    const redis = socket.p3xrs.ioredis

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const { key, path, value } = payload

        if (!key) {
            throw new Error('key is required')
        }

        const jsonPath = path || '$'

        await redis.call('JSON.SET', key, jsonPath, value)

        socket.emit(options.responseEvent, {
            status: 'ok',
            key: key,
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message
        })
    }
}
