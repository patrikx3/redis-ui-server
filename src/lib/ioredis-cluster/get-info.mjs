import Redis from 'ioredis'
import redisInfo from './redis-info.mjs'
import withResp2 from './resp2.mjs'

export default async function getInfo(server, options = {}) {

    const redis = new Redis(withResp2(server))
    const rawInfo = await redis.info()
    redis.disconnect()
    const info = redisInfo.parse(rawInfo)

    return info
}
