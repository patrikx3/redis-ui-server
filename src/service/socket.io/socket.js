const socketIoShared = require('./shared')
module.exports = (io) => {

    io.on('connect', function (socket) {

        //const token = socket.handshake.query.token;
        socket.p3xrs = {
            address: socket.handshake.headers.origin,
            connectedAt: new Date(),
            connectionId: undefined,
            io: io,
            ioredis: undefined,
           // commands: undefined,
        }

        console.info('socket.io connected %s', socket.id);

        socket.on('disconnect', function () {
            console.warn('socket.p3xrs.connectionId', socket.p3xrs.connectionId)
            if (socket.p3xrs.connectionId !== undefined) {
                const connectionId = socket.p3xrs.connectionId;
                if (p3xrs.redisConnections.hasOwnProperty(connectionId)) {
                    const redisConnectionIndex = p3xrs.redisConnections[connectionId].clients.indexOf(socket.id);
                    if (redisConnectionIndex !== -1) {
                        p3xrs.redisConnections[connectionId].clients.splice(redisConnectionIndex, 1);
                    }
                    if (p3xrs.redisConnections[connectionId].clients.length === 0) {
                        delete p3xrs.redisConnections[connectionId]
                    }
                    socketIoShared.disconnectRedisIo({
                        socket: socket,
                    })
                }
            }

            // Call on disconnect.
            console.info('socket.io disconnected %s', socket.id);
            socketIoShared.sendStatus({
                socket: socket,
            })
        });

        socket.on('p3xr-request', (options) => {
            options.socket = socket;
            options.responseEvent = `p3xr-response-${options.requestId}`
            require(`./request/${options.action}`)(options)
        })


        socket.emit('configuration', {
            readonlyConnections: p3xrs.cfg.readonlyConnections === true
        })

        socketIoShared.sendStatus({
            socket: socket,
        })
        socketIoShared.sendConnections({
            socket: socket,
        })

    });

}