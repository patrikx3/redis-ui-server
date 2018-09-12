const consolePrefix = 'socket.io get key full'

const sharedIoRedis = require('../shared')

module.exports = async(options) => {
    const { socket, payload } = options;

    try {
        let redis = socket.p3xrs.ioredis

        const key = payload.key;
        const type = payload.type;

        console.info(consolePrefix, type, key)

        let value
        let length
        switch(type) {
            case 'string':
                value = await redis.get(key)
                break;

            case 'list':
                length = await redis.llen(key)
                value = await redis.lrange(key, 0, length)
                break;

            case 'hash':
                value = await redis.hgetall(key)
                break;

            case 'set':
                length = await redis.llen(key)
                value = await redis.lrange(key, 0, length)
                break;

            case 'zset':
                length = await redis.llen(key)
                value = await redis.lrange(key, 0, length)
                break;
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            value: value,
            ttl: await redis.ttl(key),
        })
    } catch(e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e,
        })
    }


}