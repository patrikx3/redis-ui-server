// Shared AI Redis-query core for both callers:
//   1. redis-ui-server — agentic tool-use loop when the user supplies
//      their own Groq API key; otherwise proxies through network.
//   2. network.corifeus.com /public/ai/redis-query — plain single-shot
//      chat completion (no tool execution here; tools are executed
//      in redis-ui-server which has the live Redis connection).
//
// What lives here (all shared):
//   - LANGUAGE_NAMES, buildLanguageInstruction
//   - SYSTEM_PROMPT, LIMITED_AI_SYSTEM_PROMPT, TOOL_USE_PROMPT
//   - buildSystemPrompt()
//   - cleanAiText(), parseAiResponse()
//   - estimateTokens(), summarizeMessages(), truncateToolContent()
//   - callGroq(), runSingleShotQuery()
//
// Each caller keeps only its own interface layer (Express req/res,
// Socket.IO events, agentic loop, mongoose persistence, metrics).
//
// network.corifeus.com syncs a copy at build time via `yarn sync:prompt`.
// Edit here only — never edit the synced copy in network.

import Groq from 'groq-sdk';

// Map the 54 supported p3x-redis-ui GUI locale codes to human-readable language
// names. Naming the language by code alone (e.g. "en") sometimes causes
// Groq/oss-120b to default to whichever language the developer mentioned most
// in the prompt (Hungarian, in our case).
export const LANGUAGE_NAMES = {
    ar: 'Arabic', az: 'Azerbaijani', be: 'Belarusian', bg: 'Bulgarian',
    bn: 'Bengali', bs: 'Bosnian', cs: 'Czech', da: 'Danish', de: 'German',
    el: 'Greek', en: 'English', es: 'Spanish', et: 'Estonian', fi: 'Finnish',
    fil: 'Filipino', fr: 'French', he: 'Hebrew', hr: 'Croatian', hu: 'Hungarian',
    hy: 'Armenian', id: 'Indonesian', it: 'Italian', ja: 'Japanese', ka: 'Georgian',
    kk: 'Kazakh', km: 'Khmer', ko: 'Korean', ky: 'Kyrgyz', lt: 'Lithuanian',
    mk: 'Macedonian', ms: 'Malay', ne: 'Nepali', nl: 'Dutch', no: 'Norwegian',
    pl: 'Polish', 'pt-BR': 'Brazilian Portuguese', 'pt-PT': 'Portuguese',
    ro: 'Romanian', ru: 'Russian', si: 'Sinhala', sk: 'Slovak', sl: 'Slovenian',
    sr: 'Serbian', sv: 'Swedish', sw: 'Swahili', ta: 'Tamil', tg: 'Tajik',
    th: 'Thai', tr: 'Turkish', uk: 'Ukrainian', vi: 'Vietnamese',
    'zh-HK': 'Traditional Chinese (Hong Kong)', 'zh-TW': 'Traditional Chinese (Taiwan)',
    zn: 'Simplified Chinese',
};

export function buildLanguageInstruction(context) {
    const code = context?.uiLanguage;
    if (code) {
        const name = LANGUAGE_NAMES[code] || code;
        return `\n\n# Response Language\nThe user's GUI is in ${name} (locale: ${code}). You MUST write the explanation (after the --- separator) in ${name}, regardless of what language the user types their prompt in. Only use ${name} — do not switch to any other language.`;
    }
    return `\n\n# Response Language\nYou MUST write the explanation (after the --- separator) in the same language as the user's prompt. Match the language of the user's input exactly — if they write in English, respond in English.`;
}

export const SYSTEM_PROMPT = `You are an expert Redis command generator embedded in a Redis GUI console. Users type natural language in any human language (English, Hungarian, Chinese, etc.) and you translate it into valid Redis CLI commands.

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
- The explanation language is specified in the "Response Language" section at the end of this prompt — follow it exactly

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
- vectorset (VectorSet)

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
- Add vector: VADD key VALUES dim v1 v2 ... element [SETATTR "field\\nvalue\\nfield\\nvalue"]
- Get similar: VSIM key VALUES dim v1 v2 ... [COUNT count]
- Get similar by element: VSIM key ELE element [COUNT count]
- Card: VCARD key
- Dimensions: VDIM key
- Get attributes: VGETATTR key element
- Set attributes: VSETATTR key element "field\\nvalue"
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
Retrieves keys matching ratingbet*, sorts them alphabetically and returns the first 20`;

export const LIMITED_AI_SYSTEM_PROMPT = `You are the p3x-redis-ui assistant in LIMITED MODE. The user is NOT currently connected to any Redis server — so you have no live state to inspect and no index, key, or module information to draw on.

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

If no command is appropriate (pure explanation, or refusal of a live-state question), output only the --- separator followed by the explanation.`;

// Appended to SYSTEM_PROMPT when the consumer can actually run tool calls
// (only redis-ui-server's agentic loop can — network proxies a plain chat).
export const TOOL_USE_PROMPT = `\n\n# Tool use — live state inspection
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
tool results show, not dump raw output.`;

