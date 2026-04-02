import * as socketIoShared from './shared.mjs'
import fs from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const originalPkg = JSON.parse(fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'))
let pkg = originalPkg

try {
    const parentPkgPath = path.resolve(__dirname, '../../../../../package.json')
    if (fs.existsSync(parentPkgPath)) {
        pkg = JSON.parse(fs.readFileSync(parentPkgPath, 'utf8'))
        if (pkg.name !== 'p3x-redis-ui') {
            console.warn('cannot find p3x-redis-ui version, but it is not required, found', pkg.name)
            pkg = originalPkg
        }
    }
} catch(e) {
    console.warn('cannot find p3x-redis-ui version, but it is not required', e)
}
export default (io) => {

    io.on('connect', function (socket) {

        //const token = socket.handshake.query.token;
        socket.p3xrs = {
            address: socket.handshake.headers.origin,
            connectedAt: new Date(),
            connectionId: undefined,
            io: io,
            ioredis: undefined,
            ioredisSubscriber: undefined,
            tunnels: [],
            sshClient: undefined,
            readonly: undefined,
            // commands: undefined,
            subsciber: false,
        }

        console.info(`socket.io connected ${socket.id}`);

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

            // Stop MONITOR if active
            if (socket.p3xrs.ioredisMonitor) {
                try { socket.p3xrs.ioredisMonitor.disconnect() } catch {}
                socket.p3xrs.ioredisMonitor = undefined
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
                import(`./request/${options.action}.mjs`).then(mod => mod.default(options)).catch(err => {
                    console.error('failed to load request handler', options.action, err)
                    socket.emit(options.responseEvent, {
                        status: 'error',
                        error: err.message,
                    })
                })
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
            version: pkg.version,
            groqApiKey: p3xrs.cfg.groqApiKey || '',
            groqApiKeyReadonly: p3xrs.cfg.groqApiKeyReadonly === true,
            aiEnabled: p3xrs.cfg.aiEnabled !== false,
            aiUseOwnKey: p3xrs.cfg.aiUseOwnKey === true,
        })

        socketIoShared.sendStatus({
            socket: socket,
        })
        socketIoShared.sendConnections({
            socket: socket,
        })


    });

}
