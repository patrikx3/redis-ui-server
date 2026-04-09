const consolePrefix = 'socket.io vectorset sim'

export default async (options) => {
    const {socket, payload} = options;

    try {
        const redis = socket.p3xrs.ioredis
        const { key, mode, element, values, count } = payload
        const n = parseInt(count) || 10

        let raw
        if (mode === 'element') {
            raw = await redis.call('VSIM', key, 'ELE', element, 'COUNT', n, 'WITHSCORES')
        } else {
            // mode === 'vector'
            const dim = values.length
            raw = await redis.call('VSIM', key, 'VALUES', dim, ...values.map(Number), 'COUNT', n, 'WITHSCORES')
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
