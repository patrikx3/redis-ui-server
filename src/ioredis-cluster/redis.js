const IORedis = require('ioredis')
const Cluster = require('./cluster')
const createWithClusterAutoDetect = require('./create-with-cluster-auto-detect')

const getInfo = require('./get-info')
const getClusterNodes = require('./get-cluster-nodes')
const isClusterEnabled = require('./is-cluster-enabled')

class Redis extends IORedis {
    constructor(server, {autoDetectCluster, ...options} = {}) {
        if (autoDetectCluster && !Array.isArray(server)) {
            return createWithClusterAutoDetect(server, options)
        }
        if (Array.isArray(server)) {
            return new Cluster(server, options)
        }
        super(server)
    }
}

Redis.Cluster = Cluster
Redis.isClusterEnabled = isClusterEnabled
Redis.getClusterNodes = getClusterNodes
Redis.getInfo = getInfo

module.exports = Redis
