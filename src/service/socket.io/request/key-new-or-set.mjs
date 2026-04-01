import * as sharedIoRedis from '../shared.mjs'
import { isProOrEnterpriseTier } from '../../../lib/license-tier.mjs'

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

const consolePrefix = 'socket.io key new'

export default async (options) => {
    const {socket, payload} = options;

    const redis = socket.p3xrs.ioredis

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const {model} = payload;
        if (isBinaryLike(model.value) && !isProOrEnterpriseTier()) {
            throw new Error('feature-pro-json-binary-required')
        }

        model.score = model.score === null ? undefined : model.score
        model.index = model.index === null ? undefined : model.index
        model.hashKey = model.hashKey === null ? undefined : model.hashKey
//console.warn(consolePrefix, payload)
        switch (model.type) {
            case 'stream':
                const xaddArgs = [
                    model.key,
                    model.streamTimestamp,
                ].concat(sharedIoRedis.argumentParser(model.value))
                await redis.xadd(...xaddArgs)
                break;

            case 'string':
                await redis.set(model.key, model.value)
                break;

            case 'list':
                if (model.index === undefined) {
                    await redis.rpush(model.key, model.value)
                } else {
                    if (model.index === -1) {
                        await redis.lpush(model.key, model.value)
                    } else {
                        const size = await redis.llen(model.key);
                        if (model.index > -1 && model.index < size) {
                            await redis.lset(model.key, model.index, model.value)
                        } else {
                            const listOutOBoundsError = new Error('list-out-of-bounds')
                            listOutOBoundsError.code = 'list-out-of-bounds'
                            throw listOutOBoundsError
                        }
                    }
                }
                break;

            case 'hash':
                if (payload.hasOwnProperty('originalHashKey')) {
                    await redis.hdel(model.key, payload.originalHashKey)
                }
                await redis.hset(model.key, model.hashKey, model.value)
                break;

            case 'set':
                if (payload.hasOwnProperty('originalValue')) {
                    await redis.srem(model.key, payload.originalValue)
                }
                await redis.sadd(model.key, model.value)
                break;

            case 'zset':
                if (payload.hasOwnProperty('originalValue')) {
                    await redis.zrem(model.key, payload.originalValue)
                }
                await redis.zadd(model.key, model.score, model.value)
                break;

            case 'json':
                if (!isProOrEnterpriseTier()) {
                    throw new Error('feature-pro-rejson-required')
                }
                // Validate JSON before sending to Redis
                try {
                    JSON.parse(model.value)
                } catch (e) {
                    throw new Error('invalid-json-value')
                }
                await redis.call('JSON.SET', model.key, '$', model.value)
                break;

        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            key: model.key,
        })
        /*
        await sharedIoRedis.getFullInfoAndSendSocket({
            redis: redis,
            responseEvent: options.responseEvent,
            socket: socket,
            extend: {
                key: model.key
            },
            payload: payload,

        })
         */
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message
        })

    }

}
