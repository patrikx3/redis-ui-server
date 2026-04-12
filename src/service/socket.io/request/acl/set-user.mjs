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
        if (!payload.username || !payload.rules) {
            socket.emit(options.responseEvent, { status: 'error', error: 'Username and rules are required' })
            return
        }
        if (!Array.isArray(payload.rules) || !payload.rules.every(r => typeof r === 'string' && r.length > 0)) {
            socket.emit(options.responseEvent, { status: 'error', error: 'Rules must be an array of non-empty strings' })
            return
        }
        // Use cluster-aware method if available, otherwise direct call
        if (typeof redis.aclSetuser === 'function') {
            await redis.aclSetuser(payload.username, ...payload.rules)
        } else {
            await redis.call('ACL', 'SETUSER', payload.username, ...payload.rules)
        }
        socket.emit(options.responseEvent, { status: 'ok' })
    } catch (e) {
        console.error('acl/set-user failed', e)
        socket.emit(options.responseEvent, { status: 'error', error: e.message })
    }
}
