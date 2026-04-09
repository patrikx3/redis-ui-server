/**
 * CLUSTER SLOT-STATS — per-slot usage metrics (Redis 8.2+, cluster only)
 * Returns top slots by key count, CPU, or memory.
 */
export default async (options) => {
    const { socket, payload } = options

    try {
        const redis = socket.p3xrs.ioredis
        const { metric = 'KEY-COUNT', limit = 20, order = 'DESC' } = payload

        const raw = await redis.call('CLUSTER', 'SLOT-STATS', 'ORDERBY', metric, order, 'LIMIT', limit)

        // Parse flat array of [slot, [metric, value, ...], ...]
        const slots = []
        if (Array.isArray(raw)) {
            for (const entry of raw) {
                if (Array.isArray(entry) && entry.length >= 2) {
                    const slotNum = entry[0]
                    const metrics = {}
                    if (Array.isArray(entry[1])) {
                        for (let i = 0; i < entry[1].length; i += 2) {
                            metrics[entry[1][i]] = parseInt(entry[1][i + 1]) || 0
                        }
                    }
                    slots.push({ slot: slotNum, ...metrics })
                }
            }
        }

        socket.emit(options.responseEvent, {
            status: 'ok',
            slots,
        })
    } catch (e) {
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }
}
