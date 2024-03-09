const socketIo = require('socket.io')

const socketIoService = function () {

    const self = this;

    self.boot = async (options) => {
        const {koaService} = options
        const socketio = require('socket.io')(koaService.server, {
            secure: true,
            path: '/socket.io',
            maxHttpBufferSize: 256 * 1024 * 1024, // 256 MB
        });

        require('./socket')(socketio);
        this.socketio = socketio
    }
}

module.exports = socketIoService