// Strip markdown the model sometimes emits so the console renders plain text
// that matches regular command output styling:
//   - leading/trailing --- separators
//   - ```lang ... ``` fences
//   - stray **bold** and `inline code` wrapping
export function cleanAiText(s) {
    if (typeof s !== 'string') return '';
    let out = s;
    out = out.replace(/^\s*-{3,}\s*/g, '').replace(/\s*-{3,}\s*$/g, '');
    out = out.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)\n?```/g, '$1');
    out = out.replace(/```/g, '');
    out = out.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1');
    out = out.replace(/`([^`]+)`/g, '$1');
    return out.trim();
}

// Parse the model's assistant content into { command, explanation }.
// The model is instructed to output `COMMAND\n---\nEXPLANATION`.
export function parseAiResponse(responseText) {
    const separatorIndex = responseText.indexOf('\n---');
    if (separatorIndex !== -1) {
        const command = cleanAiText(responseText.substring(0, separatorIndex));
        const explanation = cleanAiText(responseText.substring(separatorIndex).replace(/^[\n\r]*---[\n\r]*/, ''));
        return { command, explanation };
    }
    // Fallback: first line is command, rest is explanation
    const cleaned = cleanAiText(responseText);
    const lines = cleaned.split('\n').filter((line) => line.trim().length > 0);
    return {
        command: lines[0] || '',
        explanation: lines.slice(1).join('\n') || '',
    };
}

// Unified builder shared by both callers.
// Pass `{ includeToolUse: true }` from redis-ui-server; omit from network (no tools available there).
export function buildSystemPrompt(context, { includeToolUse = false } = {}) {
    if (context && (context.connectionState === 'none' || context.connectionState === 'connecting')) {
        return LIMITED_AI_SYSTEM_PROMPT + buildLanguageInstruction(context);
    }

    let prompt = SYSTEM_PROMPT;

    if (includeToolUse && context?.connectionState === 'connected') {
        prompt += TOOL_USE_PROMPT;
    }

    if (context) {
        const parts = [];
        if (context.redisVersion) parts.push(`Redis version: ${context.redisVersion}`);
        if (context.redisMode) parts.push(`Mode: ${context.redisMode}`);
        if (context.usedMemory) parts.push(`Memory: ${context.usedMemory}`);
        if (context.connectedClients) parts.push(`Clients: ${context.connectedClients}`);
        if (context.os) parts.push(`OS: ${context.os}`);
        if (context.modules) parts.push(`Loaded modules: ${JSON.stringify(context.modules)}`);
        if (context.databases && context.databases.length > 0) parts.push(`Databases: ${context.databases.join(', ')}`);
        if (context.connectionName) parts.push(`Connection name: ${context.connectionName}`);
        if (context.currentDatabase !== undefined) parts.push(`Current database: ${context.currentDatabase}`);
        if (context.currentPage) parts.push(`Current GUI page: ${context.currentPage}`);
        if (parts.length > 0) {
            prompt += `\n\n# Connected Redis Server\n${parts.join('\n')}`;
        }
        if (context.indexes && context.indexes.length > 0) {
            prompt += `\n\nAvailable RediSearch indexes: ${context.indexes.join(', ')}`;
        }
        if (context.schema) {
            prompt += `\n\nSchema information: ${JSON.stringify(context.schema)}`;
        }
        if (context.keyPatterns && context.keyPatterns.length > 0) {
            prompt += `\n\nKey patterns in use: ${context.keyPatterns.join(', ')}`;
        }
        prompt += buildLanguageInstruction(context);
    }

    return prompt;
}

// ─── Generic utilities ────────────────────────────────────────────────────

// Rough token count from character count (Groq/OpenAI chat completions use ~4 chars per token).
export function estimateTokens(chars) {
    return Math.ceil(chars / 4);
}

// Summarise a messages[] array for logging: total chars, role breakdown, tool-call count.
export function summarizeMessages(messages) {
    if (!Array.isArray(messages)) return { count: 0, chars: 0, roles: {}, toolCalls: 0 };
    let chars = 0;
    const roles = {};
    let toolCalls = 0;
    for (const m of messages) {
        roles[m.role] = (roles[m.role] || 0) + 1;
        if (typeof m.content === 'string') chars += m.content.length;
        if (Array.isArray(m.tool_calls)) {
            toolCalls += m.tool_calls.length;
            chars += JSON.stringify(m.tool_calls).length;
        }
    }
    return { count: messages.length, chars, roles, toolCalls };
}

// Truncate a tool result string to avoid blowing the model's context window.
// Default 8 KB (~2K tokens) matches redis-ui-server's original MAX_TOOL_RESULT_CHARS.
export function truncateToolContent(content, maxChars = 8000) {
    const str = typeof content === 'string' ? content : String(content ?? '');
    if (str.length <= maxChars) return str;
    const kept = str.slice(0, maxChars);
    return `${kept}\n... [truncated ${str.length - maxChars} chars — result too large for token budget]`;
}

// ─── Groq wrappers ────────────────────────────────────────────────────────

// Thin wrapper around Groq chat.completions.create. Caller provides the key,
// model, and messages; tool_choice is only set when tools are provided.
export async function callGroq({ messages, tools, apiKey, model, maxTokens, temperature = 0 }) {
    if (!apiKey) throw new Error('callGroq: apiKey is required');
    const client = new Groq({ apiKey });
    const payload = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
    };
    if (Array.isArray(tools) && tools.length > 0) {
        payload.tools = tools;
        payload.tool_choice = 'auto';
    }
    return await client.chat.completions.create(payload);
}

// Single-shot redis-query: build system prompt, call Groq with [system, user],
// parse the response into { command, explanation }. No tool use (that's the
// agentic loop's job — only redis-ui-server runs it). Returns the parsed
// fields plus usage + raw assistant message for the caller's bookkeeping.
export async function runSingleShotQuery({
    prompt,
    context,
    apiKey,
    model,
    maxTokens,
    temperature = 0,
    includeToolUse = false,
}) {
    const systemPrompt = buildSystemPrompt(context, { includeToolUse });
    const completion = await callGroq({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: String(prompt).trim() },
        ],
        apiKey,
        model,
        maxTokens,
        temperature,
    });
    const message = completion.choices?.[0]?.message || {};
    const responseText = (message.content || '').trim();
    return {
        ...parseAiResponse(responseText),
        usage: completion.usage || {},
        assistantMessage: message,
        responseText,
    };
}
