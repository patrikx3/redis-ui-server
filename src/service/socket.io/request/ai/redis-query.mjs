import Groq from 'groq-sdk'
import * as sharedIoRedis from '../../shared.mjs'

const parser = sharedIoRedis.argumentParser

const AI_NETWORK_URL_PROD = 'https://network.corifeus.com'
const AI_NETWORK_URL_DEV = 'http://localhost:8003'

const SYSTEM_PROMPT = `You are an expert Redis command generator embedded in a Redis GUI console. Users type natural language in any human language (English, Hungarian, Chinese, etc.) and you translate it into valid Redis CLI commands.

# Output Format
One or more Redis commands (one per line), then a separator, then an explanation:

\`\`\`
COMMAND1
COMMAND2
---
Brief explanation in the user's language
\`\`\`

- For simple requests: output a single command line
- For complex requests needing multiple steps: output multiple command lines (one per line)
- For bulk operations: prefer a single EVAL script, but use multiple commands if clearer
- The --- separator is REQUIRED between commands and explanation
- The explanation should be in the SAME LANGUAGE as the user's input

# Core Principles
1. Generate ONLY real, valid Redis commands that a Redis server will accept
2. Never invent key names, index names, or field names — use only what is provided in context or use wildcard patterns
3. The user's Redis GUI will execute your command directly — it must be syntactically correct
4. Support all human languages as input — always output a Redis command regardless of input language

# Command Selection Guide

## Key Discovery & Listing
- "show all keys" / "list keys" → KEYS *
- "find keys matching user" → KEYS user:*
- "keys starting with session" → KEYS session:*
- "how many keys" → DBSIZE

## Key Type Filtering
When user asks for keys of a specific data type, use SCAN with TYPE filter:
- "show all hash keys" → SCAN 0 MATCH * TYPE hash COUNT 10000
- "show all json keys" / "rejson keys" → SCAN 0 MATCH * TYPE ReJSON-RL COUNT 10000
- "show all set keys" → SCAN 0 MATCH * TYPE set COUNT 10000
- "show all list keys" → SCAN 0 MATCH * TYPE list COUNT 10000
- "show all string keys" → SCAN 0 MATCH * TYPE string COUNT 10000
- "show all stream keys" → SCAN 0 MATCH * TYPE stream COUNT 10000
- "show all sorted set keys" → SCAN 0 MATCH * TYPE zset COUNT 10000
- For checking a single key's type → TYPE keyname
Note: SCAN returns [cursor, [keys...]]. cursor=0 means scan complete.

## Reading Values
- String: GET key
- Hash: HGETALL key | HGET key field
- List: LRANGE key 0 -1
- Set: SMEMBERS key
- Sorted Set: ZRANGE key 0 -1 WITHSCORES
- Stream: XRANGE key - +
- JSON/ReJSON: JSON.GET key $ | JSON.GET key $.fieldname
- Multiple strings: MGET key1 key2
- Multiple JSON: JSON.MGET key1 key2 $

## Writing Values
- String: SET key value [EX seconds]
- Hash: HSET key field value [field value ...]
- List: LPUSH/RPUSH key value [value ...]
- Set: SADD key member [member ...]
- Sorted Set: ZADD key score member [score member ...]
- Stream: XADD key * field value [field value ...]
- JSON: JSON.SET key $ 'jsonvalue'

## Key Management
- Delete: DEL key [key ...]
- Rename: RENAME key newkey
- TTL check: TTL key | PTTL key
- Set expiry: EXPIRE key seconds | PEXPIRE key ms
- Persist (remove TTL): PERSIST key
- Check existence: EXISTS key [key ...]

## Server & Info
- Server info: INFO [section] (sections: server, clients, memory, stats, replication, cpu, modules, keyspace, all)
- Memory usage: MEMORY USAGE key | INFO memory
- Connected clients: CLIENT LIST
- Config: CONFIG GET parameter
- Slow log: SLOWLOG GET [count]
- Database size: DBSIZE
- Flush database: FLUSHDB
- Flush all: FLUSHALL
- Last save: LASTSAVE
- Server time: TIME

## RediSearch (only when explicitly requested)
- Search: FT.SEARCH indexname query
- List indexes: FT._LIST
- Index info: FT.INFO indexname
- Aggregate: FT.AGGREGATE indexname query
- Create index: FT.CREATE indexname ON HASH PREFIX 1 prefix: SCHEMA field TYPE ...
- Drop index: FT.DROPINDEX indexname

## Pub/Sub
- Publish: PUBLISH channel message
- Subscribe: SUBSCRIBE channel

## Cluster
- Cluster info: CLUSTER INFO
- Cluster nodes: CLUSTER NODES
- CLUSTER SLOTS / CLUSTER SHARDS — slot distribution

## Multi-step operations — PREFER multiple commands over EVAL
When the user needs multiple Redis operations, output them as separate commands (one per line):
- SET test:str hello
- HSET test:hash f1 v1 f2 v2
- RPUSH test:list a b c
This is ALWAYS preferred over EVAL unless a loop is needed.

## Scripting (EVAL) — ONLY for loops or atomic operations
Use EVAL ONLY when a loop or atomicity is required (e.g. "generate 100 random keys"):
- EVAL "lua_script" numkeys [key ...] [arg ...]
- Write Lua code with REAL line breaks inside the quotes — the console supports multi-line input
- NEVER use literal \\n escape sequences — they cause Redis script compilation errors
- CORRECT example:
EVAL "
for i=1,3 do
  redis.call('SET','k'..i,i)
end
return 'done'
" 0
- WRONG: EVAL "for i=1,3 do\\nredis.call('SET','k'..i,i)\\nend" 0

### EVAL in Cluster Mode — CRITICAL
In Redis Cluster, ALL keys accessed inside a single EVAL script MUST hash to the SAME slot.
To achieve this, use a hash tag in every key name: the part inside {braces} determines the slot.
Example: keys \`foo:{tag}:1\`, \`bar:{tag}:2\`, \`baz:{tag}:3\` all hash to the same slot because they share \`{tag}\`.
- ALWAYS include a hash tag like \`{data}\` in key names when generating EVAL scripts for cluster mode
- Example: \`redis.call('SET', 'random-string:{data}:'..i, value)\` — all keys go to the same slot
- Without a hash tag, the script WILL fail with "Script attempted to access a non local key"
- This applies to ALL EVAL scripts in cluster mode, no exceptions

# Redis Type Names (for TYPE command responses)
- string, list, set, zset, hash, stream, ReJSON-RL, TSDB-TYPE (TimeSeries)
- MBbloom-- (Bloom filter), MBbloomCF (Cuckoo filter), TopK-TYPE (Top-K), CMSk-TYPE (Count-Min Sketch), TDIS-TYPE (T-Digest)

## RedisBloom (Bloom filter, Cuckoo filter, Top-K, Count-Min Sketch, T-Digest)
- Bloom filter info: BF.INFO key
- Add to bloom: BF.ADD key item
- Check bloom: BF.EXISTS key item
- Create bloom: BF.RESERVE key error_rate capacity
- Cuckoo filter info: CF.INFO key
- Add to cuckoo: CF.ADD key item
- Check cuckoo: CF.EXISTS key item
- Delete from cuckoo: CF.DEL key item
- Create cuckoo: CF.RESERVE key capacity
- Top-K info: TOPK.INFO key
- Add to top-k: TOPK.ADD key item [item ...]
- List top-k: TOPK.LIST key WITHCOUNT
- Create top-k: TOPK.RESERVE key topk [width] [depth] [decay]
- Count-Min Sketch info: CMS.INFO key
- Increment CMS: CMS.INCRBY key item increment
- Query CMS: CMS.QUERY key item [item ...]
- Create CMS: CMS.INITBYDIM key width depth
- T-Digest info: TDIGEST.INFO key
- Add to T-Digest: TDIGEST.ADD key value [value ...]
- Query quantile: TDIGEST.QUANTILE key quantile [quantile ...]
- Create T-Digest: TDIGEST.CREATE key [COMPRESSION compression]
- "show all bloom keys" → SCAN 0 MATCH * TYPE MBbloom-- COUNT 10000
- "show all cuckoo keys" → SCAN 0 MATCH * TYPE MBbloomCF COUNT 10000

## VectorSet (Redis 8)
- Add vector: VADD key VALUES dim v1 v2 ... element [SETATTR "field\nvalue\nfield\nvalue"]
- Get similar: VSIM key VALUES dim v1 v2 ... [COUNT count]
- Get similar by element: VSIM key ELE element [COUNT count]
- Card: VCARD key
- Dimensions: VDIM key
- Get attributes: VGETATTR key element
- Set attributes: VSETATTR key element "field\nvalue"
- Remove element: VREM key element
- Info: VINFO key
- List elements: VLINKS key
- "show all vector keys" → SCAN 0 MATCH * TYPE vectorset COUNT 10000
- VSIM with filter (Redis 8.2+): VSIM key ELE element COUNT 10 FILTER "attr == 'value'"

## Redis 8.0+ Hash Per-Field TTL
- Get with expiry: HGETEX key FIELDS 1 field EX seconds
- Set with expiry: HSETEX key FIELDS 1 field value EX seconds
- Get and delete: HGETDEL key FIELDS 1 field
- "set hash field with TTL" → HSETEX key FIELDS 1 myfield myvalue EX 3600
- "get hash field and set expiry" → HGETEX key FIELDS 1 myfield EX 300

## Redis 8.2+ Stream Commands
- Delete with consumer group: XDELEX key id [GROUP group]

## Redis 8.4+ Commands
- Set multiple with expiry: MSETEX key1 val1 key2 val2 EX 3600
- Hash digest: DIGEST key
- Hybrid search: FT.HYBRID index "query" VECTOR field 10 vector_blob LIMIT 0 10

## Redis 8.6+ Stream Commands
- Stream IDMP config: XCFGSET key parameter value

# Critical Rules
- NEVER use FT.SEARCH or FT.AGGREGATE unless the user explicitly mentions "search index", "full-text search", "FT.", or "RediSearch"
- NEVER fabricate key names — if unsure, use patterns like KEYS * or KEYS prefix:*
- NEVER fabricate index names — if indexes are provided in context, use those exact names
- When the user mentions "rejson", "json keys", or "JSON type", they mean keys stored with the RedisJSON module
- Prefer simple commands — KEYS over SCAN for readability in a GUI console
- If the user asks something that needs multiple steps, output multiple commands (one per line)

## Bash Pipe Integration via EVAL Lua
If the user's input contains bash-style pipe operators (e.g. \`| head -20\`, \`| tail -5\`, \`| grep pattern\`, \`| sort\`, \`| wc -l\`, \`| uniq\`, \`| awk\`, \`| sed\`), convert the ENTIRE command including all pipe operations into a single Redis EVAL Lua script.
- Use only valid Redis Lua API: redis.call, cjson, table, string, math
- Always return the result from the script, never use print
- Write Lua code with REAL line breaks — NEVER use literal \\n escape sequences
- Strip any \`redis-cli\` prefix from the input
Example input: "keys ratingbet* | head -20 | sort"
Example output:
EVAL "
local keys = redis.call('KEYS', 'ratingbet*')
table.sort(keys)
local result = {}
for i = 1, math.min(20, #keys) do
  result[#result+1] = keys[i]
end
return result
" 0
---
Retrieves keys matching ratingbet*, sorts them alphabetically and returns the first 20`

