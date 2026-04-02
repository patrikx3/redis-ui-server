export default async (options) => {
    const { socket, payload } = options;

    try {
        if (!socket.p3xrs.ioredis) {
            socket.emit(options.responseEvent, { status: 'error', error: 'Not connected to Redis' })
            return
        }
        if (payload.enabled) {
            // Start MONITOR - need a dedicated connection since MONITOR blocks
            if (!socket.p3xrs.ioredisMonitor) {
                const redis = socket.p3xrs.ioredis

                // retry up to 3 times - redis.monitor() can fail with
                // "Command queue state error" if other commands are in flight
                let monitor
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        monitor = await redis.monitor()
                        break
                    } catch (e) {
                        if (attempt === 2) throw e
                        await new Promise(r => setTimeout(r, 200))
                    }
                }

                socket.p3xrs.ioredisMonitor = monitor

                socket.p3xrs.ioredisMonitor.on('monitor', (time, args, source, database) => {
                    socket.emit('monitor-data', {
                        time: time,
                        args: args,
                        source: source,
                        database: database,
                    })
                })

                console.info('MONITOR started for', socket.id)
            }
        } else {
            // Stop MONITOR
            if (socket.p3xrs.ioredisMonitor) {
                socket.p3xrs.ioredisMonitor.disconnect()
                socket.p3xrs.ioredisMonitor = undefined
                console.info('MONITOR stopped for', socket.id)
            }
        }

        socket.emit(options.responseEvent, { status: 'ok' })
    } catch (e) {
        console.error('Monitor error:', e)
        socket.emit(options.responseEvent, { status: 'error', error: e.message })
    }
}
