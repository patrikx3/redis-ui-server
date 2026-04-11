import * as sharedIoRedis from '../../shared.mjs'

const isBinaryLike = (value) => {
    if (value === undefined || value === null) {
        return false
    }
    if (Buffer.isBuffer(value)) {
        return true
    }
    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
        return true
    }
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(value)) {
        return true
    }
    return false
}

export default async (options) => {
    const {socket, payload} = options;

    const redis = socket.p3xrs.ioredis

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const ttl = await redis.ttl(payload.key)
        await redis.set(payload.key, payload.value)

        if (ttl !== -1) {
            await redis.expire(payload.key, ttl)
        }

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
