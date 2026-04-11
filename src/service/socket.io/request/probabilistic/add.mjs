import * as sharedIoRedis from '../../shared.mjs'

const consolePrefix = 'socket.io probabilistic add'

export default async (options) => {
    const {socket, payload} = options;

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const redis = socket.p3xrs.ioredis
        const { key, type, item, increment } = payload

        console.info(consolePrefix, type, key, item)

        let result
        switch (type) {
            case 'bloom':
                result = await redis.call('BF.ADD', key, item)
                break;
            case 'cuckoo':
                result = await redis.call('CF.ADD', key, item)
                break;
            case 'topk':
                result = await redis.call('TOPK.ADD', key, item)
                break;
            case 'cms':
                result = await redis.call('CMS.INCRBY', key, item, parseInt(increment) || 1)
                break;
            case 'tdigest':
                result = await redis.call('TDIGEST.ADD', key, parseFloat(item))
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
