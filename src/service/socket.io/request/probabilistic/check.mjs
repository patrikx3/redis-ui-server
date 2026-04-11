const consolePrefix = 'socket.io probabilistic check'

export default async (options) => {
    const {socket, payload} = options;

    try {
        const redis = socket.p3xrs.ioredis
        const { key, type, item, quantile } = payload

        console.info(consolePrefix, type, key, item || quantile)

        let result
        switch (type) {
            case 'bloom':
                result = await redis.call('BF.EXISTS', key, item)
                break;
            case 'cuckoo':
                result = await redis.call('CF.EXISTS', key, item)
                break;
            case 'topk': {
                const raw = await redis.call('TOPK.LIST', key, 'WITHCOUNT')
                // Returns flat array [item, count, item, count, ...]
                const items = []
                for (let i = 0; i < raw.length; i += 2) {
                    items.push({ item: raw[i], count: parseInt(raw[i + 1]) || 0 })
                }
                result = items
                break;
            }
            case 'cms':
                result = await redis.call('CMS.QUERY', key, item)
                break;
            case 'tdigest':
                result = await redis.call('TDIGEST.QUANTILE', key, parseFloat(quantile))
                break;
            default:
                throw new Error('unsupported-probabilistic-type')
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            result: result,
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
