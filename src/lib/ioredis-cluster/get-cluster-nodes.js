const Redis = require('ioredis')

module.exports = async function getClusterNodes(servers, options = {}) {

    if (!Array.isArray(servers)) {
        servers = [servers]
    }

    const errors = []

    let nodes
    for (const server of servers) {
        try {

            const redis = new Redis({...server, retryStrategy: () => false})

            const rawNodes = await new Promise((resolve, reject) => {
                redis.sendCommand(
                    new Redis.Command(
                        'CLUSTER',
                        ['NODES'],
                        'utf-8',
                        function (err, value) {
                            if (err)
                                reject(err)
                            else
                                resolve(value.toString())
                        }
                    )
                )
            })

            const lines = rawNodes.trim().split("\n")
            nodes = lines.reduce((arr, line) => {
                if (!line) {
                    return arr
                }
                const row = line.split(' ')
                const [
                    node_id,
                    server,
                    flags,
                ] = row
                const [target, slots] = server.split('@')
                const [host, port] = target.split(':')
                const node = {
                    host,
                    port,
                }
                arr.push(node)
                return arr
            }, [])

            return nodes
        } catch (error) {
            console.error(error)
            errors.push(error)
        } finally {
            redis.disconnect()
        }
        if (nodes) {
            break
        }
    }
    if (nodes) {
        return nodes
    }
    const errorsMsg = errors.map(e => e.toString()).join(', ')
    throw new Error('getClusterNodes errors: ' + errorsMsg)
}
