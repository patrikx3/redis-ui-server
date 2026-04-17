/**
 * AI tool-use — read-only Redis tools the LLM can call to investigate live state.
 *
 * Used by the agentic loop in redis-query.mjs. Each tool has:
 *   - schema: OpenAI-compatible tool definition passed to Groq
 *   - run:    executor that runs against the user's active Redis connection
 *
 * Safety rules (do NOT relax):
 *   - All tools are read-only — no SET, DEL, CONFIG SET, FLUSHDB, SCRIPT, EVAL, SHUTDOWN
 *   - SCAN is exposed (bounded COUNT), KEYS is never exposed
 *   - Per-turn tool-call cap is enforced by the caller (agenticLoop)
 *   - Results are truncated if huge — prevents token blowup
 */

const MAX_RESULT_CHARS = 8000

function truncate(s) {
    if (typeof s !== 'string') s = JSON.stringify(s)
    if (s.length <= MAX_RESULT_CHARS) return s
    return s.slice(0, MAX_RESULT_CHARS) + `\n… [truncated, original ${s.length} chars]`
}

function formatReply(reply) {
    if (reply === null || reply === undefined) return ''
    if (typeof reply === 'string') return truncate(reply)
    if (Buffer.isBuffer(reply)) return truncate(reply.toString('utf8'))
    if (Array.isArray(reply)) return truncate(JSON.stringify(reply, null, 2))
    return truncate(JSON.stringify(reply, null, 2))
}

