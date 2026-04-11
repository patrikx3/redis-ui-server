const consolePrefix = 'socket.io timeseries range'

export default async (options) => {
    const {socket, payload} = options;

    try {
        const redis = socket.p3xrs.ioredis
        const key = payload.key
        const from = payload.from || '-'
        const to = payload.to || '+'

        const args = [key, from, to]

        // Optional aggregation: { type: 'avg'|'min'|'max'|'sum'|'count'|..., timeBucket: 5000 }
        if (payload.aggregation && payload.aggregation.type && payload.aggregation.timeBucket) {
            args.push('AGGREGATION', payload.aggregation.type, payload.aggregation.timeBucket)
        }

        // Optional count limit
        if (payload.count) {
            args.push('COUNT', payload.count)
        }

        console.info(consolePrefix, args)

        const raw = await redis.call('TS.RANGE', ...args)

        // raw is [[timestamp, value], [timestamp, value], ...]
        const data = raw.map(entry => ({
            timestamp: typeof entry[0] === 'number' ? entry[0] : parseInt(entry[0]),
            value: typeof entry[1] === 'number' ? entry[1] : parseFloat(entry[1]),
        }))

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
