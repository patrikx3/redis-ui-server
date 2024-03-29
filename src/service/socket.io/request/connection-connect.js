const donationWareFeatureError = new Error('donation-ware-feature')
donationWareFeatureError.code = 'donation-ware-feature'

const consolePrefix = 'socket.io connection-connect';
const Redis = require('../../../lib/ioredis-cluster')

const sharedIoRedis = require('../shared')

const staticCommands = require('../../../lib/redis-static-commands')

const generateConnectInfo = async (options) => {
    const {socket, redis, payload} = options
    const { db} = payload
    // console.warn('generateConnectInfo', options.payload)


    let databases
    //let results
    let commands = staticCommands

    const probeDatabaseCount = async() => {
        let tryUntilSelectDatabaseIsNotOk = true
        let currentDb = 0
        let totalDb = 0
        let maxDb = 512
        while(tryUntilSelectDatabaseIsNotOk) {
            try {
                currentDb++
                await redis.call('select', currentDb)
                //console.info('found correct database index', currentDb)
                if (currentDb > maxDb) {
                    console.warn(`limiting to max ${maxDb} database index, as it could crash with a big db index number`)
                    tryUntilSelectDatabaseIsNotOk = false
                }
            } catch(e) {
                console.warn('found wrong current db index', currentDb)
                tryUntilSelectDatabaseIsNotOk = false
            }
        }
        totalDb = currentDb
        if (db <= totalDb) {
            await redis.call('select', db)
        }
        console.log('calculated max databases index', totalDb)
        return totalDb
    }

    if (options.payload.connection.cluster === true) {
        databases = 1
        //commands = await redis.command()
    } else {
        try {
            databases = (await redis.config('get', 'databases'))[1]
            console.info(options.payload.connection.name, 'instance successfully works the database listing')
        } catch(e) {
            console.warn(options.payload.connection.name, 'instance get databases listing is disabled', e)
            databases = await probeDatabaseCount()
        }
    }

    console.info(options.payload.connection.name, 'databases got', databases)
    
    try {
        //commands = await redis.call('command2')
        commands = await redis.command()
        console.info(options.payload.connection.name, 'instance command listing is available', JSON.stringify(commands))
    } catch(e) {
        console.warn(options,payload.connection.name, 'instance command listing is not available, not all redis instances are not available command listing', e)
    }

    //console.log(JSON.stringify(commands))
    //socket.p3xrs.commands = commands.map(e => e[0].toLowerCase())

    //console.log('payload', payload)

    await sharedIoRedis.getFullInfoAndSendSocket({
        setDb: true,
        redis: redis,
        responseEvent: options.responseEvent,
        socket: socket,
        extend: {
            databases: databases,
            commands: commands
        },
        payload: payload,

    })
}

