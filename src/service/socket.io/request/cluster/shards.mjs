export default async (options) => {
    const { socket } = options
    try {
        const redis = socket.p3xrs.ioredis
        if (!redis) {
            socket.emit(options.responseEvent, { status: 'error', error: 'Not connected to Redis' })
            return
        }

        let shards
        try {
            // Redis 7.0+ — flat array shard data, needs parsing
            const raw = await redis.call('CLUSTER', 'SHARDS')
            shards = parseClusterShards(raw)
        } catch {
            // Fallback to CLUSTER SLOTS (Redis 3.0+)
            const slots = await redis.call('CLUSTER', 'SLOTS')
            shards = parseClusterSlots(slots)
        }

        socket.emit(options.responseEvent, { status: 'ok', data: { shards } })
    } catch (e) {
        console.error('cluster/shards failed', e)
        socket.emit(options.responseEvent, { status: 'error', error: e.message })
    }
}

// Parse flat array from CLUSTER SHARDS (Redis 7+)
// Each shard: ["slots", [start, end], "nodes", [[flat node...], ...]]
function parseClusterShards(raw) {
    return raw.map(entry => {
        const map = {}
        for (let i = 0; i < entry.length; i += 2) {
            map[entry[i]] = entry[i + 1]
        }
        const slotArr = map.slots || []
        const slotRanges = []
        for (let i = 0; i < slotArr.length; i += 2) {
            slotRanges.push([slotArr[i], slotArr[i + 1]])
        }
        const nodes = (map.nodes || []).map(nodeArr => {
            const node = {}
            for (let i = 0; i < nodeArr.length; i += 2) {
                node[nodeArr[i]] = nodeArr[i + 1]
            }
            return { host: node.ip || node.endpoint, port: node.port, id: node.id, role: node.role }
        })
        const master = nodes.find(n => n.role === 'master') || nodes[0] || { host: '?', port: 0, id: '?' }
        const replicas = nodes.filter(n => n.role !== 'master')
        return { slotRanges, master, replicas }
    })
}

function parseClusterSlots(slots) {
    // CLUSTER SLOTS returns: [[startSlot, endSlot, [masterIP, port, id], [replicaIP, port, id], ...], ...]
    const shardMap = new Map()
    for (const entry of slots) {
        const start = entry[0]
        const end = entry[1]
        const masterInfo = entry[2]
        const masterId = masterInfo[2] || `${masterInfo[0]}:${masterInfo[1]}`

        if (!shardMap.has(masterId)) {
            shardMap.set(masterId, {
                slotRanges: [],
                master: { host: masterInfo[0], port: masterInfo[1], id: masterId },
                replicas: [],
            })
        }
        const shard = shardMap.get(masterId)
        shard.slotRanges.push([start, end])

        // Replicas are entries[3], entries[4], etc.
        for (let i = 3; i < entry.length; i++) {
            const rep = entry[i]
            const repId = rep[2] || `${rep[0]}:${rep[1]}`
            if (!shard.replicas.find(r => r.id === repId)) {
                shard.replicas.push({ host: rep[0], port: rep[1], id: repId })
            }
        }
    }
    return Array.from(shardMap.values())
}
