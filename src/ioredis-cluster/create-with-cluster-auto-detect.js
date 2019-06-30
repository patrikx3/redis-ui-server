const Redis = require('ioredis')

const isClusterEnabled = require('./is-cluster-enabled')
const getClusterNodes = require('./get-cluster-nodes')
const Cluster = require('./cluster')
const setDefaultPasswordOptionFromServer = require('./set-default-password-option-from-server')

module.exports = async function createWithClusterAutoDetect(server, options = {}) {
    let isCluster
    if (Array.isArray(server)) {
        isCluster = true
    } else {
        isCluster = await isClusterEnabled(server, true)
    }
    if (!isCluster) {
        return new Redis(server)
    }

    // server = await getClusterNodes(server)

    options = setDefaultPasswordOptionFromServer(options, server)

    return new Cluster(server, options)
}
