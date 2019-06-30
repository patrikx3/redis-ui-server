const sharedIoRedis = require('../shared')

const consolePrefix = 'socket.io trigger redis disconnect'

module.exports = async (options) => {
    const {socket} = options;


    try {
        console.warn(consolePrefix, 'socket.p3xrs.connectionId', socket.p3xrs.connectionId)
        sharedIoRedis.disconnectRedis({
            socket: socket,
        })

        socket.emit(options.responseEvent, {
            status: 'ok',
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: error
        })

    }

}
