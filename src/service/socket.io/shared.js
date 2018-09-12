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

const cloneDeep = require('lodash/cloneDeep')
const sendConnections = (options) => {
    const { socket } = options

    const connections = cloneDeep(p3xrs.connections);
    let connectionsList = connections.list.map(connection => {
        delete connection.password
        return connection
    })
    connections.list = connectionsList

    socket.p3xrs.io.emit('connections', {
        status: 'ok',
        connections: connections
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

const getKeysType = async (options) => {
    const { redis, keys } = options;

    const promises = [];
    for(let key of keys) {
        promises.push(redis.type(key))
    }
    const keysType = await Promise.all(promises);

    const result = {}
    for (let keysIndex in keys) {
        result[keys[keysIndex]] = keysType[keysIndex]
    }

    return result;
}

const ensureReadonlyConnections = () => {
    if (p3xrs.cfg.readonlyConnections === true) {
        const errorCode = new Error('Connections add/save/delete are readonly only')
        errorCode.code = 'readonly-connections'
        throw errorCode;
    }
}

const getFullInfo = async (options) => {
    const { redis } = options;

    const results = await Promise.all([
        redis.info(),
        getStreamKeys({
            redis: redis,
        }),
    ])

    const keys = results[1]

    const keysType = await getKeysType({
        redis: redis,
        keys: keys,
    })

    return {
        info: results[0],
        keys: keys,
        keysType: keysType
    }

}

module.exports.ensureReadonlyConnections = ensureReadonlyConnections
module.exports.triggerDisconnect = triggerDisconnect
module.exports.getStreamKeys = getStreamKeys
module.exports.disconnectRedisIo =  disconnectRedisIo
module.exports.sendConnections = sendConnections
module.exports.sendStatus = sendStatus
module.exports.disconnectRedis = disconnectRedis
module.exports.getKeysType = getKeysType
module.exports.getFullInfo = getFullInfo