export default async (options) => {
    const { socket } = options
    try {
        const redis = socket.p3xrs.ioredis
        if (!redis) {
            socket.emit(options.responseEvent, { status: 'error', error: 'Not connected to Redis' })
            return
        }
        const [users, whoami] = await Promise.all([
            redis.call('ACL', 'LIST'),
            redis.call('ACL', 'WHOAMI'),
        ])
        const parsed = users.map(line => {
            const parts = line.split(' ')
            const name = parts[1]
            return {
                name,
                raw: line,
                enabled: line.includes(' on '),
                allKeys: line.includes(' ~* ') || line.includes(' allkeys'),
                allCommands: line.includes(' +@all') || line.includes(' allcommands'),
            }
        })
        socket.emit(options.responseEvent, { status: 'ok', data: { users: parsed, currentUser: whoami } })
    } catch (e) {
        console.error('acl/list failed', e)
        socket.emit(options.responseEvent, { status: 'error', error: e.message })
    }
}
