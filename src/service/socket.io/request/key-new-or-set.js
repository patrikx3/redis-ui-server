const sharedIoRedis = require('../shared')

const consolePrefix = 'socket.io key new'

module.exports = async (options) => {
    const {socket, payload} = options;

    const redis = socket.p3xrs.ioredis

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const {model} = payload;

        model.score = model.score === null ? undefined : model.score
        model.index = model.index === null ? undefined : model.index
        model.hashKey = model.hashKey === null ? undefined : model.hashKey
//console.warn(consolePrefix, payload)
        switch (model.type) {
            case 'stream':
                await redis.xadd(model.key, model.streamTimestamp, model.streamField, model.value)
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


        }

        await sharedIoRedis.getFullInfoAndSendSocket({
            redis: redis,
            responseEvent: options.responseEvent,
            socket: socket,
            extend: {
                key: model.key
            },
            payload: payload,

        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message
        })

    }

}
