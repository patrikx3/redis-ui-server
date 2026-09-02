import Redis from 'ioredis'
import isClusterEnabled from './is-cluster-enabled.mjs'
import Cluster from './cluster.mjs'
import setDefaultOptionsFromServer from './set-default-options-from-server.mjs'
import withResp2 from './resp2.mjs'

export default async function createWithClusterAutoDetect(server, options = {}) {
    let isCluster
    if (Array.isArray(server)) {
        isCluster = true
    } else {
        isCluster = await isClusterEnabled(server, true)
    }
    if (!isCluster) {
        return new Redis(withResp2(server))
    }

    // server = await getClusterNodes(server)

    options = setDefaultOptionsFromServer(options, server)

    return new Cluster(server, options)
}
