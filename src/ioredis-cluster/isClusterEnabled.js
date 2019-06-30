const getInfo = require('./getInfo')
module.exports = async function isClusterEnabled(server, cache = false) {
    const {cluster_enabled} = await getInfo(server, {cache})
    return Boolean(parseInt(cluster_enabled))
}
