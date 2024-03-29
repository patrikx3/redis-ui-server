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
            redisConfig.nodes = redisConfig.nodes.map((node) => {
                if (node.password === node.id) {
                    const foundNode = actualConnection.nodes.find((findNode) => findNode.id === node.password)
                    node.password = foundNode.password
                }
                return node
            })
            redisConfig = [redisConfig].concat(redisConfig.nodes)
        } else if (redisConfig.cluster === true) {
            redisConfig.nodes = redisConfig.nodes.map((node) => {
                if (node.password === node.id) {
                    const foundNode = actualConnection.nodes.find((findNode) => findNode.id === node.password)
                    node.password = foundNode.password
                }
                return node
            })
            redisConfig = [redisConfig].concat(redisConfig.nodes)
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

        let ssh = {
            server: undefined,
            client: undefined,
        }
        if (!Array.isArray(redisConfig)) {
            if (redisConfig.ssh === true) {

                const tunnelOptions = {
                    autoClose: false
                }
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
                
                const serverOptions = null
                
                const forwardOptions = {
                    dstAddr: redisConfig.host,
                    dstPort: redisConfig.port,
                }

                const { createTunnel } = require('tunnel-ssh')
                let [server, client] = await createTunnel(tunnelOptions, serverOptions, sshOptions, forwardOptions);


                ssh.server = server
                ssh.client = client

                redisConfig.port = server.address().port

                server.on('error',(e)=>{
                    console.error(e);
                    ssh.server.close()
                    socket.emit(options.responseEvent, {
                        status: 'error',
                        error: e.message
                    })
                });
            
                client.on('error',(e)=>{
                    console.error(e);
                    ssh.server.close()
                    socket.emit(options.responseEvent, {
                        status: 'error',
                        error: e.message
                    })
                });
            }
        }

        let redis = new Redis(redisConfig)
        //console.info('redis-test-connection', redisConfig)
        redis.on('error', function (error) {
            console.error(error)
            socket.emit(options.responseEvent, {
                status: 'error',
                error: error.message
            })
            redis.disconnect()
            if (ssh.server) {   
                ssh.server.close()
            }
        })
        redis.on('connect', async function () {
            try {
                //await redis.call('client', 'list')

                socket.emit(options.responseEvent, {
                    status: 'ok',
                })    

                /*
                setTimeout(() => {
                }, 1000)
                */
               
            } catch (error) {
                console.error(error)
                socket.emit(options.responseEvent, {
                    status: 'error',
                    error: error.message
                })
            } finally {
                redis.disconnect()
                if (ssh.server) {   
                    ssh.server.close()
                }    
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
