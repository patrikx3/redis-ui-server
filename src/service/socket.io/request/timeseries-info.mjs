const consolePrefix = 'socket.io timeseries info'

export default async (options) => {
    const {socket, payload} = options;

    try {
        const redis = socket.p3xrs.ioredis
        const key = payload.key

        console.info(consolePrefix, key)

        const raw = await redis.call('TS.INFO', key)

        // TS.INFO returns flat array: [field, value, field, value, ...]
        const info = {}
        for (let i = 0; i < raw.length; i += 2) {
            const field = raw[i]
            let value = raw[i + 1]
            // Parse nested label pairs [[key, value], ...]
            if (field === 'labels' && Array.isArray(value)) {
                const labels = {}
                for (const pair of value) {
                    if (Array.isArray(pair) && pair.length === 2) {
                        labels[pair[0]] = pair[1]
                    }
                }
                value = labels
            }
            // Parse rules [[destKey, bucketDuration, aggregationType], ...]
            if (field === 'rules' && Array.isArray(value)) {
                value = value.map(rule => {
                    if (Array.isArray(rule)) {
                        return {
                            destKey: rule[0],
                            bucketDuration: rule[1],
                            aggregationType: rule[2],
                        }
                    }
                    return rule
                })
            }
            info[field] = value
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            data: info,
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
