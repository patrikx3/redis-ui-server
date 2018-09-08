const consolePrefix = 'socket.io connection-connect';
const Redis = require('ioredis')

const sharedIoRedis = require('../shared')

module.exports = async(options) => {
    const { socket, payload } = options;

    const { connection } = payload

    try {
        if (socket.p3xrs.connectionId !== connection.id) {
            sharedIoRedis.disconnectRedis({
                socket: socket,
            })
        }

        if (!p3xrs.redisConnections.hasOwnProperty(connection.id)) {
            console.info(consolePrefix, 'creating new connection')
            p3xrs.redisConnections[connection.id] = {
                connection: connection,
                clients: []
            }
        }
        if (!p3xrs.redisConnections[connection.id].clients.includes(socket.id)) {
            console.info(consolePrefix, 'added new socket.id', socket.id, 'to', connection.id, 'name with', connection.name)
            p3xrs.redisConnections[connection.id].clients.push(socket.id)
        }

        if (socket.p3xrs.ioredis !== undefined) {
            console.info(consolePrefix, 'redis was already connected')
            socket.p3xrs.connectionId = connection.id
            socket.emit(options.responseEvent, {
                status: 'ok',
            })
            sharedIoRedis.sendStatus({
                socket: socket,
            })
        } else {
            const redisConfig = Object.assign({}, options.payload.connection);
            delete redisConfig.name
            delete redisConfig.id

            let redis = new Redis(redisConfig)
            let didConnected = false

            const redisErrorFun = function(error) {
                console.info(consolePrefix, connection.id, connection.name, 'error' )
                console.error(error)
                if (!didConnected) {
                    socket.emit(options.responseEvent, {
                        status: 'error',
                        error: error
                    })
                }
                const disconnectedData = {
                    connectionId: socket.connectionId,
                    error: error,
                    status: 'error',
                }
                socket.p3xrs.io.emit('redis-disconnected', disconnectedData)

                redis.disconnect()
                delete p3xrs.redisConnections[socket.connectionId]
                socket.p3xrs.connectionId = undefined
                socket.p3xrs.ioredis = undefined

                sharedIoRedis.sendStatus({
                    socket: socket,
                })
            }

            redis.on('error', redisErrorFun)

            redis.on('connect', async function() {

                try {
                    console.info(consolePrefix, options.payload.connection.id, options.payload.connection.name, 'connected' )
                    didConnected = true

                    socket.p3xrs.connectionId = connection.id
                    socket.p3xrs.ioredis = redis

                    const results = await Promise.all([
                        redis.config('get', 'databases'),
                        redis.info('keyspace')
                    ])
                    const databases = results[0]
                    //console.log(databases)

                    socket.emit(options.responseEvent, {
                        status: 'ok',
                        databases: parseInt(databases[1]),
                        keyspace: results[1]
                    })

                } catch(e) {

                    socket.emit(options.responseEvent, {
                        status: 'error',
                        error: error,
                    })
                } finally {
                    sharedIoRedis.sendStatus({
                        socket: socket,
                    })

                }


            })

        }

    } catch (error) {
        console.error(error)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: error
        })

    }

}