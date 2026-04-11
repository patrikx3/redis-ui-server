export default async (options) => {
    const {socket, payload} = options

    try {
        const redis = socket.p3xrs.ioredis
        const { index, query, offset, limit } = payload

        if (!index || !query) {
            socket.emit(options.responseEvent, {
                status: 'error',
                error: 'Index and query are required',
            })
            return
        }

        const args = [index, query, 'LIMIT', offset || 0, limit || 20]
        const result = await redis.call('FT.SEARCH', ...args)

        // Parse FT.SEARCH result: [totalCount, key1, [field, value, ...], key2, [...], ...]
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
