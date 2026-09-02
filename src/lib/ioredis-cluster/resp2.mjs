// ioredis 6 made RESP3 the default wire protocol. RESP3 changes the reply shape
// of every map-returning command (CONFIG GET, XPENDING, CLIENT INFO, MEMORY
// STATS, ...), and the console page executes arbitrary user commands while the
// key handlers parse RESP2 shapes. Keep the v5 protocol until that is migrated.
export const RESP_PROTOCOL = 2

export default function withResp2(server) {
    if (Array.isArray(server)) {
        return server.map(withResp2)
    }
    if (typeof server !== 'object' || server === null) {
        return server
    }
    return { protocol: RESP_PROTOCOL, ...server }
}
