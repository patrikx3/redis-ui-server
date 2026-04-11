export default async (options) => {
    const {socket, payload} = options

    try {
        const redis = socket.p3xrs.ioredis
        const maxKeys = payload.maxKeys || 100
        const topN = payload.topN || 20

        // Scan keys
        let cursor = '0'
        const keys = []
        do {
            const [nextCursor, batch] = await redis.scan(cursor, 'COUNT', 200)
            cursor = nextCursor
            keys.push(...batch)
            if (keys.length >= maxKeys) break
        } while (cursor !== '0')

        // Get memory usage for each key in pipeline batches
        const BATCH = 500
        const results = []
        for (let i = 0; i < keys.length; i += BATCH) {
            const batch = keys.slice(i, i + BATCH)
            const pipeline = redis.pipeline()
            for (const key of batch) {
                pipeline.call('MEMORY', 'USAGE', key)
            }
            const pipeResults = await pipeline.exec()
            for (let j = 0; j < batch.length; j++) {
                const err = pipeResults[j][0]
                const bytes = pipeResults[j][1]
                if (!err && typeof bytes === 'number') {
                    results.push({ key: batch[j], bytes })
                }
            }
        }

        // Sort by size descending and take top N
        results.sort((a, b) => b.bytes - a.bytes)
        const topKeys = results.slice(0, topN)

        socket.emit(options.responseEvent, {
            status: 'ok',
            data: topKeys,
        })

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
