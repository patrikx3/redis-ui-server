import Redis from 'ioredis'
import redisInfo from './redis-info.mjs'

export default async function getInfo(server, options = {}) {

    const redis = new Redis(server)
    const rawInfo = await redis.info()
    redis.disconnect()
    const info = redisInfo.parse(rawInfo)

    return info
}
