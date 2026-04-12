export default async (options) => {
    const { socket, payload } = options;

    try {
        if (!socket.p3xrs.ioredis) {
            socket.emit(options.responseEvent, { status: 'error', error: 'Not connected to Redis' })
            return
        }
        if (payload.enabled) {
            // Start MONITOR - need dedicated connections since MONITOR blocks
            if (!socket.p3xrs.ioredisMonitor) {
                const redis = socket.p3xrs.ioredis
                const isCluster = typeof redis.nodes === 'function'

                const monitors = []
                const onMonitor = (time, args, source, database) => {
                    socket.emit('monitor-data', {
                        time: time,
                        args: args,
                        source: source,
                        database: database,
                    })
                }

                if (isCluster) {
                    // In cluster mode, monitor each master node
                    const masterNodes = redis.nodes('master')
                    for (const node of masterNodes) {
                        for (let attempt = 0; attempt < 3; attempt++) {
                            try {
                                const monitor = await node.monitor()
                                monitor.on('monitor', onMonitor)
                                monitors.push(monitor)
                                break
                            } catch (e) {
                                if (attempt === 2) {
                                    console.warn('MONITOR failed for cluster node, skipping:', e.message)
                                } else {
                                    await new Promise(r => setTimeout(r, 200))
                                }
                            }
                        }
                    }
                    if (monitors.length === 0) {
                        throw new Error('Failed to start MONITOR on any cluster node')
                    }
                } else {
                    // Standalone / sentinel
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
                    monitor.on('monitor', onMonitor)
                    monitors.push(monitor)
                }

                socket.p3xrs.ioredisMonitor = monitors
                console.info('MONITOR started for', socket.id, isCluster ? `(${monitors.length} cluster nodes)` : '(standalone)')
            }
        } else {
            // Stop MONITOR
            if (socket.p3xrs.ioredisMonitor) {
                for (const monitor of socket.p3xrs.ioredisMonitor) {
                    monitor.disconnect()
                }
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
