const Redis = require('ioredis')

const isClusterEnabled = require('./isClusterEnabled')
const getClusterNodes = require('./getClusterNodes')
const Cluster = require('./Cluster')
const setDefaultPasswordOptionFromServer = require('./setDefaultPasswordOptionFromServer')

module.exports = async function createWithClusterAutoDetect(server, options = {}){
    let isCluster
    if(Array.isArray(server)){
        isCluster = true
    }
    else{
        isCluster = await isClusterEnabled(server)
    }
    if(!isCluster){
        return new Redis(server)
    }

    // server = await getClusterNodes(server)

    options = setDefaultPasswordOptionFromServer(options, server)

    return new Cluster(server, options)
}