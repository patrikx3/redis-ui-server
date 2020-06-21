const sharedIoRedis = require('../shared')

module.exports = async (options) => {
    const {socket} = options;

    const connectionSaveId = options.payload.id;
    let connectionIndexExisting;
    let disableReadonlyConnections = true

    try {
        sharedIoRedis.ensureReadonlyConnections()
        disableReadonlyConnections = false

        for (let connectionIndex in p3xrs.connections.list) {
            const connection = p3xrs.connections.list[connectionIndex]
            if (connection.id === connectionSaveId) {
                connectionIndexExisting = connectionIndex
                break;
            }
        }

        if (connectionIndexExisting !== undefined) {
            p3xrs.connections.list.splice(connectionIndexExisting, 1)
            p3xrs.connections.update = new Date()
            const fs = require('fs')
            fs.writeFileSync(p3xrs.cfg.connections.home, JSON.stringify(p3xrs.connections, null, 4))
        }
        socket.emit(options.responseEvent, {
            status: 'ok',
        })
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message
        })
    } finally {
        if (!disableReadonlyConnections) {
            sharedIoRedis.sendConnections({
                socket: socket,
            })


            sharedIoRedis.triggerDisconnect({
                connectionId: connectionSaveId,
                code: 'delete-connection',
                socket: socket,
            })
        }
    }

}
