import * as sharedIoRedis from '../shared.mjs'

export default async (options) => {
    const {socket, payload} = options

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const redis = socket.p3xrs.ioredis
        const { name, prefix, schema } = payload

        if (!name || !schema || !Array.isArray(schema) || schema.length === 0) {
            socket.emit(options.responseEvent, {
                status: 'error',
                error: 'Index name and schema are required',
            })
            return
        }

        // Build FT.CREATE command
        const args = [name, 'ON', 'HASH']
        if (prefix) {
            args.push('PREFIX', '1', prefix)
        }
        args.push('SCHEMA')
        for (const field of schema) {
            args.push(field.name, field.type)
            if (field.sortable) args.push('SORTABLE')
            if (field.noindex) args.push('NOINDEX')
        }

        await redis.call('FT.CREATE', ...args)

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
