import * as sharedIoRedis from '../../shared.mjs'

const consolePrefix = 'socket.io timeseries alter'

export default async (options) => {
    const {socket, payload} = options;

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const redis = socket.p3xrs.ioredis
        const key = payload.key
        const args = [key]

        if (payload.retention !== undefined) {
            args.push('RETENTION', parseInt(payload.retention))
        }

        if (payload.duplicatePolicy) {
            args.push('DUPLICATE_POLICY', payload.duplicatePolicy)
        }

        if (payload.labels !== undefined) {
            args.push('LABELS')
            if (payload.labels && payload.labels.trim().length > 0) {
                args.push(...payload.labels.trim().split(/\s+/))
            }
        }

        console.info(consolePrefix, args)
        await redis.call('TS.ALTER', ...args)

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
