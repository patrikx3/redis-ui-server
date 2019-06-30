const consolePrefix = 'socket.io key list delete index'

const utils = require('corifeus-utils')

module.exports = async (options) => {
    const {socket, payload} = options;

    const redis = socket.p3xrs.ioredis

    try {
        const {index, key} = payload;

        const uniqueValue = utils.random.complexUuid()
        console.log(consolePrefix, key, index, uniqueValue)

        await redis.lset(key, index, uniqueValue)
        await redis.lrem(key, 1, uniqueValue)

        socket.emit(options.responseEvent, {
            status: 'ok',
        })

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e
        })

    }

}
