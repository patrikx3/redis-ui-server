const consolePrefix = 'socket.io key list delete index'

const utils = require('corifeus-utils')

module.exports = async(options) => {
    const {socket, payload } = options;

    const redis = socket.p3xrs.ioredis

    try {
        const  { hashKey, key } = payload;

        await redis.hdel(key, hashKey)

        socket.emit(options.responseEvent, {
            status: 'ok',
        })

    } catch(e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e
        })

    }

}