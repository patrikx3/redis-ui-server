const Redis = require('ioredis')
const {EventEmitter} = require('events')

const setDefaultPasswordOptionFromServer = require('./setDefaultPasswordOptionFromServer')

module.exports = class Cluster extends Redis.Cluster{
    constructor(server, options={}){
      server = Array.isArray(server) ? server : [server]
      options = setDefaultPasswordOptionFromServer(options, server)
      super(server, options)
    }
    async dbsize(){
        const nodeCounts = await Promise.all( this.nodes('master').reduce((promises, node) => {
          promises.push(node.dbsize())
          return promises
        }, []))
        const count = nodeCounts.reduce((tt, c) => tt+c ,0)
        return count
    }
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
        this._streamNodes({
            stream,
            method: 'scanStream',
            params: args,
        })
        return stream
    }
    async _streamNodes(options={}){
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
