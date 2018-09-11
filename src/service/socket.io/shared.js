const triggerDisconnect = (options) => {
    const { connectionId, code, socket } = options
    if (p3xrs.redisConnections.hasOwnProperty(connectionId)) {
        delete p3xrs.redisConnections[connectionId]
        socket.p3xrs.io.emit('redis-disconnected', {
            connectionId: connectionId,
            status: 'code',
            code: code
        })
        sendStatus({
            socket: socket
        })
    }

}

const sendStatus = (options) => {
    const { socket } = options

    const redisConnections = {}
    Object.keys(p3xrs.redisConnections).forEach((redisConnectionKey) => {
        redisConnections[redisConnectionKey] = {}
        Object.keys(p3xrs.redisConnections[redisConnectionKey]).forEach(redisConnectionKey2 => {
            redisConnections[redisConnectionKey][redisConnectionKey2] = p3xrs.redisConnections[redisConnectionKey][redisConnectionKey2]
        })
    })

    socket.p3xrs.io.emit('redis-status', {
        redisConnections: redisConnections,
    })
}


const consolePrefixDisconnectRedis = 'socket.io shared disconnect redis'
const disconnectRedis = (options) => {
    const { socket } = options
    //console.info(consolePrefixDisconnectRedis, `${socket.p3xrs.connectionId} !== ${connection.id}`)
    if (p3xrs.redisConnections.hasOwnProperty(socket.p3xrs.connectionId)) {
        console.warn(consolePrefixDisconnectRedis, `includes ${p3xrs.redisConnections[socket.p3xrs.connectionId].clients.includes(socket.id)} length === 1 ${p3xrs.redisConnections[socket.p3xrs.connectionId].clients.length}`)
        if (p3xrs.redisConnections[socket.p3xrs.connectionId].clients.includes(socket.id) && p3xrs.redisConnections[socket.p3xrs.connectionId].clients.length === 1) {
            //console.warn(consolePrefixDisconnectRedis, p3xrs.redisConnections[socket.p3xrs.connectionId])
            //p3xrs.redisConnections[socket.p3xrs.connectionId].ioredis.disconnect()
            delete p3xrs.redisConnections[socket.p3xrs.connectionId]
        } else {
            let connectionIndexExisting = p3xrs.redisConnections[socket.p3xrs.connectionId].clients.indexOf(socket.id);
            console.warn(consolePrefixDisconnectRedis, socket.p3xrs.connectionId, p3xrs.redisConnections[socket.p3xrs.connectionId].clients, socket.id, connectionIndexExisting)
            if (connectionIndexExisting > -1) {
                p3xrs.redisConnections[socket.p3xrs.connectionId].clients.splice(connectionIndexExisting, 1)
            }
        }
    }
    if (p3xrs.redisConnections.hasOwnProperty(socket.p3xrs.connectionId) && p3xrs.redisConnections[socket.p3xrs.connectionId].hasOwnProperty('clients') && p3xrs.redisConnections[socket.p3xrs.connectionId].clients.length === 0) {
        delete p3xrs.redisConnections[socket.p3xrs.connectionId]
    }
    module.exports.disconnectRedisIo(options)

    socket.p3xrs.connectionId = undefined
}

const sendConnections = (options) => {
    const { socket } = options
    socket.p3xrs.io.emit('connections', {
        status: 'ok',
        connections: p3xrs.connections
    })

}


const disconnectRedisIo = (options) => {
    const { socket } = options

    if (socket.p3xrs.ioredis !== undefined) {
        socket.p3xrs.ioredis.disconnect()
        socket.p3xrs.ioredis = undefined
    }
}

const getStreamKeys = (options) => {
    const { redis } = options

    return new Promise((resolve, reject) => {
        const stream = redis.scanStream({
            match: options.match
        });
        let keys = [];
        stream.on('data', (resultKeys) => {
            keys = keys.concat(resultKeys);
        });

        stream.on('end', async () => {
            try {
                resolve(keys);
            } catch (e) {
                console.error(e);
                reject(e)
            }
        });
    })
}

module.exports.triggerDisconnect = triggerDisconnect
module.exports.getStreamKeys = getStreamKeys
module.exports.disconnectRedisIo =  disconnectRedisIo
module.exports.sendConnections = sendConnections
module.exports.sendStatus = sendStatus
module.exports.disconnectRedis = disconnectRedis
