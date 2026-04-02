import Redis from '../../../lib/ioredis-cluster/index.mjs'

export default async (options) => {
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
            if (redisConfig.sshPassword === actualConnection.id) {
                redisConfig.sshPassword = actualConnection.sshPassword;
            }
            if (redisConfig.sshPrivateKey === actualConnection.id) {
                redisConfig.sshPrivateKey = actualConnection.sshPrivateKey;
            }
        }

        const sentinelName = redisConfig.sentinelName
        //TODO fix secured nodes password
        delete redisConfig.name
        delete redisConfig.id


        if (redisConfig.tlsWithoutCert) {
            redisConfig.tls =  {
                servername: redisConfig.host
            }
        } else if (typeof redisConfig.tlsCa === 'string' && redisConfig.tlsCa.trim() !== '') {
            redisConfig.tls = {
                //rejectUnauthorized: false,
                cert: redisConfig.tlsCrt,
                key: redisConfig.tlsKey,
                ca: redisConfig.tlsCa,
                servername: redisConfig.host
            }
        }
        if (redisConfig.hasOwnProperty('tls')) {
            redisConfig.tls.rejectUnauthorized = redisConfig.tlsRejectUnauthorized === undefined ? false : redisConfig.tlsRejectUnauthorized
            // Ensure SNI is always set to the host
            if (!redisConfig.tls.hasOwnProperty('servername')) {
                redisConfig.tls.servername = redisConfig.host
            }
        }


        // Fix node passwords
        if (Array.isArray(redisConfig.nodes)) {
            redisConfig.nodes = redisConfig.nodes.map((node) => {
                if (actualConnection !== undefined && node.password === node.id) {
                    const foundNode = actualConnection.nodes.find((findNode) => findNode.id === node.password)
                    if (foundNode) {
                        node.password = foundNode.password
                    }
                }
                return node
            })
        }

        // SSH tunnel creation - single SSH connection, multiple port forwards
        let sshTunnelServers = []
        let sshClient = undefined
        let redis = undefined
        let settled = false
        let didReady = false
        let lastRedisError = undefined
        let timeout = undefined
        const closeSshTunnels = () => {
            for (const server of sshTunnelServers) {
                server.close()
            }
            sshTunnelServers = []
            if (sshClient) {
                sshClient.end()
                sshClient = undefined
            }
        }

        const settle = (payload) => {
            if (settled) {
                return
            }
            settled = true
            if (timeout) {
                clearTimeout(timeout)
                timeout = undefined
            }
            socket.emit(options.responseEvent, payload)
            if (redis) {
                redis.disconnect()
                redis = undefined
            }
            closeSshTunnels()
        }

        if (redisConfig.ssh === true) {
            const { createTunnel } = await import('tunnel-ssh')
            const net = await import('net')

            const sshOptions = {
                host: redisConfig.sshHost,
                port: redisConfig.sshPort,
                username: redisConfig.sshUsername,
            };
            if (redisConfig.sshPrivateKey) {
                sshOptions.privateKey = redisConfig.sshPrivateKey
            } else {
                sshOptions.password = redisConfig.sshPassword
            }

            // Create primary tunnel (establishes the single SSH connection)
            let [primaryServer, sshConn] = await createTunnel({ autoClose: false }, null, sshOptions, {
                dstAddr: redisConfig.host,
                dstPort: redisConfig.port,
            });
            sshTunnelServers.push(primaryServer)
            sshClient = sshConn
            redisConfig.port = primaryServer.address().port

            // Create port forwards for additional nodes through the same SSH connection
            if (Array.isArray(redisConfig.nodes)) {
                for (const node of redisConfig.nodes) {
                    const nodeServer = await new Promise((resolve, reject) => {
                        const server = net.createServer((sock) => {
                            sshClient.forwardOut('127.0.0.1', 0, node.host || 'localhost', node.port, (err, channel) => {
                                if (err) {
                                    sock.end()
                                    return
                                }
                                sock.pipe(channel).pipe(sock)
                            })
                        })
                        server.listen(0, '127.0.0.1', () => resolve(server))
                        server.on('error', reject)
                    })
                    sshTunnelServers.push(nodeServer)
                    node.port = nodeServer.address().port
                }
            }

            // Error handlers
            sshClient.on('error', (e)=>{
                console.error('ssh client error', e);
                settle({
                    status: 'error',
                    error: e.message
                })
            });

            for (const server of sshTunnelServers) {
                server.on('error', (e)=>{
                    console.error('ssh tunnel server error', e);
                    settle({
                        status: 'error',
                        error: e.message
                    })
                });
            }
        }

        // Cluster/sentinel conversion
        if (redisConfig.hasOwnProperty('sentinel') && redisConfig.sentinel === true) {
            redisConfig = [redisConfig].concat(redisConfig.nodes || [])
        } else if (redisConfig.cluster === true) {
            redisConfig = [redisConfig].concat(redisConfig.nodes || [])
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

        redis = new Redis(redisConfig)
        //console.info('redis-test-connection', redisConfig)
        redis.on('error', function (error) {
            lastRedisError = error
            console.error(error)
        })
        redis.on('ready', function () {
            didReady = true
            settle({
                status: 'ok',
            })
        })
        redis.on('close', function () {
            if (!didReady) {
                settle({
                    status: 'error',
                    error: lastRedisError?.message || 'Connection is closed.'
                })
            }
        })
        redis.on('end', function () {
            if (!didReady) {
                settle({
                    status: 'error',
                    error: lastRedisError?.message || 'Connection is closed.'
                })
            }
        })

        timeout = setTimeout(() => {
            settle({
                status: 'error',
                error: lastRedisError?.message || 'No response from server'
            })
        }, 30000)

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message
        })
    }

}
