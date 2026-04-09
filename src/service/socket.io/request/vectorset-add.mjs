import * as sharedIoRedis from '../shared.mjs'

const consolePrefix = 'socket.io vectorset add'

export default async (options) => {
    const {socket, payload} = options;

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const redis = socket.p3xrs.ioredis
        const { key, element, values, attributes } = payload

        const dim = values.length
        const args = [key, 'VALUES', dim, ...values.map(Number), element]

        // Optional attributes: "key\nvalue\nkey\nvalue"
        if (attributes && typeof attributes === 'string' && attributes.trim()) {
            args.push('SETATTR', attributes.trim())
        }

        const result = await redis.call('VADD', ...args)

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
