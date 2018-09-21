const consolePrefix = 'socket.io key new'
const sharedIoRedis = require('../shared')
module.exports = async(options) => {
    const {socket,payload } = options;

    const redis = socket.p3xrs.ioredis

    try {
        const  { model } = payload;

        model.score = model.score === null ? undefined : model.score
        model.index = model.index === null ? undefined : model.index
        model.hashKey = model.hashKey === null ? undefined : model.hashKey
console.warn(consolePrefix, model)
        switch(model.type) {
            case 'string':
                await redis.set(model.key, model.value)
                break;

            case 'list':

                break;

            case 'hash':
                break;

            case 'set':
                break;

            case 'zset':
                break;


        }

        await sharedIoRedis.getFullInfoAndSendSocket({
            redis: redis,
            responseEvent: options.responseEvent,
            socket: socket,
            extend: {
                key: model.key
            }
        })
    } catch(e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e
        })

    }

}