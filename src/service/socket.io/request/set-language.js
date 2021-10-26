module.exports = async (options) => {
    const { socket, payload } = options;

    try {

        if (global.p3xre) {
            global.p3xre.setLanguage({
                key: payload.key
            })
        }
        socket.emit(options.responseEvent, {
            status: 'ok',
            key: payload.key,
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message
        })

    }

}
