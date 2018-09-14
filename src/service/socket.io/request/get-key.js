const consolePrefix = 'socket.io get key full'

const sharedIoRedis = require('../shared')

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
                viewPipeline.zrange(key, 0, -1)
                //viewPipeline.zrangebyscore(key, 0, -1)
                break;
        }
        viewPipeline.ttl(key)
        viewPipeline.object('encoding', key)

        const viewPipelineResult = await viewPipeline.exec()
       // console.log(viewPipelineResult)

        const value = viewPipelineResult[0][1]
        const ttl = viewPipelineResult[1][1]
        const encoding = viewPipelineResult[2][1]

        let score
        switch(type) {
            case 'zset':
                const sortedSetScorePipeline = redis.pipeline()
                for(let sortedSetValue of value) {
                    sortedSetScorePipeline.zscore(key, sortedSetValue)
                }
                const sortedSetScorePipelineResult = await sortedSetScorePipeline.exec();

                score = {}
                for(let sortedSetValueIndex in value) {
                    const sortedSetValue = value[sortedSetValueIndex]
                    score[parseFloat(sortedSetScorePipelineResult[sortedSetValueIndex][1])] = sortedSetValue
                }
                break;

                /*
            case 'string':
                break;

            case 'list':
                break;

            case 'hash':
                break;

            case 'set':
                break;
                */
        }

        const socketResult = {
            status: 'ok',
            value: value,
            ttl: ttl,
            score: score,
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