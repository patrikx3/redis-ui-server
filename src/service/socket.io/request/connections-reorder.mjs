import fs from 'fs'
import * as sharedIoRedis from '../shared.mjs'

export default async (options) => {
    const {socket} = options;

    try {
        sharedIoRedis.ensureReadonlyConnections()

        const { group, ids } = options.payload;
        if (!Array.isArray(ids) || ids.length === 0) {
            socket.emit(options.responseEvent, { status: 'ok' })
            return
        }

        // Build a lookup of current connections by id
        const byId = new Map()
        for (const conn of p3xrs.connections.list) {
            byId.set(conn.id, conn)
        }

        if (group !== undefined) {
            // Reorder within a specific group
            const reordered = []
            for (const id of ids) {
                const conn = byId.get(id)
                if (conn) {
                    reordered.push(conn)
                }
            }

            // Rebuild the full list preserving the relative position of groups
            const newList = []
            let groupInserted = false
            const targetGroup = (group || '').trim()
            for (const conn of p3xrs.connections.list) {
                const connGroup = (conn.group || '').trim()
                if (connGroup === targetGroup) {
                    if (!groupInserted) {
                        newList.push(...reordered)
                        groupInserted = true
                    }
                } else {
                    newList.push(conn)
                }
            }
            if (!groupInserted) {
                newList.push(...reordered)
            }

            p3xrs.connections.list = newList
        } else {
            // Full reorder (e.g. dragging groups) — ids contains all connection ids in new order
            const newList = []
            for (const id of ids) {
                const conn = byId.get(id)
                if (conn) {
                    newList.push(conn)
                }
            }
            // Append any connections not in the ids list (safety)
            for (const conn of p3xrs.connections.list) {
                if (!ids.includes(conn.id)) {
                    newList.push(conn)
                }
            }
            p3xrs.connections.list = newList
        }

        p3xrs.connections.update = new Date()
        fs.writeFileSync(p3xrs.cfg.connections.home, JSON.stringify(p3xrs.connections, null, 4))

        socket.emit(options.responseEvent, { status: 'ok' })

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message
        })
    } finally {
        sharedIoRedis.sendConnections({ socket })
    }
}
