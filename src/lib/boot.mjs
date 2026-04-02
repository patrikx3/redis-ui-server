import 'corifeus-utils'
import cli from './cli.mjs'
import consoleStamp from './console-stamp.mjs'
import httpService from '../service/http/index.mjs'
import socketIoService from '../service/socket.io/index.mjs'

const boot = async () => {

    global.p3xrs = {}

    p3xrs.cfg = undefined

    if (!(await cli())) {
        return;
    }

    consoleStamp()

    p3xrs.http = new httpService()
    await p3xrs.http.boot()

    p3xrs.socketIo = new socketIoService();
    await p3xrs.socketIo.boot({
        httpService: p3xrs.http
    })

    p3xrs.redisConnections = {}
    p3xrs.redisConnectionsSubscriber = {}

    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
    });

    const gracefulShutdown = async (signal) => {
        console.info(`Received ${signal}, shutting down gracefully...`)
        try {
            // Close Socket.IO connections
            if (p3xrs.socketIo?.socketio) {
                p3xrs.socketIo.socketio.close()
            }
            // Close all Redis connections
            if (p3xrs.redisConnections) {
                for (const key of Object.keys(p3xrs.redisConnections)) {
                    try {
                        if (p3xrs.redisConnections[key]?.ioredis) {
                            p3xrs.redisConnections[key].ioredis.disconnect()
                        }
                    } catch {}
                }
            }
            // Close HTTP server
            if (p3xrs.http?.server) {
                p3xrs.http.server.close()
            }
        } catch (e) {
            console.error('Error during shutdown:', e)
        }
        process.exit(0)
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))

}

export default boot
