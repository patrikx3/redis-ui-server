import Groq from 'groq-sdk'
import * as sharedIoRedis from '../../shared.mjs'
import { TOOL_SCHEMAS, runTool } from './tools.mjs'

const parser = sharedIoRedis.argumentParser

// Max number of tool-call rounds per AI turn. Prevents runaway loops.
const MAX_AGENTIC_ITERATIONS = 5
// Hard cap on parallel tool calls within a single assistant turn.
const MAX_TOOL_CALLS_PER_TURN = 10
// Per-tool-result cap (~2K tokens at ~4 chars/token). A single SCAN can dump
// thousands of keys; without this cap the messages[] balloons and Groq 413s.
const MAX_TOOL_RESULT_CHARS = 8000
// Total messages[] cap across one turn (~6K tokens). Groq free-tier TPM is 8K,
// leave headroom for the assistant's completion and the system prompt drift.
const MAX_TOTAL_MESSAGES_CHARS = 24000

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

const LIMITED_AI_SYSTEM_PROMPT = `You are the p3x-redis-ui assistant in LIMITED MODE. The user is NOT currently connected to any Redis server — so you have no live state to inspect and no index, key, or module information to draw on.

You CAN answer:
- General Redis knowledge questions ("what is ZADD?", "how does cluster failover work?", "explain Lua scripting in Redis")
- Syntax help for any Redis command
- Conceptual questions about Redis modules (RedisJSON, RediSearch, RedisTimeSeries, RedisBloom, Vector sets)
- Lua/EVAL script authoring based on the user's description (output the script, do not execute it)
- Generic "how do I" questions that don't need live data

You MUST REFUSE and ask the user to connect first (via the GUI connection list) when they ask for:
- "why is memory high?", "show my slow queries", "which clients are connected?"
- any question that needs INFO, SLOWLOG, CLIENT LIST, MEMORY STATS, CONFIG, DBSIZE, SCAN
- "describe key X", "find keys with TTL < Y", "show the biggest hash"
- anything that presumes a live connection

# Output Format
One or more Redis commands (one per line), then a separator, then an explanation:

\`\`\`
COMMAND1
---
Brief explanation in the user's language
\`\`\`

If no command is appropriate (pure explanation, or refusal of a live-state question), output only the --- separator followed by the explanation.`