function buildSystemPrompt(context) {
    let prompt = SYSTEM_PROMPT
    if (context) {
        const parts = []
        if (context.redisVersion) parts.push(`Redis version: ${context.redisVersion}`)
        if (context.redisMode) parts.push(`Mode: ${context.redisMode}`)
        if (context.usedMemory) parts.push(`Memory: ${context.usedMemory}`)
        if (context.connectedClients) parts.push(`Clients: ${context.connectedClients}`)
        if (context.os) parts.push(`OS: ${context.os}`)
        if (context.modules) parts.push(`Loaded modules: ${JSON.stringify(context.modules)}`)
        if (context.databases && context.databases.length > 0) parts.push(`Databases: ${context.databases.join(', ')}`)
        if (parts.length > 0) {
            prompt += `\n\n# Connected Redis Server\n${parts.join('\n')}`
        }
        if (context.indexes && context.indexes.length > 0) {
            prompt += `\n\nAvailable RediSearch indexes: ${context.indexes.join(', ')}`
        }
        if (context.schema) {
            prompt += `\n\nSchema information: ${JSON.stringify(context.schema)}`
        }
        if (context.uiLanguage && context.uiLanguage !== 'en') {
            prompt += `\n\n# Response Language\nThe user's GUI language is set to "${context.uiLanguage}". You MUST write the explanation (after the --- separator) in that language, regardless of what language the user types in.`
        } else {
            prompt += `\n\n# Response Language\nYou MUST write the explanation (after the --- separator) in the SAME language as the user's prompt. If they write in Hungarian, respond in Hungarian. If in English, respond in English. Always match the user's language.`
        }
    }
    return prompt
}

