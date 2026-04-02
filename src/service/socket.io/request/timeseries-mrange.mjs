const consolePrefix = 'socket.io timeseries mrange'

export default async (options) => {
    const {socket, payload} = options;

    try {
        const redis = socket.p3xrs.ioredis
        const from = payload.from || '-'
        const to = payload.to || '+'
        const filter = payload.filter

        if (!filter) {
            socket.emit(options.responseEvent, {
                status: 'ok',
                data: [],
            })
            return
        }

        const args = [from, to, 'FILTER', filter]

        if (payload.aggregation && payload.aggregation.type && payload.aggregation.timeBucket) {
            args.push('AGGREGATION', payload.aggregation.type, payload.aggregation.timeBucket)
        }

        if (payload.count) {
            args.push('COUNT', payload.count)
        }

        console.info(consolePrefix, args)

        const raw = await redis.call('TS.MRANGE', ...args)

        // raw is [[key, labels, [[ts, val], ...]], ...]
        const data = raw.map(entry => {
            const key = entry[0]
            const labels = {}
            if (Array.isArray(entry[1])) {
                for (const pair of entry[1]) {
                    if (Array.isArray(pair) && pair.length === 2) {
                        labels[pair[0]] = pair[1]
                    }
                }
            }
            const points = (entry[2] || []).map(point => ({
                timestamp: typeof point[0] === 'number' ? point[0] : parseInt(point[0]),
                value: typeof point[1] === 'number' ? point[1] : parseFloat(point[1]),
            }))
            return { key, labels, data: points }
        })

        socket.emit(options.responseEvent, {
            status: 'ok',
            data: data,
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
