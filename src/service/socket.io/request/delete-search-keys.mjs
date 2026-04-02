import * as sharedIoRedis from '../shared.mjs'

const consolePrefix = 'socket.io delete search keys'

export default async (options) => {
    const {socket, payload} = options;

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        let redis = socket.p3xrs.ioredis

        console.info(consolePrefix, payload.match)

        if (!payload.match || payload.match === '*') {
            // No search filter: use flushdb for efficiency
            const dbsize = await redis.dbsize()
            console.info(consolePrefix, 'flushdb, dbsize was', dbsize)
            await redis.flushdb()
            socket.emit(options.responseEvent, {
                status: 'ok',
                deletedCount: dbsize,
            })
        } else {
            const keys = await sharedIoRedis.getStreamKeys({
                redis: redis,
                match: payload.match,
                maxKeys: payload.maxKeys,
            })

            if (keys.length === 0) {
                socket.emit(options.responseEvent, {
                    status: 'ok',
                    deletedCount: 0,
                })
                return
            }

            const pipeline = redis.pipeline()
            for (let key of keys) {
                console.info(consolePrefix, 'delete key', key)
                pipeline.del(key)
            }
            await pipeline.exec()

            socket.emit(options.responseEvent, {
                status: 'ok',
                deletedCount: keys.length,
            })
        }

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
