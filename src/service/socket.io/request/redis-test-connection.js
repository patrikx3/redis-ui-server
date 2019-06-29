const Redis = require('../../../ioredis-cluster')

module.exports = async(options) => {
    const { socket } = options;

    let redisConfig = options.payload.model;
    const actualConnection = p3xrs.connections.list.find(con => redisConfig.id === con.id)
    if (actualConnection !== undefined) {
        if (redisConfig.password === actualConnection.id) {
            redisConfig.password = actualConnection.password;
        }
    }

    //TODO fix secured nodes password

    delete redisConfig.name
    delete redisConfig.id

    if (redisConfig.cluster === true) {
        const nodes = redisConfig.nodes.map((node) => {
            delete node.id
            return node
        })
        redisConfig = [ redisConfig ].concat(actualConnection.nodes)
    }

    // let redis = new Redis(redisConfig)
    let redis = await new Redis(redisConfig, {autoDetectCluster: true})
    redis.on('error', function(error) {
        console.error(error)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: error
        })
        redis.disconnect()
    })
    redis.on('connect', async function() {
        try {
            await redis.call('client', 'list')

            socket.emit(options.responseEvent, {
                status: 'ok',
            })
        } catch(error) {
            socket.emit(options.responseEvent, {
                status: 'error',
                error: error
            })
        } finally {
            redis.disconnect()

        }
    })

}
