import * as sharedIoRedis from '../../shared.mjs'
import { TOOL_SCHEMAS, runTool } from './tools.mjs'
import {
    buildSystemPrompt,
    callGroq,
    cleanAiText,
    parseAiResponse,
    summarizeMessages,
    truncateToolContent,
} from '../../../../lib/ai/prompt.mjs'

const parser = sharedIoRedis.argumentParser

// Max number of tool-call rounds per AI turn. Prevents runaway loops.
const MAX_AGENTIC_ITERATIONS = 5
// Hard cap on parallel tool calls within a single assistant turn.
const MAX_TOOL_CALLS_PER_TURN = 10
// Per-tool-result cap handled by the shared truncateToolContent() default (8000 chars).
// Total messages[] cap across one turn (~6K tokens). Groq free-tier TPM is 8K,
// leave headroom for the assistant's completion and the system prompt drift.
const MAX_TOTAL_MESSAGES_CHARS = 24000

const AI_NETWORK_URL_PROD = 'https://network.corifeus.com'
const AI_NETWORK_URL_DEV = 'http://localhost:8003'

// LANGUAGE_NAMES, buildLanguageInstruction, SYSTEM_PROMPT, LIMITED_AI_SYSTEM_PROMPT,
// and buildSystemPrompt now live in src/ai/prompt.mjs and are imported above.
// They are shared with network.corifeus.com (which syncs the file at build time).
// Edit the prompt in src/ai/prompt.mjs — NEVER copy it back into this file.


function getNetworkUrl() {
    if (typeof p3xrs.cfg.aiNetworkUrl === 'string' && p3xrs.cfg.aiNetworkUrl.length > 0) {
        return p3xrs.cfg.aiNetworkUrl
    }
    const isDev = process.env.NODE_ENV === 'development'
    return isDev ? AI_NETWORK_URL_DEV : AI_NETWORK_URL_PROD
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
    const model = 'openai/gpt-oss-120b'
    const maxTokens = p3xrs.cfg.groqMaxTokens || 65536

    if (useOwnKey && apiKey) {
        // Direct: use the shared callGroq wrapper (same one network.corifeus.com uses).
        const completion = await callGroq({ messages, tools, apiKey, model, maxTokens })
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

const messagesCharCount = (messages) => summarizeMessages(messages).chars

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
    const systemPrompt = buildSystemPrompt(context, { includeToolUse: true })
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
