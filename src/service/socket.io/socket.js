const socketIoShared = require('./shared')
const originalPkg = require('../../../package.json')
let pkg = originalPkg

try {
   pkg = require('../../../../../package.json')
    if (pkg.name !== 'p3x-redis-ui') {
        console.warn('cannot find p3x-redis-ui version, but it is not required, found', pkg.name)
        pkg = originalPkg
    }
} catch(e) {
    console.warn('cannot find p3x-redis-ui version, but it is not required', e)
}
module.exports = (io) => {

    io.on('connect', function (socket) {

        //const token = socket.handshake.query.token;
        socket.p3xrs = {
            address: socket.handshake.headers.origin,
            connectedAt: new Date(),
            connectionId: undefined,
            io: io,
            ioredis: undefined,
            ioredisSubscriber: undefined,
            tunnel: undefined,
            tunnelClient: undefined,
            readonly: undefined,
            // commands: undefined,
            subsciber: false,
        }

        console.info(`socket.io connected ${socket.id}`);

        socket.emit('info-interval', {
            status: 'ok',
            donated: p3xrs.cfg.donated,
        })

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
            socketIoShared.disconnectRedis({
                socket: socket,
            })
        });

        socket.on('p3xr-request', (options) => {
            options.socket = socket;
            options.responseEvent = `p3xr-response-${options.requestId}`
            if (options && options.action && typeof options.action === 'string' && !options.action.includes('.')  && !options.action.includes('\\') && !options.action.includes('/')) {
                require(`./request/${options.action}`)(options)
            } else {
                console.warn('trying bad action socket.on p3xr-request with options', options)
            }
        })


        let dividers = [
            ":",
            "/",
            "|",
            "-",
            "@"
        ]
        if (p3xrs.cfg.hasOwnProperty('treeDividers') && Array.isArray(p3xrs.cfg.treeDividers)) {
            dividers = p3xrs.cfg.treeDividers
        }
        socket.emit('configuration', {
            readonlyConnections: p3xrs.cfg.readonlyConnections === true,
            snapshot: pkg.name !== 'p3x-redis-ui',
            treeDividers: dividers,
            version: pkg.version
        })

        socketIoShared.sendStatus({
            socket: socket,
        })
        socketIoShared.sendConnections({
            socket: socket,
        })


    });

}
