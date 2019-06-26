const IORedis = require('ioredis')
const redisInfo = require('redis-info')
const {EventEmitter} = require('events')

const redisInfoCache = new Map()
const redisNodesCache = new Map()
async function getInfo(server){
  if(redisInfoCache.has(server)){
    return redisInfoCache.get(server)
  }
  const redis = new Redis(server)
  const rawInfo = await redis.info()
  const info = redisInfo.parse(rawInfo)
  redisInfoCache.set(server, info)
  return info
}
async function isClusterEnabled(server){
  const {cluster_enabled} = await getInfo(server)
  return Boolean(parseInt(cluster_enabled))
}
async function getClusterNodes(server, force = false){
  if(redisNodesCache.has(server) && !force){
    return redisNode.get(server)
  }
  const redis = new Redis(server)

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
  redisNodesCache.set(server, nodes)
  return nodes
}
async function createRedis(server, defaultConfig = {}){
  if(Array.isArray(server)){
    return new Redis.Cluster(server)
  }

  const clusterEnabled = await isClusterEnabled(server)
  if(!clusterEnabled){
    return new Redis(server)
  }

  const nodes = await getClusterNodes(server)

  // console.log({nodes})

  const servers = nodes.map(node =>{
    return {...defaultConfig, ...node}
  })

  // console.log({servers})
  return new RedisCluster(servers)
}

class Cluster extends IORedis.Cluster{
  static create = createRedis
  originalRename(...args){
    return super.rename(...args)
  }
  async rename(key, keyNew, callback){
    let res = null
    let err = null
    try{
      let [ value, ttl ] = await Promise.all([
        this.dumpBuffer(key),
        this.ttl(key),
      ])
      ttl = parseInt(ttl)
      if(ttl<0){
        ttl = 0
      }
      await this.del(keyNew)
      await this.restore(keyNew, ttl, value)
      await this.del(key)
      res = 'OK'
    }
    catch(e){
      err = e
    }

    if(typeof callback === 'function'){
      callback(err, res)
    }
    else if (err){
      throw err
    }
    return res

  }
  originalPipeline(...args){
    return super.pipeline(...args)
  }
  pipeline(...pipelineArgs){
    const calls = []
    async function exec(calls){
      const results = []
      for(let c of calls){
        const result = await c()
        results.push(result)
      }
      // console.log({results})
      return results
    }
    const proxy = new Proxy(calls, {
      get: (calls, method)=>{
        return (...callArgs)=>{
          switch(method){
            case 'exec':
              return exec(calls)
              break
          }
          const callback = async () => {
            let err = null
            let result = null
            try{
              result = await this[method](...callArgs)
            }
            catch(e){
              err = e
            }
            return [err, result]
          }
          calls.push(callback)
          return proxy
        }
      }
    })
    return proxy

  }
  scanStream(...args){
    const stream = new EventEmitter()
    this.streamNodes({
      stream,
      method: 'scanStream',
      params: args,
    })
    return stream
  }
  async streamNodes(options={}){
    let {
      nodes = this.nodes('master'),
      stream = new EventEmitter(),
      method,
      params = [],
    } = options
    for(let node of nodes){
      await new Promise((resolve, reject)=>{
        const nodeStream = node[method](...params)
        nodeStream.on('data', (resultKeys) => {
          // console.log({resultKeys})
          stream.emit('data', resultKeys)
        })
        nodeStream.on('end', async () => {
          try {
            resolve()
          } catch (e) {
            stream.emit('error',e)
            reject(e)
          }
        })
      })
    }
    stream.emit('end')
  }
}

function Redis(server, options){
  if(Array.isArray(server)){
    return new Cluster(server, options)
  }
  else{
    return new IORedis(server, options)
  }
  return
}
Redis.Cluster = Cluster


module.exports = Redis