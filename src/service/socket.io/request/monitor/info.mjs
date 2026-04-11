export default async (options) => {
    const {socket} = options

    try {
        const redis = socket.p3xrs.ioredis

        const [infoRaw, slowlog] = await Promise.all([
            redis.info(),
            redis.slowlog('GET', 10),
        ])

        // Parse INFO into sections
        const info = {}
        let currentSection = ''
        for (const line of infoRaw.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) {
                if (trimmed.startsWith('# ')) {
                    currentSection = trimmed.slice(2).toLowerCase()
                    info[currentSection] = {}
                }
                continue
            }
            const colonIdx = trimmed.indexOf(':')
            if (colonIdx > 0) {
                const key = trimmed.slice(0, colonIdx)
                const value = trimmed.slice(colonIdx + 1)
                if (currentSection) {
                    info[currentSection][key] = value
                }
            }
        }

        // Extract key metrics
        const memory = info.memory || {}
        const stats = info.stats || {}
        const clients = info.clients || {}
        const server = info.server || {}
        const keyspace = info.keyspace || {}

        // Parse keyspace hit/miss
        const hits = parseInt(stats.keyspace_hits) || 0
        const misses = parseInt(stats.keyspace_misses) || 0
        const hitRate = hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(1) : '0.0'

        const data = {
            timestamp: Date.now(),
            server: {
                version: server.redis_version,
                uptime: parseInt(server.uptime_in_seconds) || 0,
                mode: server.redis_mode || 'standalone',
            },
            memory: {
                used: parseInt(memory.used_memory) || 0,
                usedHuman: memory.used_memory_human || '0B',
                rss: parseInt(memory.used_memory_rss) || 0,
                rssHuman: memory.used_memory_rss_human || '0B',
                peak: parseInt(memory.used_memory_peak) || 0,
                peakHuman: memory.used_memory_peak_human || '0B',
                fragRatio: parseFloat(memory.mem_fragmentation_ratio) || 0,
            },
            stats: {
                opsPerSec: parseInt(stats.instantaneous_ops_per_sec) || 0,
                totalCommands: parseInt(stats.total_commands_processed) || 0,
                hits,
                misses,
                hitRate: parseFloat(hitRate),
                inputKbps: parseFloat(stats.instantaneous_input_kbps) || 0,
                outputKbps: parseFloat(stats.instantaneous_output_kbps) || 0,
                totalNetInput: parseInt(stats.total_net_input_bytes) || 0,
                totalNetOutput: parseInt(stats.total_net_output_bytes) || 0,
                expiredKeys: parseInt(stats.expired_keys) || 0,
                evictedKeys: parseInt(stats.evicted_keys) || 0,
            },
            clients: {
                connected: parseInt(clients.connected_clients) || 0,
                blocked: parseInt(clients.blocked_clients) || 0,
                maxInput: parseInt(clients.client_recent_max_input_buffer) || 0,
                maxOutput: parseInt(clients.client_recent_max_output_buffer) || 0,
            },
            keyspace,
            slowlog: slowlog.map(entry => ({
                id: entry[0],
                timestamp: entry[1],
                duration: entry[2],
                command: Array.isArray(entry[3]) ? entry[3].join(' ') : String(entry[3]),
            })),
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            data,
        })

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
