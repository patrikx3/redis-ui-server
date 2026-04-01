import * as sharedIoRedis from '../shared.mjs'

export default async (options) => {
    const {socket, payload} = options

    try {
        const redis = socket.p3xrs.ioredis
        const keys = payload.keys

        if (!Array.isArray(keys) || keys.length === 0) {
            socket.emit(options.responseEvent, {
                status: 'error',
                error: 'No keys specified for export',
            })
            return
        }

        // Get types for all keys
        const typePipeline = redis.pipeline()
        for (const key of keys) {
            typePipeline.type(key)
        }
        const typeResults = await typePipeline.exec()

        // Get TTLs for all keys
        const ttlPipeline = redis.pipeline()
        for (const key of keys) {
            ttlPipeline.pttl(key)
        }
        const ttlResults = await ttlPipeline.exec()

        // Read values based on type
        const exportedKeys = []
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            let type = typeResults[i][1]
            const pttl = ttlResults[i][1]

            // Normalize ReJSON-RL
            if (type === 'ReJSON-RL') {
                type = 'json'
            }

            if (type === 'none') {
                continue
            }

            let value
            try {
                switch (type) {
                    case 'string': {
                        const buf = await redis.getBuffer(key)
                        value = buf ? buf.toString('base64') : null
                        break
                    }
                    case 'list': {
                        const items = await redis.lrangeBuffer(key, 0, -1)
                        value = items.map(item => item.toString('base64'))
                        break
                    }
                    case 'set': {
                        const members = await redis.smembersBuffer(key)
                        value = members.map(m => m.toString('base64'))
                        break
                    }
                    case 'zset': {
                        // Returns [member, score, member, score, ...]
                        const raw = await redis.zrangebyscoreBuffer(key, '-inf', '+inf', 'WITHSCORES')
                        const entries = []
                        for (let j = 0; j < raw.length; j += 2) {
                            entries.push({
                                member: raw[j].toString('base64'),
                                score: parseFloat(raw[j + 1].toString()),
                            })
                        }
                        value = entries
                        break
                    }
                    case 'hash': {
                        const raw = await redis.hgetallBuffer(key)
                        const entries = {}
                        if (raw) {
                            for (const [field, val] of Object.entries(raw)) {
                                entries[field] = val.toString('base64')
                            }
                        }
                        value = entries
                        break
                    }
                    case 'stream': {
                        const entries = await redis.xrange(key, '-', '+')
                        value = entries.map(([id, fields]) => {
                            const obj = { id }
                            for (let j = 0; j < fields.length; j += 2) {
                                obj[fields[j]] = fields[j + 1]
                            }
                            return obj
                        })
                        break
                    }
                    case 'json': {
                        const jsonStr = await redis.call('JSON.GET', key)
                        value = jsonStr
                        break
                    }
                    default:
                        continue
                }
            } catch (e) {
                console.error(`key-export: failed to read key "${key}" (type=${type}):`, e.message)
                continue
            }

            exportedKeys.push({
                key,
                type,
                value,
                pttl: pttl > 0 ? pttl : -1,
            })
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            data: {
                version: 1,
                exportedAt: new Date().toISOString(),
                database: socket.p3xrs.currentDatabase || 0,
                keys: exportedKeys,
            },
        })

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
