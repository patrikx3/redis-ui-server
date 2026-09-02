import IORedis from 'ioredis'
import redisInfo from './redis-info.mjs'
import Cluster from './cluster.mjs'
import createWithClusterAutoDetect from './create-with-cluster-auto-detect.mjs'
import withResp2 from './resp2.mjs'
import getInfo from './get-info.mjs'
import getClusterNodes from './get-cluster-nodes.mjs'
import isClusterEnabled from './is-cluster-enabled.mjs'

class Redis extends IORedis {
    constructor(server, {autoDetectCluster, ...options} = {}) {
        server = withResp2(server)
        if (autoDetectCluster && !Array.isArray(server)) {
            return createWithClusterAutoDetect(server, options)
        }
        if (Array.isArray(server)) {
            return new Cluster(server, options)
        }
        super(server)
    }

    /*
    async infoObject(...args) {
        const info = await this.info(...args)
        return redisInfo.parse(info)
    }
     */
}

Object.defineProperty(Redis, 'Cluster', { value: Cluster, writable: true, configurable: true })
Redis.isClusterEnabled = isClusterEnabled
Redis.getClusterNodes = getClusterNodes
Redis.getInfo = getInfo

export default Redis
