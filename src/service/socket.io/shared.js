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
    //console.warn(consolePrefixDisconnectRedis, `${socket.p3xrs.connectionId} !== ${connection.id}`)
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

    console.warn('shared disconnectRedisIo',  'try')
    if (socket.p3xrs.ioredis !== undefined) {
        console.warn('shared disconnectRedisIo',  'executed')
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


/*
const getStreamTypedKeys = (options) => {
    const { redis, key, match } = options

    let { scan } = options

    if (scan === undefined) {
        scan = 'scanStream'
    }

    return new Promise((resolve, reject) => {
        let stream;

        if (scan === 'scanStream') {
            stream = redis[scan]({
                match: match
            });
        } else {
            stream = redis[scan](key, {
                match: match
            });
        }
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
*/

const getKeysInfo = async (options) => {
    const { redis, keys } = options;

    const keyTypePipeline = redis.pipeline()
//    const promises = [];
    for(let key of keys) {
        keyTypePipeline.type(key)
//        promises.push(redis.type(key))
    }
//    const keysType = await Promise.all(promises);
    const keysType = await keyTypePipeline.exec();
    const result = {}
    const complexLengthPipeline = redis.pipeline()
    for (let keysIndex in keys) {
        const keyType = keysType[keysIndex]
        const key = keys[keysIndex]
        const obj = {
            type: keyType[1 ]
        }
        switch(obj.type) {
            case 'hash':
                complexLengthPipeline.hlen(key)
                break;

            case 'list':
                complexLengthPipeline.llen(key)
                break;

            case 'set':
                complexLengthPipeline.scard(key)
                break;

            case 'zset':
                complexLengthPipeline.zcard(key)
                break;
        }
        result[key] = obj
    }

    const lengthsPipeline = await complexLengthPipeline.exec()
    for (let keysIndex in keys) {
        const key = keys[keysIndex]
        const obj = result[key]
        if (obj.type === 'string') {

            continue
        }
        const lengthPipelineElement = lengthsPipeline.shift()
        obj.length = lengthPipelineElement[1]
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
    let { payload } = options
    if (payload === undefined) {
        payload = {}
    }

    const results = await Promise.all([
        redis.info(),
        getStreamKeys({
            redis: redis,
            match: payload.match,
        }),
    ])

    const keys = results[1]

    const keysInfo = await getKeysInfo({
        redis: redis,
        keys: keys,
    })

    return {
        info: results[0],
        keys: keys,
        keysInfo: keysInfo
    }

}

module.exports.ensureReadonlyConnections = ensureReadonlyConnections
module.exports.triggerDisconnect = triggerDisconnect
module.exports.getStreamKeys = getStreamKeys
module.exports.disconnectRedisIo =  disconnectRedisIo
module.exports.sendConnections = sendConnections
module.exports.sendStatus = sendStatus
module.exports.disconnectRedis = disconnectRedis
module.exports.getKeysInfo = getKeysInfo
module.exports.getFullInfo = getFullInfo