const Redis = require('ioredis')
const hash = require('object-hash')

const redisNodesCache = {}
module.exports = async function getClusterNodes(servers, options={}){

    if(!Array.isArray(servers)){
      servers = [servers]
    }

    for(const server of servers){
      try{

        const {
          cache = true,
          force = false,
        } = options
        const id = cache ? hash(server) : null
        if(cache && !force && redisNodesCache[id]){
          return redisNodesCache[id]
        }
        const redis = new Redis({...server, retryStrategy: ()=>false})

        const rawNodes = await new Promise((resolve, reject)=>{
          redis.sendCommand(
            new Redis.Command(
              'CLUSTER',
              ['NODES'],
              'utf-8',
              function(err,value) {
                if (err)
                reject(err)
                else
                resolve(value.toString())
              }
            )
          )
        })

        const lines = rawNodes.trim().split("\n")
        const nodes = lines.reduce((arr, line)=>{
          if(!line){
            return arr
          }
          const row = line.split(' ')
          const [
            node_id,
            server,
            flags,
          ] = row
          const [ target, slots ] = server.split('@')
          const [ host, port ] = target.split(':')
          const node = {
            host,
            port,
          }
          arr.push(node)
          return arr
        }, [])
        if(cache){
          redisNodesCache[id] = nodes
        }
        return nodes
    }
    catch(e){
      console.error(e)
    }
  }
  return false
}