const getInfo = require('./getInfo')
module.exports = async function isClusterEnabled(server){
    const {cluster_enabled} = await getInfo(server)
    return Boolean(parseInt(cluster_enabled))
}