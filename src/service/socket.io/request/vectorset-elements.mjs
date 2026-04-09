const consolePrefix = 'socket.io vectorset elements'

export default async (options) => {
    const {socket, payload} = options;

    try {
        const redis = socket.p3xrs.ioredis
        const { key } = payload

        const dim = parseInt(await redis.call('VDIM', key)) || 3
        const count = parseInt(await redis.call('VCARD', key)) || 100

        // Use VSIM with zero vector to list all elements
        const zeroVec = new Array(dim).fill(0)
        const raw = await redis.call('VSIM', key, 'VALUES', dim, ...zeroVec, 'COUNT', count, 'WITHSCORES')

        // Parse flat array [element, score, element, score, ...]
        const elements = []
        for (let i = 0; i < raw.length; i += 2) {
            elements.push({ element: raw[i], score: parseFloat(raw[i + 1]) || 0 })
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            elements: elements,
            dim: dim,
            count: count,
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
