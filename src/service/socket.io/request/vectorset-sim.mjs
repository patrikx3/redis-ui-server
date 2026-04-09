const consolePrefix = 'socket.io vectorset sim'

export default async (options) => {
    const {socket, payload} = options;

    try {
        const redis = socket.p3xrs.ioredis
        const { key, mode, element, values, count, filter } = payload
        const n = parseInt(count) || 10

        let raw
        if (mode === 'element') {
            const args = ['VSIM', key, 'ELE', element, 'COUNT', n, 'WITHSCORES']
            if (filter) args.push('FILTER', filter)
            raw = await redis.call(...args)
        } else {
            // mode === 'vector'
            const dim = values.length
            const args = ['VSIM', key, 'VALUES', dim, ...values.map(Number), 'COUNT', n, 'WITHSCORES']
            if (filter) args.push('FILTER', filter)
            raw = await redis.call(...args)
        }

        const results = []
        for (let i = 0; i < raw.length; i += 2) {
            results.push({ element: raw[i], score: parseFloat(raw[i + 1]) || 0 })
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            results: results,
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
