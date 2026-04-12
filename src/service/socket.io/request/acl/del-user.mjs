import { ensureReadonlyConnection } from '../../shared.mjs'

export default async (options) => {
    const { socket, payload } = options
    try {
        ensureReadonlyConnection({ socket })
        const redis = socket.p3xrs.ioredis
        if (!redis) {
            socket.emit(options.responseEvent, { status: 'error', error: 'Not connected to Redis' })
            return
        }
        if (!payload.username) {
            socket.emit(options.responseEvent, { status: 'error', error: 'Username is required' })
            return
        }
        if (payload.username === 'default') {
            socket.emit(options.responseEvent, { status: 'error', error: 'Cannot delete the default user' })
            return
        }
        const whoami = await redis.call('ACL', 'WHOAMI')
        if (payload.username === whoami) {
            socket.emit(options.responseEvent, { status: 'error', error: 'Cannot delete the currently connected user' })
            return
        }
        // Use cluster-aware method if available, otherwise direct call
        if (typeof redis.aclDeluser === 'function') {
            await redis.aclDeluser(payload.username)
        } else {
            await redis.call('ACL', 'DELUSER', payload.username)
        }
        socket.emit(options.responseEvent, { status: 'ok' })
    } catch (e) {
        console.error('acl/del-user failed', e)
        socket.emit(options.responseEvent, { status: 'error', error: e.message })
    }
}
