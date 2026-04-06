import { Server } from 'socket.io'
import { resolveConfiguredHttpAuth, verifyAuthToken } from '../../lib/http-auth.mjs'
import socketHandler from './socket.mjs'

const socketIoService = function () {

    const self = this;

    self.boot = async (options) => {
        const httpService = options.httpService
        const socketio = new Server(httpService.server, {
            secure: true,
            path: '/socket.io',
            maxHttpBufferSize: 256 * 1024 * 1024, // 256 MB
        });

        socketio.use((socket, next) => {
            const httpAuth = resolveConfiguredHttpAuth()
            if (!httpAuth.enabled) {
                next()
                return
            }
            const token = socket.handshake.auth?.token
            if (token && verifyAuthToken(token)) {
                next()
                return
            }
            const error = new Error('auth_required')
            next(error)
        })

        socketHandler(socketio);
        this.socketio = socketio
    }
}

export default socketIoService