function buildSystemPrompt(context) {
    // Limited-AI mode: user is not connected. Use the shorter prompt that refuses
    // live-state questions and answers only general Redis knowledge.
    if (context && (context.connectionState === 'none' || context.connectionState === 'connecting')) {
        let prompt = LIMITED_AI_SYSTEM_PROMPT
        if (context.uiLanguage && context.uiLanguage !== 'en') {
            prompt += `\n\n# Response Language\nThe user's GUI language is set to "${context.uiLanguage}". You MUST write the explanation (after the --- separator) in that language, regardless of what language the user types in.`
        } else {
            prompt += `\n\n# Response Language\nYou MUST write the explanation (after the --- separator) in the SAME language as the user's prompt. If they write in Hungarian, respond in Hungarian. If in English, respond in English. Always match the user's language.`
        }
        return prompt
    }

    // Full connected mode: include all Redis context the client supplied.
    let prompt = SYSTEM_PROMPT

    // Tool-use guidance (only when tools are available — i.e. connected + server-driven).
    if (context?.connectionState === 'connected') {
        prompt += `\n\n# Tool use — live state inspection
You have tools (redis_info, redis_memory_stats, redis_slowlog_get, redis_client_list, redis_config_get, redis_dbsize, redis_latency_latest, redis_scan, redis_type, redis_ttl, redis_memory_usage, redis_cluster_info, redis_cluster_nodes, redis_acl_whoami, redis_module_list) that run read-only Redis commands against the user's connection and return live results.

When to use tools:
- "why is memory high?" → call redis_info(section="memory") and redis_memory_stats, then explain
- "show slow queries" → call redis_slowlog_get, then summarise
- "who is connected?" → call redis_client_list, then summarise
- "what is maxmemory set to?" → call redis_config_get(pattern="maxmemory*"), then answer
- "how many keys per database?" → call redis_info(section="keyspace") + redis_dbsize
- Diagnostics, metrics, live state → tools first, answer second

When NOT to use tools:
- "what does ZADD do?" / "write a lua script to …" → answer from general knowledge, no tools
- Command-generation requests ("delete key foo", "set key bar to 1") → just output the command, do NOT execute it
- Anything the user can see or do themselves — don't burn tokens on redundant tool calls

After tool calls, return the final answer in the normal Output Format
(commands + "---" + explanation). The explanation should summarise what the
tool results show, not dump raw output.`
    }

    if (context) {
        const parts = []
        if (context.redisVersion) parts.push(`Redis version: ${context.redisVersion}`)
        if (context.redisMode) parts.push(`Mode: ${context.redisMode}`)
        if (context.usedMemory) parts.push(`Memory: ${context.usedMemory}`)
        if (context.connectedClients) parts.push(`Clients: ${context.connectedClients}`)
        if (context.os) parts.push(`OS: ${context.os}`)
        if (context.modules) parts.push(`Loaded modules: ${JSON.stringify(context.modules)}`)
        if (context.databases && context.databases.length > 0) parts.push(`Databases: ${context.databases.join(', ')}`)
        if (context.connectionName) parts.push(`Connection name: ${context.connectionName}`)
        if (context.currentDatabase !== undefined) parts.push(`Current database: ${context.currentDatabase}`)
        if (context.currentPage) parts.push(`Current GUI page: ${context.currentPage}`)
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

// Strip markdown the model sometimes emits so the console renders plain text
// that matches regular command output styling:
//   - leading/trailing --- separators
//   - ```lang ... ``` fences
//   - stray **bold** and `inline code` wrapping
function cleanAiText(s) {
    if (typeof s !== 'string') return ''
    let out = s
    // Strip leading/trailing --- markers and surrounding blank lines
    out = out.replace(/^\s*-{3,}\s*/g, '').replace(/\s*-{3,}\s*$/g, '')
    // Remove ```lang ... ``` code fences (keep inner content)
    out = out.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)\n?```/g, '$1')
    // Drop bare ``` leftovers
    out = out.replace(/```/g, '')
    // Unwrap **bold** and *italic* — plain text only
    out = out.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    // Unwrap `inline code`
    out = out.replace(/`([^`]+)`/g, '$1')
    return out.trim()
}

function parseAiResponse(responseText) {
    const separatorIndex = responseText.indexOf('\n---')
    if (separatorIndex !== -1) {
        const command = cleanAiText(responseText.substring(0, separatorIndex))
        const explanation = cleanAiText(responseText.substring(separatorIndex).replace(/^[\n\r]*---[\n\r]*/, ''))
        return { command, explanation }
    }
    // Fallback: first line is command, rest is explanation
    const cleaned = cleanAiText(responseText)
    const lines = cleaned.split('\n').filter(line => line.trim().length > 0)
    return {
        command: lines[0] || '',
        explanation: lines.slice(1).join('\n') || '',
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

/**
 * Single Groq chat completion — either direct (own key) or via network proxy.
 * For tool-use, the server drives the loop locally (it has the Redis connection);
 * this function just returns the raw assistant message from one round-trip.
 */
async function callGroqMessages({ messages, tools, apiKey, useOwnKey }) {
    const payload = {
        model: 'openai/gpt-oss-120b',
        messages,
        max_tokens: p3xrs.cfg.groqMaxTokens || 65536,
        temperature: 0,
    }
    if (tools && tools.length > 0) {
        payload.tools = tools
        payload.tool_choice = 'auto'
    }

    if (useOwnKey && apiKey) {
        const client = new Groq({ apiKey })
        const completion = await client.chat.completions.create(payload)
        return completion.choices?.[0]?.message || {}
    }

    const networkUrl = getNetworkUrl()
    let response
    try {
        response = await fetch(`${networkUrl}/public/ai/redis-query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // Tool-use / agentic path: the client drives the loop, the proxy
                // forwards the full message history + tool schemas to Groq and
                // returns the raw assistant message. Legacy fields stay for
                // backward compatibility with older proxy versions.
                messages,
                tools: tools && tools.length > 0 ? tools : undefined,
                apiKey: apiKey || undefined,
            }),
        })
    } catch {
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
    // Tool-capable proxy response: data.data.message = full Groq message object.
    // Legacy proxy response: data.data = { command, explanation } — wrap it.
    if (data.data?.message) return data.data.message
    if (data.data?.command !== undefined) {
        return {
            role: 'assistant',
            content: (data.data.command || '') + (data.data.explanation ? '\n---\n' + data.data.explanation : ''),
        }
    }
    return { role: 'assistant', content: '' }
}

function truncateToolContent(content) {
    const str = typeof content === 'string' ? content : String(content ?? '')
    if (str.length <= MAX_TOOL_RESULT_CHARS) return str
    const kept = str.slice(0, MAX_TOOL_RESULT_CHARS)
    return `${kept}\n... [truncated ${str.length - MAX_TOOL_RESULT_CHARS} chars — result too large for token budget]`
}

function messagesCharCount(messages) {
    let n = 0
    for (const m of messages) {
        if (typeof m.content === 'string') n += m.content.length
        if (m.tool_calls) n += JSON.stringify(m.tool_calls).length
    }
    return n
}

// Always compress older tool results before each Groq call, regardless of
// total size. Only the most-recent batch (tool results that follow the last
// assistant-with-tool_calls message) is kept in full — the AI needs that
// detail to decide its next move. Everything earlier becomes a one-line
// breadcrumb so the conversation can never balloon, even across many rounds.
function compressOlderToolResults(messages) {
    let lastAsstToolsIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]
        if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
            lastAsstToolsIdx = i
            break
        }
    }
    for (let i = 0; i < lastAsstToolsIdx; i++) {
        const m = messages[i]
        if (m.role !== 'tool' || typeof m.content !== 'string') continue
        if (m.content.startsWith('[prior tool result')) continue
        const preview = m.content.slice(0, 150).replace(/\s+/g, ' ')
        m.content = `[prior tool result summarized: ${preview}${m.content.length > 150 ? '...' : ''}]`
    }
}

// Safety net: if compression left things still too large (e.g. a single huge
// current tool result combined with a long system prompt), fall back to
// summarizing everything older than the latest assistant message.
function enforceMessagesBudget(messages) {
    if (messagesCharCount(messages) <= MAX_TOTAL_MESSAGES_CHARS) return
    for (let i = 0; i < messages.length; i++) {
        if (messagesCharCount(messages) <= MAX_TOTAL_MESSAGES_CHARS) return
        const m = messages[i]
        if (m.role !== 'tool') continue
        if (typeof m.content === 'string' && m.content.length > 200) {
            m.content = `[earlier tool result — summarized: ${m.content.slice(0, 150)}...]`
        }
    }
}

/**
 * Agentic loop — asks Groq, executes any tool calls locally against the user's
 * Redis connection, feeds results back, repeats up to MAX_AGENTIC_ITERATIONS.
 * Returns { command, explanation, toolTrail }.
 *
 * Tools are only offered when `redis` is available (connected) AND context
 * indicates we are in connected mode. Limited/disconnected mode uses the
 * existing shorter prompt with no tools.
 */
async function runAgenticLoop({ prompt, context, apiKey, useOwnKey, redis }) {
    const systemPrompt = buildSystemPrompt(context)
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
    ]

    const toolsAvailable = redis && context?.connectionState === 'connected'
    const tools = toolsAvailable ? TOOL_SCHEMAS : []
    const toolTrail = []

    for (let iter = 0; iter < MAX_AGENTIC_ITERATIONS; iter++) {
        compressOlderToolResults(messages)
        enforceMessagesBudget(messages)
        const assistantMessage = await callGroqMessages({ messages, tools, apiKey, useOwnKey })
        messages.push(assistantMessage)

        const toolCalls = assistantMessage.tool_calls || []
        if (toolCalls.length === 0) {
            // Final answer — parse command + explanation from content
            const content = (assistantMessage.content || '').trim()
            const parsed = parseAiResponse(content)
            return { ...parsed, toolTrail }
        }

        // Execute each tool call (capped), append tool results as tool-role messages.
        // Hard guard: if there is no live Redis connection, refuse to run tools — this
        // should be unreachable because we pass `tools: []` when toolsAvailable is
        // false, but the model might still request tools on older proxies. Fail safe.
        const callsToRun = toolCalls.slice(0, MAX_TOOL_CALLS_PER_TURN)
        for (const call of callsToRun) {
            let args = {}
            try { args = JSON.parse(call.function?.arguments || '{}') } catch { args = {} }
            const name = call.function?.name || ''
            let exec
            if (!toolsAvailable) {
                exec = { ok: false, error: 'Not connected to Redis — tools are unavailable.', ms: 0 }
            } else {
                exec = await runTool(redis, name, args)
            }
            toolTrail.push({
                name,
                args,
                ok: exec.ok,
                result: exec.result,
                error: exec.error,
                ms: exec.ms,
            })
            messages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: exec.ok
                    ? truncateToolContent(exec.result)
                    : `ERROR: ${exec.error}`,
            })
        }
        // Loop again so the model can react to the tool results.
    }

    // Hit the iteration cap without a final answer — synthesize a fallback.
    return {
        command: '',
        explanation: 'AI investigation exceeded the tool-call limit without reaching a conclusion. Partial tool trail below.',
        toolTrail,
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
        // Only pass a Redis client into the agentic loop when BOTH the client
        // reports connected state AND the socket has a live ioredis. Stale
        // ioredis (from a prior disconnected session) must not be used.
        const redis = (context?.connectionState === 'connected' && socket.p3xrs?.ioredis)
            ? socket.p3xrs.ioredis
            : null

        console.info(
            useOwnKey && apiKey
                ? 'ai-redis-query: using direct Groq API (own key)'
                : 'ai-redis-query: using network proxy',
            '— tools',
            redis ? 'enabled' : 'disabled',
        )

        const result = await runAgenticLoop({
            prompt: prompt.trim(),
            context,
            apiKey: apiKey || undefined,
            useOwnKey: useOwnKey && Boolean(apiKey),
            redis,
        })

        const response = {
            status: 'ok',
            command: result.command,
            explanation: result.explanation,
            toolTrail: result.toolTrail,
        }

        // Execute commands if requested AND we have a live Redis connection.
        // The `redis` variable above is gated on connectionState==='connected';
        // if absent, skip execution entirely — no stale client runs.
        if (execute && redis) {
            if (socket.p3xrs.readonly === true) {
                response.executed = false
                response.executionError = 'readonly-connection-mode'
            } else {
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
