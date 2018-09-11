const consolePrefix = 'socket.io connection-connect';
const Redis = require('ioredis')

const sharedIoRedis = require('../shared')

const generateConnectInfo = async (options) => {
    const { socket, redis  } = options

    const databases = await redis.config('get', 'databases')

    const results = await Promise.all([
        redis.info(),
        sharedIoRedis.getStreamKeys({
            redis: redis,
        })
    ])

    //console.log(databases)

    socket.emit(options.responseEvent, {
        status: 'ok',
        databases: parseInt(databases[1]),
        info: results[0],
        keys: results[1]
    })

}

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
            await generateConnectInfo({
                redis: socket.p3xrs.ioredis,
                socket: socket,
                responseEvent: options.responseEvent
            })

            sharedIoRedis.sendStatus({
                socket: socket,
            })
        } else {
            const actualConnection = p3xrs.connections.list.find(con => options.payload.connection.id === con.id)
            const redisConfig = Object.assign({}, actualConnection);
            delete redisConfig.name
            delete redisConfig.id

            let redis = new Redis(redisConfig)
            let didConnected = false

            const redisErrorFun = async function(error) {
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

                try {
                    await redis.disconnect()
                } catch(e) {
                    console.error(e)
                }
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

                    await generateConnectInfo({
                        redis: redis,
                        socket: socket,
                        responseEvent: options.responseEvent
                    })

                } catch(e) {
                    socket.emit(options.responseEvent, {
                        status: 'error',
                        error: e,
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