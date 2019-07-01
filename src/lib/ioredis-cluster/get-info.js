const Redis = require('ioredis')
const redisInfo = require('./redis-info')

module.exports = async function getInfo(server, options = {}) {

    const redis = new Redis(server)
    const rawInfo = await redis.info()
    redis.disconnect()
    const info = redisInfo.parse(rawInfo)

    return info
}
