import * as sharedIoRedis from '../../shared.mjs'

const BATCH_SIZE = 500

export default async (options) => {
    const {socket, payload} = options

    try {
        sharedIoRedis.ensureReadonlyConnection({ socket })

        const redis = socket.p3xrs.ioredis
        const { keys, conflictMode } = payload
        // conflictMode: 'overwrite' | 'skip'

        if (!Array.isArray(keys) || keys.length === 0) {
            socket.emit(options.responseEvent, {
                status: 'error',
                error: 'No keys to import',
            })
            return
        }

        // Check existing keys if skip mode (pipelined in batches)
        let existingKeys = new Set()
        if (conflictMode === 'skip') {
            for (let i = 0; i < keys.length; i += BATCH_SIZE) {
                const batch = keys.slice(i, i + BATCH_SIZE)
                const pipeline = redis.pipeline()
                for (const entry of batch) {
                    pipeline.exists(entry.key)
                }
                const results = await pipeline.exec()
                for (let j = 0; j < batch.length; j++) {
                    if (results[j][0]) {
                        // exists check itself failed — treat as not existing
                        continue
                    }
                    if (results[j][1] === 1) {
                        existingKeys.add(batch[j].key)
                    }
                }
            }
        }

        let created = 0
        let skipped = 0
        let errors = 0

        // Process keys in batches
        for (let i = 0; i < keys.length; i += BATCH_SIZE) {
            const batch = keys.slice(i, i + BATCH_SIZE)

            // Filter out skipped keys
            const toImport = []
            for (const entry of batch) {
                if (conflictMode === 'skip' && existingKeys.has(entry.key)) {
                    skipped++
                } else {
                    toImport.push(entry)
                }
            }

            if (toImport.length === 0) continue

            // Separate pipelineable types from sequential (stream, json)
            const pipelineable = []
            const sequential = []
            for (const entry of toImport) {
                if (entry.type === 'stream' || entry.type === 'json') {
                    sequential.push(entry)
                } else {
                    pipelineable.push(entry)
                }
            }

            // --- Pipelineable keys (string, list, set, zset, hash) ---
            if (pipelineable.length > 0) {
                // Delete existing keys if overwriting
                if (conflictMode === 'overwrite') {
                    const delPipeline = redis.pipeline()
                    for (const entry of pipelineable) {
                        delPipeline.del(entry.key)
                    }
                    await delPipeline.exec()
                }

                // Build write pipeline — track which entries map to which pipeline slot
                const writePipeline = redis.pipeline()
                const pipelineEntries = [] // entries that actually got a command
                for (const entry of pipelineable) {
                    try {
                        switch (entry.type) {
                            case 'string':
                                writePipeline.set(entry.key, Buffer.from(entry.value, 'base64'))
                                pipelineEntries.push(entry)
                                break
                            case 'list':
                                if (Array.isArray(entry.value) && entry.value.length > 0) {
                                    writePipeline.rpush(entry.key, ...entry.value.map(v => Buffer.from(v, 'base64')))
                                    pipelineEntries.push(entry)
                                } else {
                                    created++ // empty list, nothing to write
                                }
                                break
                            case 'set':
                                if (Array.isArray(entry.value) && entry.value.length > 0) {
                                    writePipeline.sadd(entry.key, ...entry.value.map(v => Buffer.from(v, 'base64')))
                                    pipelineEntries.push(entry)
                                } else {
                                    created++
                                }
                                break
                            case 'zset':
                                if (Array.isArray(entry.value) && entry.value.length > 0) {
                                    const args = []
                                    for (const e of entry.value) {
                                        args.push(e.score, Buffer.from(e.member, 'base64'))
                                    }
                                    writePipeline.zadd(entry.key, ...args)
                                    pipelineEntries.push(entry)
                                } else {
                                    created++
                                }
                                break
                            case 'hash':
                                if (entry.value && typeof entry.value === 'object') {
                                    const args = []
                                    for (const [field, val] of Object.entries(entry.value)) {
                                        args.push(field, Buffer.from(val, 'base64'))
                                    }
                                    if (args.length > 0) {
                                        writePipeline.hset(entry.key, ...args)
                                        pipelineEntries.push(entry)
                                    } else {
                                        created++
                                    }
                                }
                                break
                            default:
                                errors++
                        }
                    } catch (e) {
                        console.error(`key-import: failed to prepare key "${entry.key}":`, e.message)
                        errors++
                    }
                }

                if (pipelineEntries.length > 0) {
                    const writeResults = await writePipeline.exec()

                    // Collect successful entries for TTL restore
                    const successEntries = []
                    for (let j = 0; j < writeResults.length; j++) {
                        if (writeResults[j][0]) {
                            console.error(`key-import: write failed for key "${pipelineEntries[j].key}":`, writeResults[j][0].message)
                            errors++
                        } else {
                            created++
                            if (pipelineEntries[j].pttl && pipelineEntries[j].pttl > 0) {
                                successEntries.push(pipelineEntries[j])
                            }
                        }
                    }

                    // Pipeline TTL restore only for successfully written keys
                    if (successEntries.length > 0) {
                        const ttlPipeline = redis.pipeline()
                        for (const entry of successEntries) {
                            ttlPipeline.pexpire(entry.key, entry.pttl)
                        }
                        await ttlPipeline.exec()
                    }
                }
            }

            // --- Sequential keys (stream, json) ---
            for (const entry of sequential) {
                try {
                    if (conflictMode === 'overwrite') {
                        await redis.del(entry.key)
                    }

                    if (entry.type === 'stream') {
                        if (Array.isArray(entry.value) && entry.value.length > 0) {
                            const streamPipeline = redis.pipeline()
                            for (const streamEntry of entry.value) {
                                const { id, ...fields } = streamEntry
                                const args = []
                                for (const [k, v] of Object.entries(fields)) {
                                    args.push(k, v)
                                }
                                if (args.length > 0) {
                                    streamPipeline.xadd(entry.key, '*', ...args)
                                }
                            }
                            await streamPipeline.exec()
                        }
                    } else if (entry.type === 'json') {
                        if (entry.value !== null && entry.value !== undefined) {
                            await redis.call('JSON.SET', entry.key, '$', typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value))
                        }
                    }

                    if (entry.pttl && entry.pttl > 0) {
                        await redis.pexpire(entry.key, entry.pttl)
                    }

                    created++
                } catch (e) {
                    console.error(`key-import: failed to import key "${entry.key}" (type=${entry.type}):`, e.message)
                    errors++
                }
            }
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            data: { created, skipped, errors },
        })

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
