const consolePrefix = 'socket.io key get full'



module.exports = async(options) => {
    const { socket, payload } = options;

    try {
        let redis = socket.p3xrs.ioredis

        const key = payload.key;

        //const type = payload.type;

        const type = await redis.type(key)

        //console.info(consolePrefix, payload, type, key)

        const viewPipeline = redis.pipeline()
        switch(type) {
            case 'string':
                viewPipeline.get(key)
                break;

            case 'list':
                viewPipeline.lrange(key, 0, -1)
                break;

            case 'hash':
                viewPipeline.hgetall(key)
                break;

            case 'set':
                viewPipeline.smembers(key)
                break;

            case 'zset':
                viewPipeline.zrange(key, 0, -1, 'WITHSCORES')
                break;
        }
        viewPipeline.ttl(key)
        viewPipeline.object('encoding', key)

        switch(type) {
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

        const value = viewPipelineResult[0][1]
        const ttl = viewPipelineResult[1][1]
        const encoding = viewPipelineResult[2][1]
        let length

        if (type !== 'string') {
            length = viewPipelineResult[3][1]
        }

        const socketResult = {
            length: length,
            key: key,
            status: 'ok',
            type: type,
            value: value,
            ttl: ttl,
            encoding: encoding,
        };
       // console.warn('socketResult', socketResult)
        socket.emit(options.responseEvent, socketResult)
    } catch(e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e,
        })
    }


}