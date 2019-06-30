const IORedis = require('ioredis')
const redisInfo = require('redis-info')

const Cluster = require('./Cluster')
const createWithClusterAutoDetect = require('./createWithClusterAutoDetect')

const getInfo = require('./getInfo')
const getClusterNodes = require('./getClusterNodes')
const isClusterEnabled = require('./isClusterEnabled')

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
    infoObject(...args){
      const info = this.info(...args)
      return redisInfo.parse(info)
    }
}

Redis.Cluster = Cluster
Redis.isClusterEnabled = isClusterEnabled
Redis.getClusterNodes = getClusterNodes
Redis.getInfo = getInfo

module.exports = Redis
