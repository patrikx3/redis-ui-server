const socketIo = require('socket.io')

const socketIoService = function() {

    const self = this;

    self.boot = async (options) => {
        const { koaService } = options
        const socketio = require('socket.io')(koaService.server, {
            secure: true,
            path: '/socket.io',
        });

        require('./socket')(socketio);
    }
}

module.exports = socketIoService

