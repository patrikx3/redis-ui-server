import 'corifeus-utils'
import cli from './cli.mjs'
import consoleStamp from './console-stamp.mjs'
import httpService from '../service/http/index.mjs'
import checkLicense from './check-license.mjs'
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

    // All features are free — always enterprise
    p3xrs.cfg.donated = true
    // Resolve effective tier before socket request handling starts.
    await checkLicense({
        payload: {},
        save: true
    })

    p3xrs.socketIo = new socketIoService();
    await p3xrs.socketIo.boot({
        httpService: p3xrs.http
    })

    checkLicense({
        socket: p3xrs.socketIo.socketio,
        payload: {},
        save: true
    })

    setInterval(() => {
        checkLicense({
            socket: p3xrs.socketIo.socketio,
            payload: {},
            save: true
        })
    }, 1000 * 60 * 60)

    p3xrs.redisConnections = {}
    p3xrs.redisConnectionsSubscriber = {}

    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
    });

}

export default boot
