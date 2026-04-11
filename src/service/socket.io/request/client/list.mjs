export default async (options) => {
    const {socket} = options

    try {
        const redis = socket.p3xrs.ioredis
        const raw = await redis.client('LIST')

        // Parse CLIENT LIST output (each line is a client, fields separated by spaces, key=value)
        const clients = []
        for (const line of raw.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed) continue
            const client = {}
            for (const pair of trimmed.split(' ')) {
                const eqIdx = pair.indexOf('=')
                if (eqIdx > 0) {
                    client[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1)
                }
            }
            if (client.id) {
                clients.push({
                    id: client.id,
                    addr: client.addr || '',
                    name: client.name || '',
                    age: parseInt(client.age) || 0,
                    idle: parseInt(client.idle) || 0,
                    db: parseInt(client.db) || 0,
                    cmd: client.cmd || '',
                    flags: client.flags || '',
                    sub: parseInt(client.sub) || 0,
                    psub: parseInt(client.psub) || 0,
                    multi: parseInt(client.multi) || -1,
                    omem: parseInt(client.omem) || 0,
                })
            }
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            data: clients,
        })

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
