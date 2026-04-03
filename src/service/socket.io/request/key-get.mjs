import { tryDecompress } from '../../decompress.mjs'

const consolePrefix = 'socket.io key get full'


export default async (options) => {
    const {socket, payload} = options;

    try {
        let redis = socket.p3xrs.ioredis

        const key = payload.key;

        //const type = payload.type;

        let type = await redis.type(key)

        // Normalize ReJSON-RL to json for the client.
        if (type === 'ReJSON-RL') {
            type = 'json'
        }

        // Normalize TSDB-TYPE to timeseries
        if (type === 'TSDB-TYPE') {
            type = 'timeseries'
        }

        //console.info(consolePrefix, payload, type, key)

        const viewPipeline = redis.pipeline()
        switch (type) {
            case 'string':
                //viewPipeline.get(key)
                viewPipeline.getBuffer(key)
                break;

            case 'list':
                //viewPipeline.lrange(key, 0, -1)
                viewPipeline.lrangeBuffer(key, 0, -1)
                break;

            case 'hash':
                //viewPipeline.hgetall(key)
                viewPipeline.hgetallBuffer(key)
                break;

            case 'set':
                //viewPipeline.smembers(key)
                viewPipeline.smembersBuffer(key)
                break;

            case 'zset':
                //viewPipeline.zrange(key, 0, -1, 'WITHSCORES')
                viewPipeline.zrangeBuffer(key, 0, -1, 'WITHSCORES')
                break;

            case 'stream':
                //viewPipeline.xrange(key, '-', '+')
                viewPipeline.xrangeBuffer(key, '-', '+')
                break;

            case 'json':
                viewPipeline.call('JSON.GET', key, '$')
                break;

            case 'timeseries':
                // TS.INFO via pipeline call
                viewPipeline.call('TS.INFO', key)
                break;
        }
        viewPipeline.ttl(key)

        // JSON and timeseries keys don't support OBJECT ENCODING
        if (type !== 'json' && type !== 'timeseries') {
            viewPipeline.object('encoding', key)
        }

        switch (type) {
            case 'stream':
                viewPipeline.xlen(key)
                break;

            case 'hash':
                viewPipeline.hlen(key)
                break;

            case 'list':
                viewPipeline.llen(key)
                break;

            case 'set':
                viewPipeline.scard(key)
                break;

            case 'zset':
                viewPipeline.zcard(key)
                break;
        }


        const viewPipelineResult = await viewPipeline.exec()
        // console.log(viewPipelineResult)

        let valueBuffer = viewPipelineResult[0][1]
        const ttl = viewPipelineResult[1][1]
        let encoding
        let length
        let pipelineIndex = 2

        if (type === 'timeseries') {
            encoding = 'timeseries'
            // TS.INFO returns flat array [field, value, ...]; parse to object
            const tsInfo = {}
            if (Array.isArray(valueBuffer)) {
                for (let i = 0; i < valueBuffer.length; i += 2) {
                    const field = valueBuffer[i]
                    let value = valueBuffer[i + 1]
                    if (field === 'labels' && Array.isArray(value)) {
                        const labels = {}
                        for (const pair of value) {
                            if (Array.isArray(pair) && pair.length === 2) {
                                labels[pair[0]] = pair[1]
                            }
                        }
                        value = labels
                    }
                    if (field === 'rules' && Array.isArray(value)) {
                        value = value.map(rule => Array.isArray(rule) ? { destKey: rule[0], bucketDuration: rule[1], aggregationType: rule[2] } : rule)
                    }
                    tsInfo[field] = value
                }
            }
            valueBuffer = Buffer.from(JSON.stringify(tsInfo))
            length = tsInfo.totalSamples || 0
        } else if (type === 'json') {
            encoding = 'json'
            // JSON.GET returns a JSON string; convert to Buffer for consistency
            if (typeof valueBuffer === 'string') {
                valueBuffer = Buffer.from(valueBuffer)
            }
        } else {
            encoding = viewPipelineResult[pipelineIndex][1]
            pipelineIndex++
        }

        if (type !== 'string' && type !== 'json' && type !== 'timeseries') {
            length = viewPipelineResult[pipelineIndex][1]
        }

        // Try to decompress the value (string type: single buffer, collections: each item)
        let compression = null
        if (type === 'string' && Buffer.isBuffer(valueBuffer)) {
            const result = await tryDecompress(valueBuffer)
            if (result) {
                compression = {
                    algorithm: result.algorithm,
                    originalSize: valueBuffer.length,
                    decompressedSize: result.decompressed.length,
                    ratio: +((1 - valueBuffer.length / result.decompressed.length) * 100).toFixed(1),
                }
                valueBuffer = result.decompressed
            }
        } else if (type === 'list' && Array.isArray(valueBuffer)) {
            for (let i = 0; i < valueBuffer.length; i++) {
                if (Buffer.isBuffer(valueBuffer[i])) {
                    const result = await tryDecompress(valueBuffer[i])
                    if (result) {
                        if (!compression) {
                            compression = { algorithm: result.algorithm, items: 0, originalSize: 0, decompressedSize: 0 }
                        }
                        compression.items++
                        compression.originalSize += valueBuffer[i].length
                        compression.decompressedSize += result.decompressed.length
                        valueBuffer[i] = result.decompressed
                    }
                }
            }
            if (compression) {
                compression.ratio = +((1 - compression.originalSize / compression.decompressedSize) * 100).toFixed(1)
            }
        } else if (type === 'hash' && valueBuffer && typeof valueBuffer === 'object' && !Array.isArray(valueBuffer)) {
            for (const field of Object.keys(valueBuffer)) {
                if (Buffer.isBuffer(valueBuffer[field])) {
                    const result = await tryDecompress(valueBuffer[field])
                    if (result) {
                        if (!compression) {
                            compression = { algorithm: result.algorithm, items: 0, originalSize: 0, decompressedSize: 0 }
                        }
                        compression.items++
                        compression.originalSize += valueBuffer[field].length
                        compression.decompressedSize += result.decompressed.length
                        valueBuffer[field] = result.decompressed
                    }
                }
            }
            if (compression) {
                compression.ratio = +((1 - compression.originalSize / compression.decompressedSize) * 100).toFixed(1)
            }
        } else if ((type === 'set' || type === 'zset') && Array.isArray(valueBuffer)) {
            for (let i = 0; i < valueBuffer.length; i++) {
                if (Buffer.isBuffer(valueBuffer[i])) {
                    const result = await tryDecompress(valueBuffer[i])
                    if (result) {
                        if (!compression) {
                            compression = { algorithm: result.algorithm, items: 0, originalSize: 0, decompressedSize: 0 }
                        }
                        compression.items++
                        compression.originalSize += valueBuffer[i].length
                        compression.decompressedSize += result.decompressed.length
                        valueBuffer[i] = result.decompressed
                    }
                }
            }
            if (compression) {
                compression.ratio = +((1 - compression.originalSize / compression.decompressedSize) * 100).toFixed(1)
            }
        } else if (type === 'stream' && Array.isArray(valueBuffer)) {
            // Stream entries: [[id, [field, value, field, value]], ...]
            for (const entry of valueBuffer) {
                if (!Array.isArray(entry) || !Array.isArray(entry[1])) continue
                const fields = entry[1]
                for (let i = 0; i < fields.length; i++) {
                    if (Buffer.isBuffer(fields[i])) {
                        const result = await tryDecompress(fields[i])
                        if (result) {
                            if (!compression) {
                                compression = { algorithm: result.algorithm, items: 0, originalSize: 0, decompressedSize: 0 }
                            }
                            compression.items++
                            compression.originalSize += fields[i].length
                            compression.decompressedSize += result.decompressed.length
                            fields[i] = result.decompressed
                        }
                    }
                }
            }
            if (compression) {
                compression.ratio = +((1 - compression.originalSize / compression.decompressedSize) * 100).toFixed(1)
            }
        }

        const socketResult = {
            length: length,
            key: key,
            status: 'ok',
            type: type,
            valueBuffer: valueBuffer,
            ttl: ttl,
            encoding: encoding,
            compression: compression,
        };
        // console.warn('socketResult', socketResult)
        socket.emit(options.responseEvent, socketResult)
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }


}
