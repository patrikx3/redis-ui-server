export default async (options) => {
    const {socket, payload} = options

    try {
        const redis = socket.p3xrs.ioredis
        if (!redis) {
            socket.emit(options.responseEvent, { status: 'error', error: 'Not connected to Redis' })
            return
        }
        const maxScanKeys = payload.maxScanKeys || 5000
        const topN = payload.topN || 20
        const BATCH = 500

        // Get total key count
        const dbSize = await redis.dbsize()

        // Scan keys (scanStream is cluster-aware, scans all masters)
        const keys = await new Promise((resolve, reject) => {
            const collected = []
            const stream = redis.scanStream({ count: 500 })
            stream.on('data', (batch) => {
                if (collected.length < maxScanKeys) {
                    collected.push(...batch)
                }
            })
            stream.on('end', () => resolve(collected.slice(0, maxScanKeys)))
            stream.on('error', reject)
        })

        // Pipeline: TYPE + MEMORY USAGE + TTL for each key
        const typeDistribution = {}
        const typeMemory = {}
        const prefixBuckets = {}
        const allKeys = []
        let withTTL = 0
        let persistent = 0
        let ttlSum = 0

        for (let i = 0; i < keys.length; i += BATCH) {
            const batch = keys.slice(i, i + BATCH)
            const pipeline = redis.pipeline()
            for (const key of batch) {
                pipeline.type(key)
                pipeline.call('MEMORY', 'USAGE', key)
                pipeline.ttl(key)
            }
            const results = await pipeline.exec()
            for (let j = 0; j < batch.length; j++) {
                const key = batch[j]
                const typeErr = results[j * 3][0]
                const type = results[j * 3][1] || 'unknown'
                const memErr = results[j * 3 + 1][0]
                const bytes = results[j * 3 + 1][1]
                const ttlErr = results[j * 3 + 2][0]
                const ttl = results[j * 3 + 2][1]

                const keyType = !typeErr ? type : 'unknown'
                const keyBytes = (!memErr && typeof bytes === 'number') ? bytes : 0

                // Type distribution
                typeDistribution[keyType] = (typeDistribution[keyType] || 0) + 1
                typeMemory[keyType] = (typeMemory[keyType] || 0) + keyBytes

                // Prefix buckets (split by first : delimiter)
                const colonIdx = key.indexOf(':')
                const prefix = colonIdx > 0 ? key.substring(0, colonIdx + 1) : '(no prefix)'
                if (!prefixBuckets[prefix]) {
                    prefixBuckets[prefix] = { keyCount: 0, totalBytes: 0 }
                }
                prefixBuckets[prefix].keyCount++
                prefixBuckets[prefix].totalBytes += keyBytes

                // TTL
                if (!ttlErr && typeof ttl === 'number') {
                    if (ttl >= 0) {
                        withTTL++
                        ttlSum += ttl
                    } else {
                        persistent++
                    }
                } else {
                    persistent++
                }

                // Top keys
                if (keyBytes > 0) {
                    allKeys.push({ key, bytes: keyBytes, type: keyType })
                }
            }
        }

        // Sort top keys
        allKeys.sort((a, b) => b.bytes - a.bytes)
        const topKeys = allKeys.slice(0, topN)

        // Sort prefix buckets by memory
        const prefixMemory = Object.entries(prefixBuckets)
            .map(([prefix, data]) => ({ prefix, ...data }))
            .sort((a, b) => b.totalBytes - a.totalBytes)
            .slice(0, 50)

        // INFO server
        const serverInfoRaw = await redis.info('server')
        const serverInfo = {}
        const serverFields = {
            redis_version: 'version',
            redis_mode: 'mode',
            uptime_in_seconds: 'uptime',
        }
        for (const line of serverInfoRaw.split('\r\n')) {
            const [k, v] = line.split(':')
            if (k && serverFields[k]) {
                serverInfo[serverFields[k]] = k === 'uptime_in_seconds' ? (parseInt(v) || 0) : (v || 'unknown')
            }
        }
        if (!serverInfo.mode) serverInfo.mode = 'standalone'

        // INFO memory
        const memoryInfoRaw = await redis.info('memory')
        const memoryInfo = {}
        const fields = {
            used_memory: 'used', used_memory_human: 'usedHuman',
            used_memory_rss: 'rss', used_memory_rss_human: 'rssHuman',
            used_memory_peak: 'peak', used_memory_peak_human: 'peakHuman',
            used_memory_lua: 'lua', used_memory_overhead: 'overhead',
            used_memory_dataset: 'dataset', mem_fragmentation_ratio: 'fragRatio',
            mem_allocator: 'allocator',
        }
        for (const line of memoryInfoRaw.split('\r\n')) {
            const [k, v] = line.split(':')
            if (k && fields[k]) {
                memoryInfo[fields[k]] = isNaN(v) ? v : Number(v)
            }
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            data: {
                totalScanned: keys.length,
                dbSize,
                typeDistribution,
                typeMemory,
                prefixMemory,
                topKeys,
                expirationOverview: {
                    withTTL,
                    persistent,
                    avgTTL: withTTL > 0 ? Math.round(ttlSum / withTTL) : 0,
                },
                memoryInfo,
                serverInfo,
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
