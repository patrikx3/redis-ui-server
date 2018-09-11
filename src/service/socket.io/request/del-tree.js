const consolePrefix = 'socket.io del tree'

const sharedIoRedis = require('../shared')

module.exports = async(options) => {
    const { socket, payload } = options;

    try {
        let redis = socket.p3xrs.ioredis

        const deleteTree = `${payload.key}${payload.redisTreeDivider}*`;

        console.info(consolePrefix, deleteTree)
        const keys = await sharedIoRedis.getStreamKeys({
            redis: redis,
            match: deleteTree
        })
        for(let key of keys) {
            console.info(consolePrefix, 'delete key ', key)
            await redis.del(key)
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            keys: await sharedIoRedis.getStreamKeys({
                redis: socket.p3xrs.ioredis
            })
        })
    } catch(e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e,
        })
    }


}