module.exports = async (options) => {
    const {socket, payload} = options;

    const {connection, db} = payload


    try {
        if (!p3xrs.cfg.donated) {
            if (payload.connection.cluster === true) {
                throw donationWareFeatureError
            }
        }


        if (socket.p3xrs.connectionId !== connection.id) {
            sharedIoRedis.disconnectRedis({
                socket: socket,
            })
        }

        if (!p3xrs.redisConnections.hasOwnProperty(connection.id)) {
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
                responseEvent: options.responseEvent,
                payload: payload
            })

            sharedIoRedis.sendStatus({
                socket: socket,
            })
        } else {
            const actualConnection = p3xrs.connections.list.find(con => options.payload.connection.id === con.id)
            if (actualConnection === undefined) {
                throw new Error('auto-connection-failed')
            }
            if (connection.askAuth) {
                actualConnection.username = undefined
                actualConnection.password = undefined
                if (connection.username) {
                    actualConnection.username = connection.username
                }
                if (connection.password) {
                    actualConnection.password = connection.password
                }
            }
            let redisConfig = Object.assign({}, actualConnection);
            delete redisConfig.name
            delete redisConfig.id
            redisConfig.retryStrategy = () => {
                return false
            }


            /*
            redisConfig.showFriendlyErrorStack = true
            if (db !== undefined) {
                redisConfig.db = db
            }
             */

            if (redisConfig.cluster === true) {
                redisConfig = [redisConfig].concat(actualConnection.nodes)
            }
            
            if (redisConfig.tlsWithoutCert) {
                redisConfig.tls =  {
                }
            } else if (typeof redisConfig.tlsCa === 'string' && redisConfig.tlsCa.trim() !== '') {
                redisConfig.tls = {
                    //rejectUnauthorized: false,
                    cert: redisConfig.tlsCrt,
                    key: redisConfig.tlsKey,
                    ca: redisConfig.tlsCa,
                }
            }
            if ((typeof redisConfig.tlsCa === 'string' && redisConfig.tlsCa.trim() !== '') || redisConfig.tlsWithoutCert) {
                redisConfig.tls.rejectUnauthorized = redisConfig.tlsRejectUnauthorized === undefined ? false : redisConfig.tlsRejectUnauthorized
            }
            
            let redis = new Redis(redisConfig)
            //console.warn('redis connection', redisConfig)
            let redisSubscriber = new Redis(redisConfig)
            // let redis = await new Redis(redisConfig, {autoDetectCluster: true})
            // let redisSubscriber = await new Redis(redisConfig, {autoDetectCluster: true})
            socket.p3xrs.connectionId = connection.id
            socket.p3xrs.readonly = actualConnection.readonly === true
            socket.p3xrs.ioredis = redis
            socket.p3xrs.ioredisSubscriber = redisSubscriber
            let didConnected = false

            const redisErrorFun = async function (error) {
                const consolePrefix = 'socket.io connection-connect redis error fun'
                console.warn(consolePrefix, connection.id, connection.name, 'error')
                console.error(error)
                console.warn(consolePrefix, 'didConnected', didConnected)
                if (!didConnected) {
                    socket.emit(options.responseEvent, {
                        status: 'error',
                        error: error.message
                    })
                }
                const disconnectedData = {
                    connectionId: socket.p3xrs.connectionId,
                    error: error.message,
                    status: 'error',
                }
                console.warn(consolePrefix, 'disconnectedData', disconnectedData)
                socket.p3xrs.io.emit('redis-disconnected', disconnectedData)

                try {
                    await sharedIoRedis.disconnectRedis({
                        socket: socket,
                    })
                } catch (e) {
                    console.warn(consolePrefix, 'disconnectRedis')
                    console.error(e)
                }
                delete p3xrs.redisConnections[socket.connectionId]

                socket.p3xrs.connectionId = undefined
                socket.p3xrs.ioredis = undefined
                socket.p3xrs.ioredisSubscriber = undefined

                sharedIoRedis.sendStatus({
                    socket: socket,
                })
            }

            redis.on('error', redisErrorFun)
            redisSubscriber.on('error', redisErrorFun)

            //console.warn('create psubscribe', actualConnection.id)
            redisSubscriber.psubscribe('*', function (error, count) {
                if (error) {
                    console.error(error)
                }
            })

            //console.warn('create pmessage', actualConnection.id)
            redisSubscriber.on('pmessage', function (channel, pattern, message) {
                //console.log(`receive pmessage channel: ${channel} - pattern: ${pattern}, message: ${message}`);
                //console.log('list clients', actualConnection.id, JSON.stringify(p3xrs.redisConnections[actualConnection.id].clients, null, 4))
                socket.emit('pubsub-message', {
                    channel: pattern,
                    message: message,
                })
            });

            redis.on('connect', async function () {

                try {
                    console.info(consolePrefix, options.payload.connection.id, options.payload.connection.name, 'connected')
                    didConnected = true


                    await generateConnectInfo({
                        redis: redis,
                        socket: socket,
                        responseEvent: options.responseEvent,
                        payload: options.payload,
                    })

                } catch (e) {
                    console.error(e)
                    socket.emit(options.responseEvent, {
                        status: 'error',
                        error: e.message,
                    })
                } finally {
                    sharedIoRedis.sendStatus({
                        socket: socket,
                    })

                }


            })

        }

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message
        })

    }

}
