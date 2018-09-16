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
        const pipelineDeleteTree = redis.pipeline()
        for(let key of keys) {
            console.info(consolePrefix, 'delete key ', key)
            pipelineDeleteTree.del(key)
        }
        await pipelineDeleteTree.exec();

        const result = await sharedIoRedis.getFullInfo({
            redis: redis,
        })

        socket.emit(options.responseEvent, {
            status: 'ok',
            info: result.info,
            keys: result.keys,
            keysInfo: result.keysInfo
        })
    } catch(e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e,
        })
    }


}