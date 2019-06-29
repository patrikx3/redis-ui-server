const Redis = require('ioredis')
const redisInfo = require('redis-info')
const hash = require('object-hash')

const redisInfoCache = {}
module.exports = async function getInfo(server, options={}){
    const {
      cache = true,
      force = false,
    } = options
    const id = cache ? hash(server) : null
    if(cache && !force && redisInfoCache[id]){
        return redisInfoCache[id]
    }
    const redis = new Redis(server)
    const rawInfo = await redis.info()
    const info = redisInfo.parse(rawInfo)
    if(cache){
      redisInfoCache[id] = info
    }
    return info
}