const Redis = require('../../../lib/ioredis-cluster')

module.exports = async (options) => {
    const {socket} = options;

    try {
        let redisConfig = options.payload.model;
        const actualConnection = p3xrs.connections.list.find(con => redisConfig.id === con.id)
        if (actualConnection !== undefined) {
            if (redisConfig.password === actualConnection.id) {
                redisConfig.password = actualConnection.password;
            }
            if (redisConfig.tlsCrt === actualConnection.id) {
                redisConfig.tlsCrt = actualConnection.tlsCrt;
            }
            if (redisConfig.tlsKey === actualConnection.id) {
                redisConfig.tlsKey = actualConnection.tlsKey;
            }
            if (redisConfig.tlsCa === actualConnection.id) {
                redisConfig.tlsCa = actualConnection.tlsCa;
            }
        }

        //TODO fix secured nodes password

        delete redisConfig.name
        delete redisConfig.id

        if (redisConfig.cluster === true) {
            redisConfig.nodes = redisConfig.nodes.map((node) => {
                if (node.password === node.id) {
                    const foundNode = actualConnection.nodes.find((findNode) => findNode.id === node.password)
                    node.password = foundNode.password
                }
                return node
            })
            redisConfig = [redisConfig].concat(redisConfig.nodes)
        }

        if (redisConfig.tlsWithoutCert) {
            redisConfig.tls =  {
            }
        } else if (typeof redisConfig.tlsCa === 'string' && redisConfig.tlsCa.trim() !== '') {
            redisConfig.tls = {
                rejectUnauthorized: false,
                cert: redisConfig.tlsCrt,
                key: redisConfig.tlsKey,
                ca: redisConfig.tlsCa,
            }
        }

        let redis = new Redis(redisConfig)
        redis.on('error', function (error) {
            console.error(error)
            socket.emit(options.responseEvent, {
                status: 'error',
                error: error.message
            })
            redis.disconnect()
        })
        redis.on('connect', async function () {
            try {
                //await redis.call('client', 'list')

                socket.emit(options.responseEvent, {
                    status: 'ok',
                })
            } catch (error) {
                console.error(error)
                socket.emit(options.responseEvent, {
                    status: 'error',
                    error: error.message
                })
            } finally {
                redis.disconnect()

            }
        })

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message
        })
    }

}
