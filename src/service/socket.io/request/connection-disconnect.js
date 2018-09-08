const sharedIoRedis = require('../shared')

const consolePrefix = 'socket.io connection disconnect'

module.exports = async(options) => {
    const {socket, payload} = options;
    const { connectionId } = payload;

    console.warn(consolePrefix, 'connectionId', connectionId, 'socket.p3xrs.connectionId', socket.p3xrs.connectionId)
    try {
        if (socket.p3xrs.connectionId === connectionId) {
            console.warn(consolePrefix, 'will disconnect from redis')
            sharedIoRedis.disconnectRedis({
                socket: socket,
            })
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
        })
    } catch(e) {
        socket.emit(options.responseEvent, {
            status: 'error',
            error: error
        })

    } finally {
        sharedIoRedis.sendStatus({
            socket: socket,
        })
    }

}