export const TOOL_SCHEMAS = [
    {
        type: 'function',
        function: {
            name: 'redis_info',
            description: 'Run INFO [section] to get server/memory/stats/replication/clients/cpu/keyspace data. Use this to answer "why is memory high", "how many clients", "what is the uptime".',
            parameters: {
                type: 'object',
                properties: {
                    section: {
                        type: 'string',
                        description: 'Optional INFO section: server, clients, memory, stats, replication, cpu, modules, keyspace, all. Omit for default summary.',
                    },
                },
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'redis_memory_stats',
            description: 'Run MEMORY STATS for a detailed memory breakdown (overhead, per-type usage, allocator stats). Prefer this over INFO memory when the user asks about memory composition.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'redis_slowlog_get',
            description: 'Run SLOWLOG GET [count] to retrieve the most recent slow queries with their execution duration. Use for "why is it slow", "what queries are slow".',
            parameters: {
                type: 'object',
                properties: {
                    count: {
                        type: 'integer',
                        description: 'Max entries to return (default 16, max 128).',
                    },
                },
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'redis_client_list',
            description: 'Run CLIENT LIST to see all connected clients (address, name, current command, idle time).',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'redis_config_get',
            description: 'Run CONFIG GET <pattern> to read server configuration. Common patterns: maxmemory, maxmemory-policy, save, timeout, *, client-output-buffer-limit.',
            parameters: {
                type: 'object',
                properties: {
                    pattern: {
                        type: 'string',
                        description: 'Config key glob, e.g. "maxmemory*" or "save".',
                    },
                },
                required: ['pattern'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'redis_dbsize',
            description: 'Run DBSIZE to count keys in the current database.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'redis_latency_latest',
            description: 'Run LATENCY LATEST to see the most recent latency events recorded by the server.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'redis_scan',
            description: 'Run SCAN <cursor> [MATCH <pattern>] [COUNT <n>] [TYPE <t>] to enumerate keys safely. NEVER exposes KEYS. Default COUNT 100, max 1000.',
            parameters: {
                type: 'object',
                properties: {
                    cursor: { type: 'string', description: 'Cursor (0 to start, use returned cursor to continue).' },
                    match: { type: 'string', description: 'Optional MATCH glob pattern.' },
                    count: { type: 'integer', description: 'Optional COUNT hint (1-1000, default 100).' },
                    type: { type: 'string', description: 'Optional TYPE filter: string, list, set, hash, zset, stream, ReJSON-RL.' },
                },
                required: ['cursor'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'redis_type',
            description: 'Run TYPE <key> to see the data type of a specific key.',
            parameters: {
                type: 'object',
                properties: {
                    key: { type: 'string', description: 'The Redis key name.' },
                },
                required: ['key'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'redis_ttl',
            description: 'Run TTL <key> to see seconds until a key expires. -1 = no expiry, -2 = does not exist.',
            parameters: {
                type: 'object',
                properties: {
                    key: { type: 'string', description: 'The Redis key name.' },
                },
                required: ['key'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'redis_memory_usage',
            description: 'Run MEMORY USAGE <key> to get bytes of memory a specific key uses (including overhead).',
            parameters: {
                type: 'object',
                properties: {
                    key: { type: 'string', description: 'The Redis key name.' },
                },
                required: ['key'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'redis_cluster_info',
            description: 'Run CLUSTER INFO to see cluster state (enabled, slot assignment, epoch, stats). Only meaningful in cluster mode.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'redis_cluster_nodes',
            description: 'Run CLUSTER NODES to see cluster topology (masters, replicas, slot ranges). Only meaningful in cluster mode.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'redis_acl_whoami',
            description: 'Run ACL WHOAMI to see which ACL user the connection is authenticated as.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'redis_module_list',
            description: 'Run MODULE LIST to enumerate loaded Redis modules (ReJSON, RediSearch, RedisTimeSeries, RedisBloom, etc.) with versions.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
]

const TOOL_EXECUTORS = {
    redis_info: async (redis, args) => {
        const section = typeof args.section === 'string' && args.section.length > 0 ? args.section : ''
        const reply = section ? await redis.call('INFO', section) : await redis.call('INFO')
        return formatReply(reply)
    },
    redis_memory_stats: async (redis) => {
        const reply = await redis.call('MEMORY', 'STATS')
        return formatReply(reply)
    },
    redis_slowlog_get: async (redis, args) => {
        const count = Math.min(Math.max(parseInt(args.count, 10) || 16, 1), 128)
        const reply = await redis.call('SLOWLOG', 'GET', count)
        return formatReply(reply)
    },
    redis_client_list: async (redis) => {
        const reply = await redis.call('CLIENT', 'LIST')
        return formatReply(reply)
    },
    redis_config_get: async (redis, args) => {
        const pattern = String(args.pattern || '*')
        const reply = await redis.call('CONFIG', 'GET', pattern)
        return formatReply(reply)
    },
    redis_dbsize: async (redis) => {
        const reply = await redis.call('DBSIZE')
        return formatReply(reply)
    },
    redis_latency_latest: async (redis) => {
        const reply = await redis.call('LATENCY', 'LATEST')
        return formatReply(reply)
    },
    redis_scan: async (redis, args) => {
        const cursor = String(args.cursor ?? '0')
        const params = [cursor]
        if (typeof args.match === 'string' && args.match.length > 0) {
            params.push('MATCH', args.match)
        }
        const rawCount = parseInt(args.count, 10)
        const count = Number.isFinite(rawCount) ? Math.min(Math.max(rawCount, 1), 1000) : 100
        params.push('COUNT', count)
        if (typeof args.type === 'string' && args.type.length > 0) {
            params.push('TYPE', args.type)
        }
        const reply = await redis.call('SCAN', ...params)
        return formatReply(reply)
    },
    redis_type: async (redis, args) => {
        const key = String(args.key || '')
        if (!key) throw new Error('redis_type requires a key argument')
        const reply = await redis.call('TYPE', key)
        return formatReply(reply)
    },
    redis_ttl: async (redis, args) => {
        const key = String(args.key || '')
        if (!key) throw new Error('redis_ttl requires a key argument')
        const reply = await redis.call('TTL', key)
        return formatReply(reply)
    },
    redis_memory_usage: async (redis, args) => {
        const key = String(args.key || '')
        if (!key) throw new Error('redis_memory_usage requires a key argument')
        const reply = await redis.call('MEMORY', 'USAGE', key)
        return formatReply(reply)
    },
    redis_cluster_info: async (redis) => {
        const reply = await redis.call('CLUSTER', 'INFO')
        return formatReply(reply)
    },
    redis_cluster_nodes: async (redis) => {
        const reply = await redis.call('CLUSTER', 'NODES')
        return formatReply(reply)
    },
    redis_acl_whoami: async (redis) => {
        const reply = await redis.call('ACL', 'WHOAMI')
        return formatReply(reply)
    },
    redis_module_list: async (redis) => {
        const reply = await redis.call('MODULE', 'LIST')
        return formatReply(reply)
    },
}

/**
 * Run a single tool call. Returns { result, ms, ok, error? }.
 * Never throws — any error is packaged into the result so the LLM can see and recover.
 */
export async function runTool(redis, name, args) {
    const t0 = Date.now()
    try {
        const fn = TOOL_EXECUTORS[name]
        if (!fn) {
            return { ok: false, error: `Unknown tool: ${name}`, ms: Date.now() - t0 }
        }
        const result = await fn(redis, args || {})
        return { ok: true, result, ms: Date.now() - t0 }
    } catch (e) {
        return { ok: false, error: e.message || String(e), ms: Date.now() - t0 }
    }
}
