const consolePrefix = 'socket.io key get string buffer'


module.exports = async (options) => {
    const {socket, payload} = options;

    try {
        let redis = socket.p3xrs.ioredis

        const key = payload.key;


        const buffer = await redis.getBuffer(key)

        const socketResult = {
            key: key,
            status: 'ok',
            bufferValue: buffer,
        };
        // console.warn('socketResult', socketResult)
        socket.emit(options.responseEvent, socketResult)
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }


}
