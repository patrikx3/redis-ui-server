/**
 * FT.HYBRID — hybrid search combining text + vector similarity (Redis 8.4+)
 * Requires a RediSearch index with a VECTOR field.
 */
export default async (options) => {
    const { socket, payload } = options

    try {
        const redis = socket.p3xrs.ioredis
        const { index, query, vectorField, vectorValues, count = 10, offset = 0, limit = 20 } = payload

        if (!index || !query || !vectorField || !vectorValues) {
            socket.emit(options.responseEvent, {
                status: 'error',
                error: 'Index, query, vectorField, and vectorValues are required',
            })
            return
        }

        const vecBlob = Buffer.from(new Float32Array(vectorValues.map(Number)).buffer)
        const args = [
            index, query,
            'LIMIT', offset, limit,
            'VECTOR', vectorField, count, vecBlob,
        ]

        const result = await redis.call('FT.HYBRID', ...args)

        // Parse like FT.SEARCH: [totalCount, key1, [field, value, ...], ...]
        const total = result[0]
        const docs = []
        for (let i = 1; i < result.length; i += 2) {
            const key = result[i]
            const fields = result[i + 1]
            const doc = { _key: key }
            if (Array.isArray(fields)) {
                for (let j = 0; j < fields.length; j += 2) {
                    doc[fields[j]] = fields[j + 1]
                }
            }
            docs.push(doc)
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            data: { total, docs },
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
