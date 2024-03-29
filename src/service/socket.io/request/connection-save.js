const sharedIoRedis = require('../shared')

module.exports = async (options) => {
    const {socket} = options;

    const connectionSave = options.payload.model;

    let disableReadonlyConnections = true

    try {
        sharedIoRedis.ensureReadonlyConnections()
        disableReadonlyConnections = false

        let connectionIndexExisting;
        for (let connectionIndex in p3xrs.connections.list) {
            const connection = p3xrs.connections.list[connectionIndex]
            if (connection.id === connectionSave.id) {
                connectionIndexExisting = connectionIndex
                break;
            }
        }
        p3xrs.connections.update = new Date()
        if (connectionIndexExisting !== undefined) {

            if (p3xrs.connections.list[connectionIndexExisting].id === connectionSave.password) {
                connectionSave.password = p3xrs.connections.list[connectionIndexExisting].password;
            }
            if (p3xrs.connections.list[connectionIndexExisting].id === connectionSave.tlsCrt) {
                connectionSave.tlsCrt = p3xrs.connections.list[connectionIndexExisting].tlsCrt;
            }
            if (p3xrs.connections.list[connectionIndexExisting].id === connectionSave.tlsKey) {
                connectionSave.tlsKey = p3xrs.connections.list[connectionIndexExisting].tlsKey;
            }
            if (p3xrs.connections.list[connectionIndexExisting].id === connectionSave.tlsCa) {
                connectionSave.tlsCa = p3xrs.connections.list[connectionIndexExisting].tlsCa;
            }
            if (p3xrs.connections.list[connectionIndexExisting].id === connectionSave.tlsCa) {
                connectionSave.tlsCa = p3xrs.connections.list[connectionIndexExisting].tlsCa;
            }
            if (p3xrs.connections.list[connectionIndexExisting].id === connectionSave.sshPassword) {
                connectionSave.sshPassword = p3xrs.connections.list[connectionIndexExisting].sshPassword
            }
            if (p3xrs.connections.list[connectionIndexExisting].id === connectionSave.sshPrivateKey) {
                connectionSave.sshPrivateKey = p3xrs.connections.list[connectionIndexExisting].sshPrivateKey
            }


            //TODO fix secured nodes password
            if (Array.isArray(connectionSave.nodes)) {
                for (let node of connectionSave.nodes) {
                    const findNode = p3xrs.connections.list[connectionIndexExisting].nodes.find((findNode) => {
                        return findNode.id === node.id && node.password === findNode.id
                    })
                    if (findNode !== undefined) {
                        node.password = findNode.password
                    }
                }
            }

            p3xrs.connections.list[connectionIndexExisting] = connectionSave
        } else {
            p3xrs.connections.list.push(connectionSave)
        }


        const fs = require('fs')
        fs.writeFileSync(p3xrs.cfg.connections.home, JSON.stringify(p3xrs.connections, null, 4))

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
                connectionId: connectionSave.id,
                code: 'save-connection',
                socket: socket,
            })
        }

    }

}
