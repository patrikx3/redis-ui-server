import * as sharedIoRedis from '../../shared.mjs'

const consolePrefix = 'socket.io probabilistic delete'

export default async (options) => {
    const {socket, payload} = options;

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const redis = socket.p3xrs.ioredis
        const { key, type, item } = payload

        console.info(consolePrefix, type, key, item)

        switch (type) {
            case 'cuckoo':
                await redis.call('CF.DEL', key, item)
                break;
            case 'tdigest':
                await redis.call('TDIGEST.RESET', key)
                break;
            default:
                throw new Error('unsupported-probabilistic-delete')
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