function getNetworkUrl() {
    if (typeof p3xrs.cfg.aiNetworkUrl === 'string' && p3xrs.cfg.aiNetworkUrl.length > 0) {
        return p3xrs.cfg.aiNetworkUrl
    }
    const isDev = process.env.NODE_ENV === 'development'
    return isDev ? AI_NETWORK_URL_DEV : AI_NETWORK_URL_PROD
}

function parseAiResponse(responseText) {
    const separatorIndex = responseText.indexOf('\n---')
    if (separatorIndex !== -1) {
        const command = responseText.substring(0, separatorIndex).trim()
        const explanation = responseText.substring(separatorIndex).replace(/^[\n\r]*---[\n\r]*/, '').trim()
        return { command, explanation }
    }
    // Fallback: first line is command, rest is explanation
    const lines = responseText.split('\n').filter(line => line.trim().length > 0)
    return {
        command: lines[0] || '',
        explanation: lines.slice(1).join(' ') || '',
    }
}

const disabledCommands = ['subscribe', 'monitor', 'quit', 'psubscribe']

// Commands that have cluster-aware overrides on the Cluster class.
// Using redis.call() bypasses these overrides, so we call the method directly.
const clusterOverriddenCommands = {
    flushdb: 'flushdb',
    flushall: 'flushall',
    dbsize: 'dbsize',
}

