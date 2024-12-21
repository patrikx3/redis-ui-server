const donationWareFeatureError = new Error('donation-ware-feature')
donationWareFeatureError.code = 'donation-ware-feature'

const consolePrefix = 'socket.io connection-connect';
const Redis = require('../../../lib/ioredis-cluster')

const sharedIoRedis = require('../shared')

const staticCommands = require('../../../lib/redis-static-commands')

const generateConnectInfo = async (options) => {
    const { socket, redis, payload } = options
    const { db } = payload
    // console.warn('generateConnectInfo', options.payload)


    let databases
    //let results
    let commands = staticCommands

    const probeDatabaseCount = async () => {
        let tryUntilSelectDatabaseIsNotOk = true
        let currentDb = 0
        let totalDb = 0
        let maxDb = 512
        await new Promise(resolve => setTimeout(resolve, 1000));

        while (tryUntilSelectDatabaseIsNotOk) {
            try {
                await redis.call('select', currentDb)
                //console.info('found correct database index', currentDb)
                if (currentDb > maxDb) {
                    console.warn(`limiting to max ${maxDb} database index, as it could crash with a big db index number`)
                    tryUntilSelectDatabaseIsNotOk = false
                }
                currentDb++
            } catch (e) {
                console.error(e);
                console.warn('found wrong current db index', currentDb)
                tryUntilSelectDatabaseIsNotOk = false
            }
        }
        totalDb = currentDb
        if (db <= totalDb) {
            try {
                await redis.call('select', db)
            } catch (e) {
                console.error(e)
            }
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
        } catch (e) {
            console.warn(options.payload.connection.name, 'instance get databases listing is disabled', e)
            databases = await probeDatabaseCount()
        }
    }

    console.info(options.payload.connection.name, 'databases got', databases)

    try {
        //commands = await redis.call('command2')
        commands = await redis.command()
        console.info(options.payload.connection.name, 'instance command listing is available') // , JSON.stringify(commands))
    } catch (e) {
        console.warn(options, payload.connection.name, 'instance command listing is not available, not all redis instances are not available command listing', e)
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
    const { socket, payload } = options;

    const { connection, db } = payload


    try {
        if (!p3xrs.cfg.donated) {
            if (payload.connection.cluster === true) {
                throw donationWareFeatureError
            } else if (payload.connection.sentinel === true) {
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
            const sentinelName = redisConfig.sentinelName
            delete redisConfig.name
            delete redisConfig.id
            redisConfig.retryStrategy = null

            // module.exports = class Cluster extends Redis.Cluster <- right as it says
            redisConfig.clusterRetryStrategy = null


            /*
            redisConfig.showFriendlyErrorStack = true
            if (db !== undefined) {
                redisConfig.db = db
            }
             */


            if (redisConfig.tlsWithoutCert) {
                redisConfig.tls = {
                }
            } else if (typeof redisConfig.tlsCa === 'string' && redisConfig.tlsCa.trim() !== '') {
                redisConfig.tls = {
                    //rejectUnauthorized: false,
                    cert: redisConfig.tlsCrt,
                    key: redisConfig.tlsKey,
                    ca: redisConfig.tlsCa,
                }
            }
            if (redisConfig.hasOwnProperty('tls')) {
                redisConfig.tls.rejectUnauthorized = redisConfig.tlsRejectUnauthorized === undefined ? false : redisConfig.tlsRejectUnauthorized
            }

            if (redisConfig.hasOwnProperty('sentinel') && redisConfig.sentinel === true) {
                redisConfig = [redisConfig].concat(actualConnection.nodes)
            } else if (redisConfig.cluster === true) {
                redisConfig = [redisConfig].concat(actualConnection.nodes)
            }

            if (Array.isArray(redisConfig) && redisConfig[0].hasOwnProperty('sentinel') && redisConfig[0].sentinel === true) {
                redisConfig = {
                    sentinels: redisConfig,
                    name: sentinelName,
                    sentinelPassword: redisConfig[0].password,
                    sentinelRetryStrategy: () => {
                        return false
                    }
                }
            }

            const closeRedis = () => {
                sharedIoRedis.disconnectRedis({
                    socket: socket,
                })
                socket.p3xrs.connectionId = undefined
                socket.p3xrs.ioredis = undefined
                socket.p3xrs.ioredisSubscriber = undefined
            }

            if (!Array.isArray(redisConfig)) {
                if (redisConfig.ssh === true) {

                    const { NodeSSH } = require('node-ssh');
                    const getPort = require('get-port');

                    const ssh = new NodeSSH();

                    const sshOptions = {
                        host: redisConfig.sshHost,
                        port: parseInt(redisConfig.sshPort, 10),
                        username: redisConfig.sshUsername,
                        ...(redisConfig.sshPrivateKey
                            ? { privateKey: redisConfig.sshPrivateKey }
                            : { password: redisConfig.sshPassword }),
                    };

                    try {
                        console.log('Connecting to SSH server...');
                        await ssh.connect(sshOptions);
                        console.log('SSH connection established.');

                        // Dynamically get an available local port
                        const localPort = await getPort.default();
                        console.log(`Dynamic local port allocated: ${localPort}`);

                        // Manually set up port forwarding using the exec command
                        const forwardCommand = `ssh -L 127.0.0.1:${localPort}:${redisConfig.host}:${redisConfig.port} -N`;
                        const result = await ssh.execCommand(forwardCommand, { execOptions: { pty: true } });

                        if (result.stderr) {
                            throw new Error(`Failed to forward port: ${result.stderr}`);
                        }

                        console.log('Port forwarding set up successfully.');

                        // Update redisConfig with the dynamically assigned port
                        //redisConfig.port = localPort;

                        // Assign the SSH connection as tunnel and client
                        socket.p3xrs.tunnel = ssh;
                        socket.p3xrs.tunnelClient = ssh;

                        console.log(`Tunnel created on local port: ${localPort}`);
                    } catch (error) {
                        console.error('Failed to set up SSH tunnel:', error);
                        socket.emit(options.responseEvent, {
                            status: 'error',
                            error: error.message,
                        });
                    }

                }
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
                if (!error) {
                    error = new Error('Connection is closed.')
                    error.p3xCode = 'disconnect'
                }
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
                closeRedis()

                sharedIoRedis.sendStatus({
                    socket: socket,
                })
            }

            redis.on('error', redisErrorFun)
            redis.on('disconnect', redisErrorFun)
            redisSubscriber.on('error', redisErrorFun)

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
