import * as sharedIoRedis from '../../shared.mjs'

//const consolePrefix = 'socket.io refresh redis'

export default async (options) => {
    const {socket, payload} = options;

    const redis = socket.p3xrs?.ioredis

    try {
        if (!redis) {
            throw new Error('not_connected')
        }

        await sharedIoRedis.getFullInfoAndSendSocket({
            redis: redis,
            responseEvent: options.responseEvent,
            socket: socket,
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
