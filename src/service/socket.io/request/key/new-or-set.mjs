import * as sharedIoRedis from '../../shared.mjs'

const isBinaryLike = (value) => {
    if (value === undefined || value === null) {
        return false
    }
    if (Buffer.isBuffer(value)) {
        return true
    }
    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
        return true
    }
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(value)) {
        return true
    }
    return false
}

const consolePrefix = 'socket.io key new'

export default async (options) => {
    const {socket, payload} = options;

    const redis = socket.p3xrs.ioredis

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const {model} = payload;

        model.score = model.score === null ? undefined : model.score
        model.index = model.index === null ? undefined : model.index
        model.hashKey = model.hashKey === null ? undefined : model.hashKey
//console.warn(consolePrefix, payload)
        switch (model.type) {
            case 'stream':
                const xaddArgs = [
                    model.key,
                    model.streamTimestamp,
                ].concat(sharedIoRedis.argumentParser(model.value))
                await redis.xadd(...xaddArgs)
                break;

            case 'string':
                await redis.set(model.key, model.value)
                break;

            case 'list':
                if (model.index === undefined) {
                    await redis.rpush(model.key, model.value)
                } else {
                    if (model.index === -1) {
                        await redis.lpush(model.key, model.value)
                    } else {
                        const size = await redis.llen(model.key);
                        if (model.index > -1 && model.index < size) {
                            await redis.lset(model.key, model.index, model.value)
                        } else {
                            const listOutOBoundsError = new Error('list-out-of-bounds')
                            listOutOBoundsError.code = 'list-out-of-bounds'
                            throw listOutOBoundsError
                        }
                    }
                }
                break;

            case 'hash':
                if (payload.hasOwnProperty('originalHashKey')) {
                    await redis.hdel(model.key, payload.originalHashKey)
                }
                await redis.hset(model.key, model.hashKey, model.value)
                break;

            case 'set':
                if (payload.hasOwnProperty('originalValue')) {
                    await redis.srem(model.key, payload.originalValue)
                }
                await redis.sadd(model.key, model.value)
                break;

            case 'zset':
                if (payload.hasOwnProperty('originalValue')) {
                    await redis.zrem(model.key, payload.originalValue)
                }
                await redis.zadd(model.key, model.score, model.value)
                break;

            case 'timeseries':
                if (payload.type === 'add' || payload.type === 'append') {
                    // For new keys, create first with options
                    if (payload.type === 'add') {
                        try {
                            const createArgs = [model.key, 'DUPLICATE_POLICY', model.tsDuplicatePolicy || 'LAST']
                            const retention = parseInt(model.tsRetention)
                            if (!isNaN(retention) && retention > 0) {
                                createArgs.push('RETENTION', retention)
                            }
                            await redis.call('TS.CREATE', ...createArgs)
                        } catch (e) {
                            if (!e.message.includes('already exists')) {
                                throw e
                            }
                        }
                        // Always set labels via TS.ALTER (works for both new and existing keys)
                        const labelStr = model.tsLabels && model.tsLabels.trim().length > 0
                            ? model.tsLabels.trim()
                            : `key ${model.key}`
                        console.info('timeseries set labels:', model.key, labelStr)
                        await redis.call('TS.ALTER', model.key, 'LABELS', ...labelStr.split(/\s+/))
                    }
                    if (model.tsBulkMode) {
                        // Bulk mode: value is multiline "timestamp value\n..."
                        const spread = parseInt(model.tsSpread) || 60000
                        const lines = model.value.split('\n').map(l => l.trim()).filter(l => l.length > 0)
                        let autoTs = Date.now()
                        for (const line of lines) {
                            const parts = line.split(/\s+/)
                            if (parts.length >= 2) {
                                let ts = parts[0]
                                if (ts === '*') {
                                    ts = autoTs
                                    autoTs += spread
                                }
                                await redis.call('TS.ADD', model.key, ts, parseFloat(parts[1]), 'ON_DUPLICATE', 'LAST')
                            }
                        }
                    } else {
                        await redis.call('TS.ADD', model.key, model.tsTimestamp || '*', parseFloat(model.value), 'ON_DUPLICATE', 'LAST')
                    }
                } else if (payload.type === 'edit') {
                    if (model.tsEditAll) {
                        // Global edit: value is multiline "timestamp value\n..." format
                        // Delete all existing points first, then re-add from the edited text
                        const tsInfo = await redis.call('TS.INFO', model.key)
                        let firstTs = 0, lastTs = 0
                        for (let i = 0; i < tsInfo.length; i += 2) {
                            if (tsInfo[i] === 'firstTimestamp') firstTs = tsInfo[i + 1]
                            if (tsInfo[i] === 'lastTimestamp') lastTs = tsInfo[i + 1]
                        }
                        if (firstTs !== 0 || lastTs !== 0) {
                            await redis.call('TS.DEL', model.key, firstTs, lastTs)
                        }
                        // Parse and re-add each line
                        // For * timestamps, space them by the selected spread interval
                        const spread = parseInt(model.tsSpread) || 60000
                        const lines = model.value.split('\n').map(l => l.trim()).filter(l => l.length > 0)
                        let autoTs = Date.now()
                        for (const line of lines) {
                            const parts = line.split(/\s+/)
                            if (parts.length >= 2) {
                                let ts = parts[0]
                                if (ts === '*') {
                                    ts = autoTs
                                    autoTs += spread
                                }
                                await redis.call('TS.ADD', model.key, ts, parseFloat(parts[1]), 'ON_DUPLICATE', 'LAST')
                            }
                        }
                    } else {
                        // Single point edit: delete original, add new
                        if (model.originalTimestamp !== undefined) {
                            await redis.call('TS.DEL', model.key, model.originalTimestamp, model.originalTimestamp)
                        }
                        await redis.call('TS.ADD', model.key, model.tsTimestamp || '*', parseFloat(model.value), 'ON_DUPLICATE', 'LAST')
                    }
                    // Update labels if provided
                    if (model.tsLabels && model.tsLabels.trim().length > 0) {
                        await redis.call('TS.ALTER', model.key, 'LABELS', ...model.tsLabels.trim().split(/\s+/))
                    }
                }
                break;

            case 'json':
                // Validate JSON before sending to Redis
                try {
                    JSON.parse(model.value)
                } catch (e) {
                    throw new Error('invalid-json-value')
                }
                await redis.call('JSON.SET', model.key, '$', model.value)
                break;

            case 'bloom':
                await redis.call('BF.RESERVE', model.key,
                    parseFloat(model.bloomErrorRate) || 0.01,
                    parseInt(model.bloomCapacity) || 100)
                break;

            case 'cuckoo':
                await redis.call('CF.RESERVE', model.key,
                    parseInt(model.cuckooCapacity) || 1024)
                break;

            case 'topk':
                await redis.call('TOPK.RESERVE', model.key,
                    parseInt(model.topkK) || 10,
                    parseInt(model.topkWidth) || 2000,
                    parseInt(model.topkDepth) || 7,
                    parseFloat(model.topkDecay) || 0.9)
                break;

            case 'cms':
                await redis.call('CMS.INITBYDIM', model.key,
                    parseInt(model.cmsWidth) || 2000,
                    parseInt(model.cmsDepth) || 7)
                break;

            case 'tdigest':
                await redis.call('TDIGEST.CREATE', model.key,
                    'COMPRESSION', parseInt(model.tdigestCompression) || 100)
                break;

            case 'vectorset': {
                const values = (model.vectorValues || '').split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
                if (!values.length) throw new Error('Vector values are required')
                if (!model.vectorElement || !model.vectorElement.trim()) throw new Error('Element name is required')
                const args = [model.key, 'VALUES', values.length, ...values, model.vectorElement.trim()]
                await redis.call('VADD', ...args)
                break;
            }

        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            key: model.key,
        })
        /*
        await sharedIoRedis.getFullInfoAndSendSocket({
            redis: redis,
            responseEvent: options.responseEvent,
            socket: socket,
            extend: {
                key: model.key
            },
            payload: payload,

        })
         */
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message
        })

    }

}