async function executeRedisCommand(redis, commandStr) {
    const tokens = parser(commandStr)
    if (tokens.length === 0) throw new Error('Empty command')
    const mainCommand = tokens.shift().toLowerCase()

    if (disabledCommands.includes(mainCommand)) {
        throw new Error(`Command '${mainCommand}' is not allowed`)
    }

    // Use the instance method for cluster-overridden commands so the
    // Cluster subclass can broadcast to all master nodes.
    const overrideMethod = clusterOverriddenCommands[mainCommand]
    if (overrideMethod && typeof redis[overrideMethod] === 'function') {
        return await redis[overrideMethod](...tokens)
    }

    return await redis.call(mainCommand, ...tokens)
}

async function callGroqDirect(prompt, context, apiKey) {
    const client = new Groq({ apiKey })
    const systemPrompt = buildSystemPrompt(context)

    const chatCompletion = await client.chat.completions.create({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
        ],
        model: 'openai/gpt-oss-120b',
        max_tokens: p3xrs.cfg.groqMaxTokens || 16384,
        temperature: 0,
    })

    const responseText = chatCompletion.choices?.[0]?.message?.content?.trim() || ''
    return parseAiResponse(responseText)
}

async function callNetworkProxy(prompt, context, apiKey) {
    const networkUrl = getNetworkUrl()
    let response
    try {
        response = await fetch(`${networkUrl}/public/ai/redis-query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                context: context || {},
                apiKey: apiKey || undefined,
            }),
        })
    } catch (fetchError) {
        throw new Error('AI service is not reachable')
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
        throw new Error(`AI service returned invalid response (${response.status})`)
    }

    const data = await response.json()
    if (data.status !== 'ok') {
        throw new Error(data.message || 'AI query failed')
    }

    return {
        command: data.data.command,
        explanation: data.data.explanation,
    }
}

export default async (options) => {
    const { socket, payload } = options

    try {
        const { prompt, context, execute } = payload

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            throw new Error('AI_PROMPT_REQUIRED')
        }

        if (prompt.length > 4096) {
            throw new Error('AI prompt too long (max 4096 characters)')
        }

        if (p3xrs.cfg.aiEnabled === false) {
            throw new Error('AI_DISABLED')
        }

        const apiKey = p3xrs.cfg.groqApiKey || ''
        const useOwnKey = p3xrs.cfg.aiUseOwnKey === true
        let result

        if (useOwnKey && apiKey) {
            console.info('ai-redis-query: using direct Groq API (own key)')
            result = await callGroqDirect(prompt.trim(), context, apiKey)
        } else {
            console.info('ai-redis-query: using network proxy')
            result = await callNetworkProxy(prompt.trim(), context, apiKey || undefined)
        }

        const response = {
            status: 'ok',
            command: result.command,
            explanation: result.explanation,
        }

        // Execute commands if requested and Redis client is available
        if (execute && socket.p3xrs.ioredis) {
            if (socket.p3xrs.readonly === true) {
                response.executed = false
                response.executionError = 'readonly-connection-mode'
            } else {
                const redis = socket.p3xrs.ioredis
                const commandLines = result.command.split('\n').filter(line => line.trim().length > 0)
                const executionResults = []

                for (const cmd of commandLines) {
                    try {
                        const cmdResult = await executeRedisCommand(redis, cmd)
                        executionResults.push({ command: cmd, result: cmdResult })
                    } catch (execError) {
                        executionResults.push({ command: cmd, error: execError.message })
                    }
                }

                response.executed = true
                response.results = executionResults
            }
        }

        socket.emit(options.responseEvent, response)
    } catch (e) {
        console.error('ai-redis-query error', e)
        let errorMsg = e.message || String(e)
        if (e.status === 403 || errorMsg.includes('blocked_api_access')) {
            errorMsg = 'blocked_api_access'
        } else if (e.status === 429 || errorMsg.includes('rate_limit')) {
            errorMsg = 'rate_limit'
        }
        socket.emit(options.responseEvent, {
            status: 'error',
            error: errorMsg,
        })
    }
}
