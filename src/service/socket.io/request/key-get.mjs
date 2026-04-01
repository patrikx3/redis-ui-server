import { isProOrEnterpriseTier } from '../../../lib/license-tier.mjs'

const consolePrefix = 'socket.io key get full'


export default async (options) => {
    const {socket, payload} = options;

    try {
        let redis = socket.p3xrs.ioredis

        const key = payload.key;

        //const type = payload.type;

        let type = await redis.type(key)

        // Normalize ReJSON-RL to json (viewing is free, editing requires Pro+)
        if (type === 'ReJSON-RL') {
            type = 'json'
        }

        //console.info(consolePrefix, payload, type, key)

        const viewPipeline = redis.pipeline()
        switch (type) {
            case 'string':
                //viewPipeline.get(key)
                viewPipeline.getBuffer(key)
                break;

            case 'list':
                //viewPipeline.lrange(key, 0, -1)
                viewPipeline.lrangeBuffer(key, 0, -1)
                break;

            case 'hash':
                //viewPipeline.hgetall(key)
                viewPipeline.hgetallBuffer(key)
                break;

            case 'set':
                //viewPipeline.smembers(key)
                viewPipeline.smembersBuffer(key)
                break;

            case 'zset':
                //viewPipeline.zrange(key, 0, -1, 'WITHSCORES')
                viewPipeline.zrangeBuffer(key, 0, -1, 'WITHSCORES')
                break;

            case 'stream':
                //viewPipeline.xrange(key, '-', '+')
                viewPipeline.xrangeBuffer(key, '-', '+')
                break;

            case 'json':
                viewPipeline.call('JSON.GET', key, '$')
                break;
        }
        viewPipeline.ttl(key)

        // JSON keys don't support OBJECT ENCODING
        if (type !== 'json') {
            viewPipeline.object('encoding', key)
        }

        switch (type) {
            case 'stream':
                viewPipeline.xlen(key)
                break;

            case 'hash':
                viewPipeline.hlen(key)
                break;

            case 'list':
                viewPipeline.llen(key)
                break;

            case 'set':
                viewPipeline.scard(key)
                break;

            case 'zset':
                viewPipeline.zcard(key)
                break;
        }


        const viewPipelineResult = await viewPipeline.exec()
        // console.log(viewPipelineResult)

        let valueBuffer = viewPipelineResult[0][1]
        const ttl = viewPipelineResult[1][1]
        let encoding
        let length
        let pipelineIndex = 2

        if (type === 'json') {
            encoding = 'json'
            // JSON.GET returns a JSON string; convert to Buffer for consistency
            if (typeof valueBuffer === 'string') {
                valueBuffer = Buffer.from(valueBuffer)
            }
        } else {
            encoding = viewPipelineResult[pipelineIndex][1]
            pipelineIndex++
        }

        if (type !== 'string' && type !== 'json') {
            length = viewPipelineResult[pipelineIndex][1]
        }

        const socketResult = {
            length: length,
            key: key,
            status: 'ok',
            type: type,
            valueBuffer: valueBuffer,
            ttl: ttl,
            encoding: encoding,
        };
        // console.warn('socketResult', socketResult)
        socket.emit(options.responseEvent, socketResult)
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }


}
