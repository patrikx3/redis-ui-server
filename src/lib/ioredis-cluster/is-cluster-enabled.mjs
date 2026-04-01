import getInfo from './get-info.mjs'

export default async function isClusterEnabled(server, cache = false) {
    const {cluster_enabled} = await getInfo(server, {cache})
    return Boolean(parseInt(cluster_enabled))
}
