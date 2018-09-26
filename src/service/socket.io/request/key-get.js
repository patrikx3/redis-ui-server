const consolePrefix = 'socket.io key get full'



module.exports = async(options) => {
    const { socket, payload } = options;

    try {
        let redis = socket.p3xrs.ioredis

        const key = payload.key;
        const type = payload.type;

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

        const viewPipelineResult = await viewPipeline.exec()
       // console.log(viewPipelineResult)

        const value = viewPipelineResult[0][1]
        const ttl = viewPipelineResult[1][1]
        const encoding = viewPipelineResult[2][1]

        const socketResult = {
            status: 'ok',
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