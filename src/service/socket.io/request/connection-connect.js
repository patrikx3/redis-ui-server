const donationWareFeatureError = new Error('donation-ware-feature')
donationWareFeatureError.code = 'donation-ware-feature'

const consolePrefix = 'socket.io connection-connect';
const Redis = require('../../../lib/ioredis-cluster')

const sharedIoRedis = require('../shared')

const staticCommands = [["xclaim",-6,["write","random","fast"],1,1,1,["@write","@stream","@fast"]],["xgroup",-2,["write","denyoom"],2,2,1,["@write","@stream","@slow"]],["lpos",-3,["readonly"],1,1,1,["@read","@list","@slow"]],["config",-2,["admin","noscript","loading","stale"],0,0,0,["@admin","@slow","@dangerous"]],["zincrby",4,["write","denyoom","fast"],1,1,1,["@write","@sortedset","@fast"]],["hvals",2,["readonly","sort_for_script"],1,1,1,["@read","@hash","@slow"]],["lset",4,["write","denyoom"],1,1,1,["@write","@list","@slow"]],["info",-1,["random","loading","stale"],0,0,0,["@slow","@dangerous"]],["xrange",-4,["readonly"],1,1,1,["@read","@stream","@slow"]],["brpoplpush",4,["write","denyoom","noscript"],1,2,1,["@write","@list","@slow","@blocking"]],["type",2,["readonly","fast"],1,1,1,["@keyspace","@read","@fast"]],["sismember",3,["readonly","fast"],1,1,1,["@read","@set","@fast"]],["pfadd",-2,["write","denyoom","fast"],1,1,1,["@write","@hyperloglog","@fast"]],["set",-3,["write","denyoom"],1,1,1,["@write","@string","@slow"]],["georadiusbymember",-5,["write","denyoom","movablekeys"],1,1,1,["@write","@geo","@slow"]],["zpopmax",-2,["write","fast"],1,1,1,["@write","@sortedset","@fast"]],["bzpopmin",-3,["write","noscript","fast"],1,-2,1,["@write","@sortedset","@fast","@blocking"]],["pttl",2,["readonly","random","fast"],1,1,1,["@keyspace","@read","@fast"]],["script",-2,["noscript"],0,0,0,["@slow","@scripting"]],["scard",2,["readonly","fast"],1,1,1,["@read","@set","@fast"]],["expireat",3,["write","fast"],1,1,1,["@keyspace","@write","@fast"]],["save",1,["admin","noscript"],0,0,0,["@admin","@slow","@dangerous"]],["georadius",-6,["write","denyoom","movablekeys"],1,1,1,["@write","@geo","@slow"]],["object",-2,["readonly","random"],2,2,1,["@keyspace","@read","@slow"]],["lrange",4,["readonly"],1,1,1,["@read","@list","@slow"]],["monitor",1,["admin","noscript","loading","stale"],0,0,0,["@admin","@slow","@dangerous"]],["hsetnx",4,["write","denyoom","fast"],1,1,1,["@write","@hash","@fast"]],["sunion",-2,["readonly","sort_for_script"],1,-1,1,["@read","@set","@slow"]],["hexists",3,["readonly","fast"],1,1,1,["@read","@hash","@fast"]],["decrby",3,["write","denyoom","fast"],1,1,1,["@write","@string","@fast"]],["pexpire",3,["write","fast"],1,1,1,["@keyspace","@write","@fast"]],["geohash",-2,["readonly"],1,1,1,["@read","@geo","@slow"]],["sdiffstore",-3,["write","denyoom"],1,-1,1,["@write","@set","@slow"]],["setnx",3,["write","denyoom","fast"],1,1,1,["@write","@string","@fast"]],["restore",-4,["write","denyoom"],1,1,1,["@keyspace","@write","@slow","@dangerous"]],["xreadgroup",-7,["write","movablekeys"],0,0,0,["@write","@stream","@slow","@blocking"]],["llen",2,["readonly","fast"],1,1,1,["@read","@list","@fast"]],["brpop",-3,["write","noscript"],1,-2,1,["@write","@list","@slow","@blocking"]],["sinter",-2,["readonly","sort_for_script"],1,-1,1,["@read","@set","@slow"]],["append",3,["write","denyoom","fast"],1,1,1,["@write","@string","@fast"]],["rpoplpush",3,["write","denyoom"],1,2,1,["@write","@list","@slow"]],["rpushx",-3,["write","denyoom","fast"],1,1,1,["@write","@list","@fast"]],["hkeys",2,["readonly","sort_for_script"],1,1,1,["@read","@hash","@slow"]],["rpush",-3,["write","denyoom","fast"],1,1,1,["@write","@list","@fast"]],["ttl",2,["readonly","random","fast"],1,1,1,["@keyspace","@read","@fast"]],["scan",-2,["readonly","random"],0,0,0,["@keyspace","@read","@slow"]],["unsubscribe",-1,["pubsub","noscript","loading","stale"],0,0,0,["@pubsub","@slow"]],["lpop",2,["write","fast"],1,1,1,["@write","@list","@fast"]],["setbit",4,["write","denyoom"],1,1,1,["@write","@bitmap","@slow"]],["ping",-1,["stale","fast"],0,0,0,["@fast","@connection"]],["hmset",-4,["write","denyoom","fast"],1,1,1,["@write","@hash","@fast"]],["wait",3,["noscript"],0,0,0,["@keyspace","@slow"]],["hget",3,["readonly","fast"],1,1,1,["@read","@hash","@fast"]],["strlen",2,["readonly","fast"],1,1,1,["@read","@string","@fast"]],["bitcount",-2,["readonly"],1,1,1,["@read","@bitmap","@slow"]],["substr",4,["readonly"],1,1,1,["@read","@string","@slow"]],["auth",-2,["noscript","loading","stale","skip_monitor","skip_slowlog","fast","no_auth"],0,0,0,["@fast","@connection"]],["zinterstore",-4,["write","denyoom","movablekeys"],1,1,1,["@write","@sortedset","@slow"]],["zrank",3,["readonly","fast"],1,1,1,["@read","@sortedset","@fast"]],["geodist",-4,["readonly"],1,1,1,["@read","@geo","@slow"]],["publish",3,["pubsub","loading","stale","fast"],0,0,0,["@pubsub","@fast"]],["xtrim",-2,["write","random"],1,1,1,["@write","@stream","@slow"]],["psync",3,["admin","noscript"],0,0,0,["@admin","@slow","@dangerous"]],["hincrby",4,["write","denyoom","fast"],1,1,1,["@write","@hash","@fast"]],["hstrlen",3,["readonly","fast"],1,1,1,["@read","@hash","@fast"]],["psubscribe",-2,["pubsub","noscript","loading","stale"],0,0,0,["@pubsub","@slow"]],["linsert",5,["write","denyoom"],1,1,1,["@write","@list","@slow"]],["bitpos",-3,["readonly"],1,1,1,["@read","@bitmap","@slow"]],["replicaof",3,["admin","noscript","stale"],0,0,0,["@admin","@slow","@dangerous"]],["del",-2,["write"],1,-1,1,["@keyspace","@write","@slow"]],["hgetall",2,["readonly","random"],1,1,1,["@read","@hash","@slow"]],["echo",2,["readonly","fast"],0,0,0,["@read","@fast","@connection"]],["unwatch",1,["noscript","loading","stale","fast"],0,0,0,["@fast","@transaction"]],["dump",2,["readonly","random"],1,1,1,["@keyspace","@read","@slow"]],["watch",-2,["noscript","loading","stale","fast"],1,-1,1,["@fast","@transaction"]],["zrevrange",-4,["readonly"],1,1,1,["@read","@sortedset","@slow"]],["srandmember",-2,["readonly","random"],1,1,1,["@read","@set","@slow"]],["zrangebylex",-4,["readonly"],1,1,1,["@read","@sortedset","@slow"]],["getrange",4,["readonly"],1,1,1,["@read","@string","@slow"]],["keys",2,["readonly","sort_for_script"],0,0,0,["@keyspace","@read","@slow","@dangerous"]],["sinterstore",-3,["write","denyoom"],1,-1,1,["@write","@set","@slow"]],["sadd",-3,["write","denyoom","fast"],1,1,1,["@write","@set","@fast"]],["zrem",-3,["write","fast"],1,1,1,["@write","@sortedset","@fast"]],["setrange",4,["write","denyoom"],1,1,1,["@write","@string","@slow"]],["flushdb",-1,["write"],0,0,0,["@keyspace","@write","@slow","@dangerous"]],["renamenx",3,["write","fast"],1,2,1,["@keyspace","@write","@fast"]],["getbit",3,["readonly","fast"],1,1,1,["@read","@bitmap","@fast"]],["zremrangebylex",4,["write"],1,1,1,["@write","@sortedset","@slow"]],["pfmerge",-2,["write","denyoom"],1,-1,1,["@write","@hyperloglog","@slow"]],["sunionstore",-3,["write","denyoom"],1,-1,1,["@write","@set","@slow"]],["xsetid",3,["write","denyoom","fast"],1,1,1,["@write","@stream","@fast"]],["hincrbyfloat",4,["write","denyoom","fast"],1,1,1,["@write","@hash","@fast"]],["exists",-2,["readonly","fast"],1,-1,1,["@keyspace","@read","@fast"]],["pfcount",-2,["readonly"],1,-1,1,["@read","@hyperloglog","@slow"]],["time",1,["readonly","random","loading","stale","fast"],0,0,0,["@read","@fast"]],["rename",3,["write"],1,2,1,["@keyspace","@write","@slow"]],["sort",-2,["write","denyoom","movablekeys"],1,1,1,["@write","@set","@sortedset","@list","@slow","@dangerous"]],["pexpireat",3,["write","fast"],1,1,1,["@keyspace","@write","@fast"]],["mset",-3,["write","denyoom"],1,-1,2,["@write","@string","@slow"]],["rpop",2,["write","fast"],1,1,1,["@write","@list","@fast"]],["evalsha",-3,["noscript","movablekeys"],0,0,0,["@slow","@scripting"]],["subscribe",-2,["pubsub","noscript","loading","stale"],0,0,0,["@pubsub","@slow"]],["bitfield_ro",-2,["readonly","fast"],1,1,1,["@read","@bitmap","@fast"]],["zscore",3,["readonly","fast"],1,1,1,["@read","@sortedset","@fast"]],["multi",1,["noscript","loading","stale","fast"],0,0,0,["@fast","@transaction"]],["smembers",2,["readonly","sort_for_script"],1,1,1,["@read","@set","@slow"]],["hdel",-3,["write","fast"],1,1,1,["@write","@hash","@fast"]],["psetex",4,["write","denyoom"],1,1,1,["@write","@string","@slow"]],["expire",3,["write","fast"],1,1,1,["@keyspace","@write","@fast"]],["georadius_ro",-6,["readonly"],1,1,1,["@read","@geo","@slow"]],["client",-2,["admin","noscript","random","loading","stale"],0,0,0,["@admin","@slow","@dangerous","@connection"]],["mget",-2,["readonly","fast"],1,-1,1,["@read","@string","@fast"]],["xrevrange",-4,["readonly"],1,1,1,["@read","@stream","@slow"]],["get",2,["readonly","fast"],1,1,1,["@read","@string","@fast"]],["spop",-2,["write","random","fast"],1,1,1,["@write","@set","@fast"]],["latency",-2,["admin","noscript","loading","stale"],0,0,0,["@admin","@slow","@dangerous"]],["restore-asking",-4,["write","denyoom","asking"],1,1,1,["@keyspace","@write","@slow","@dangerous"]],["bitop",-4,["write","denyoom"],2,-1,1,["@write","@bitmap","@slow"]],["hello",-2,["noscript","loading","stale","skip_monitor","skip_slowlog","fast","no_auth"],0,0,0,["@fast","@connection"]],["decr",2,["write","denyoom","fast"],1,1,1,["@write","@string","@fast"]],["zcount",4,["readonly","fast"],1,1,1,["@read","@sortedset","@fast"]],["pfdebug",-3,["write","admin"],0,0,0,["@write","@admin","@slow","@dangerous"]],["incrby",3,["write","denyoom","fast"],1,1,1,["@write","@string","@fast"]],["unlink",-2,["write","fast"],1,-1,1,["@keyspace","@write","@fast"]],["xdel",-3,["write","fast"],1,1,1,["@write","@stream","@fast"]],["zrevrangebyscore",-4,["readonly"],1,1,1,["@read","@sortedset","@slow"]],["swapdb",3,["write","fast"],0,0,0,["@keyspace","@write","@fast","@dangerous"]],["cluster",-2,["admin","random","stale"],0,0,0,["@admin","@slow","@dangerous"]],["srem",-3,["write","fast"],1,1,1,["@write","@set","@fast"]],["xpending",-3,["readonly","random"],1,1,1,["@read","@stream","@slow"]],["host:",-1,["readonly","loading","stale"],0,0,0,["@read","@slow"]],["eval",-3,["noscript","movablekeys"],0,0,0,["@slow","@scripting"]],["touch",-2,["readonly","fast"],1,-1,1,["@keyspace","@read","@fast"]],["flushall",-1,["write"],0,0,0,["@keyspace","@write","@slow","@dangerous"]],["acl",-2,["admin","noscript","loading","stale","skip_slowlog"],0,0,0,["@admin","@slow","@dangerous"]],["geoadd",-5,["write","denyoom"],1,1,1,["@write","@geo","@slow"]],["post",-1,["readonly","loading","stale"],0,0,0,["@read","@slow"]],["ltrim",4,["write"],1,1,1,["@write","@list","@slow"]],["lindex",3,["readonly"],1,1,1,["@read","@list","@slow"]],["zremrangebyrank",4,["write"],1,1,1,["@write","@sortedset","@slow"]],["migrate",-6,["write","random","movablekeys"],0,0,0,["@keyspace","@write","@slow","@dangerous"]],["hscan",-3,["readonly","random"],1,1,1,["@read","@hash","@slow"]],["lpush",-3,["write","denyoom","fast"],1,1,1,["@write","@list","@fast"]],["slaveof",3,["admin","noscript","stale"],0,0,0,["@admin","@slow","@dangerous"]],["pubsub",-2,["pubsub","random","loading","stale"],0,0,0,["@pubsub","@slow"]],["zremrangebyscore",4,["write"],1,1,1,["@write","@sortedset","@slow"]],["incrbyfloat",3,["write","denyoom","fast"],1,1,1,["@write","@string","@fast"]],["persist",2,["write","fast"],1,1,1,["@keyspace","@write","@fast"]],["blpop",-3,["write","noscript"],1,-2,1,["@write","@list","@slow","@blocking"]],["zcard",2,["readonly","fast"],1,1,1,["@read","@sortedset","@fast"]],["randomkey",1,["readonly","random"],0,0,0,["@keyspace","@read","@slow"]],["slowlog",-2,["admin","random","loading","stale"],0,0,0,["@admin","@slow","@dangerous"]],["replconf",-1,["admin","noscript","loading","stale"],0,0,0,["@admin","@slow","@dangerous"]],["hmget",-3,["readonly","fast"],1,1,1,["@read","@hash","@fast"]],["xlen",2,["readonly","fast"],1,1,1,["@read","@stream","@fast"]],["sync",1,["admin","noscript"],0,0,0,["@admin","@slow","@dangerous"]],["georadiusbymember_ro",-5,["readonly"],1,1,1,["@read","@geo","@slow"]],["xack",-4,["write","random","fast"],1,1,1,["@write","@stream","@fast"]],["xread",-4,["readonly","movablekeys"],0,0,0,["@read","@stream","@slow","@blocking"]],["geopos",-2,["readonly"],1,1,1,["@read","@geo","@slow"]],["bitfield",-2,["write","denyoom"],1,1,1,["@write","@bitmap","@slow"]],["readwrite",1,["fast"],0,0,0,["@keyspace","@fast"]],["debug",-2,["admin","noscript","loading","stale"],0,0,0,["@admin","@slow","@dangerous"]],["lastsave",1,["readonly","random","loading","stale","fast"],0,0,0,["@read","@admin","@fast","@dangerous"]],["shutdown",-1,["admin","noscript","loading","stale"],0,0,0,["@admin","@slow","@dangerous"]],["zrevrank",3,["readonly","fast"],1,1,1,["@read","@sortedset","@fast"]],["move",3,["write","fast"],1,1,1,["@keyspace","@write","@fast"]],["setex",4,["write","denyoom"],1,1,1,["@write","@string","@slow"]],["hlen",2,["readonly","fast"],1,1,1,["@read","@hash","@fast"]],["readonly",1,["fast"],0,0,0,["@keyspace","@fast"]],["role",1,["readonly","noscript","loading","stale","fast"],0,0,0,["@read","@fast","@dangerous"]],["module",-2,["admin","noscript"],0,0,0,["@admin","@slow","@dangerous"]],["discard",1,["noscript","loading","stale","fast"],0,0,0,["@fast","@transaction"]],["pfselftest",1,["admin"],0,0,0,["@hyperloglog","@admin","@slow","@dangerous"]],["asking",1,["fast"],0,0,0,["@keyspace","@fast"]],["smove",4,["write","fast"],1,2,1,["@write","@set","@fast"]],["xadd",-5,["write","denyoom","random","fast"],1,1,1,["@write","@stream","@fast"]],["bgsave",-1,["admin","noscript"],0,0,0,["@admin","@slow","@dangerous"]],["xinfo",-2,["readonly","random"],2,2,1,["@read","@stream","@slow"]],["zpopmin",-2,["write","fast"],1,1,1,["@write","@sortedset","@fast"]],["bgrewriteaof",1,["admin","noscript"],0,0,0,["@admin","@slow","@dangerous"]],["zunionstore",-4,["write","denyoom","movablekeys"],1,1,1,["@write","@sortedset","@slow"]],["lpushx",-3,["write","denyoom","fast"],1,1,1,["@write","@list","@fast"]],["command",-1,["random","loading","stale"],0,0,0,["@slow","@connection"]],["zrange",-4,["readonly"],1,1,1,["@read","@sortedset","@slow"]],["memory",-2,["readonly","random","movablekeys"],0,0,0,["@read","@slow"]],["lolwut",-1,["readonly","fast"],0,0,0,["@read","@fast"]],["lrem",4,["write"],1,1,1,["@write","@list","@slow"]],["hset",-4,["write","denyoom","fast"],1,1,1,["@write","@hash","@fast"]],["punsubscribe",-1,["pubsub","noscript","loading","stale"],0,0,0,["@pubsub","@slow"]],["stralgo",-2,["readonly","movablekeys"],0,0,0,["@read","@string","@slow"]],["bzpopmax",-3,["write","noscript","fast"],1,-2,1,["@write","@sortedset","@fast","@blocking"]],["getset",3,["write","denyoom","fast"],1,1,1,["@write","@string","@fast"]],["sscan",-3,["readonly","random"],1,1,1,["@read","@set","@slow"]],["zadd",-4,["write","denyoom","fast"],1,1,1,["@write","@sortedset","@fast"]],["zscan",-3,["readonly","random"],1,1,1,["@read","@sortedset","@slow"]],["select",2,["loading","stale","fast"],0,0,0,["@keyspace","@fast"]],["sdiff",-2,["readonly","sort_for_script"],1,-1,1,["@read","@set","@slow"]],["zrangebyscore",-4,["readonly"],1,1,1,["@read","@sortedset","@slow"]],["incr",2,["write","denyoom","fast"],1,1,1,["@write","@string","@fast"]],["zlexcount",4,["readonly","fast"],1,1,1,["@read","@sortedset","@fast"]],["msetnx",-3,["write","denyoom"],1,-1,2,["@write","@string","@slow"]],["exec",1,["noscript","loading","stale","skip_monitor","skip_slowlog"],0,0,0,["@slow","@transaction"]],["zrevrangebylex",-4,["readonly"],1,1,1,["@read","@sortedset","@slow"]],["dbsize",1,["readonly","fast"],0,0,0,["@keyspace","@read","@fast"]]]


const generateConnectInfo = async (options) => {
    const {socket, redis, payload} = options
    const { db} = payload
    // console.warn('generateConnectInfo', options.payload)


    let databases
    //let results
    let commands = staticCommands

    const probeDatabaseCount = async() => {
        let tryUntilSelectDatabaseIsNotOk = true
        let currentDb = 0
        let totalDb = 0
        let maxDb = 512
        while(tryUntilSelectDatabaseIsNotOk) {
            try {
                currentDb++
                await redis.call('select', currentDb)
                //console.info('found correct database index', currentDb)
                if (currentDb > maxDb) {
                    console.warn(`limiting to max ${maxDb} database index, as it could crash with a big db index number`)
                    tryUntilSelectDatabaseIsNotOk = false
                }
            } catch(e) {
                console.warn('found wrong current db index', currentDb)
                tryUntilSelectDatabaseIsNotOk = false
            }
        }
        totalDb = currentDb
        if (db <= totalDb) {
            await redis.call('select', db)
        }
        console.log('calculated max databases index', totalDb)
        return totalDb
    }

    if (options.payload.connection.cluster === true) {
        databases = 1
        //commands = await redis.command()
    } else {
        databases = await probeDatabaseCount()
    }

    try {
        //commands = await redis.call('command2')
        commands = await redis.command()
        console.info(options.payload.connection.name, 'instance, command listing is available')
    } catch(e) {
        console.warn(options,payload.connection.name, 'instance, command listing is not available, not all redis instances are not avilable command listing', e)
    }

    //console.log(JSON.stringify(commands))
    //socket.p3xrs.commands = commands.map(e => e[0].toLowerCase())

    //console.log('payload', payload)

    await sharedIoRedis.getFullInfoAndSendSocket({
        setDb: true,
        redis: redis,
        responseEvent: options.responseEvent,
        socket: socket,
        extend: {
            databases: databases,
            commands: commands
        },
        payload: payload,

    })
}

module.exports = async (options) => {
    const {socket, payload} = options;

    const {connection, db} = payload


    try {
        if (!p3xrs.cfg.donated) {
            if (payload.connection.cluster === true) {
                throw donationWareFeatureError
            }
        }


        if (socket.p3xrs.connectionId !== connection.id) {
            sharedIoRedis.disconnectRedis({
                socket: socket,
            })
        }

        if (!p3xrs.redisConnections.hasOwnProperty(connection.id)) {
            p3xrs.redisConnections[connection.id] = {
                connection: connection,
                clients: []
            }
        }
        if (!p3xrs.redisConnections[connection.id].clients.includes(socket.id)) {
            console.info(consolePrefix, 'added new socket.id', socket.id, 'to', connection.id, 'name with', connection.name)
            p3xrs.redisConnections[connection.id].clients.push(socket.id)
        }

        if (socket.p3xrs.ioredis !== undefined) {
            console.info(consolePrefix, 'redis was already connected')
            socket.p3xrs.connectionId = connection.id
            await generateConnectInfo({
                redis: socket.p3xrs.ioredis,
                socket: socket,
                responseEvent: options.responseEvent,
                payload: payload
            })

            sharedIoRedis.sendStatus({
                socket: socket,
            })
        } else {
            const actualConnection = p3xrs.connections.list.find(con => options.payload.connection.id === con.id)
            if (actualConnection === undefined) {
                throw new Error('auto-connection-failed')
            }
            let redisConfig = Object.assign({}, actualConnection);
            delete redisConfig.name
            delete redisConfig.id
            redisConfig.retryStrategy = () => {
                return false
            }


            /*
            redisConfig.showFriendlyErrorStack = true
            if (db !== undefined) {
                redisConfig.db = db
            }
             */

            if (redisConfig.cluster === true) {
                redisConfig = [redisConfig].concat(actualConnection.nodes)
            }
            
            if (redisConfig.tlsWithoutCert) {
                redisConfig.tls =  {
                }
            } else if (typeof redisConfig.tlsCa === 'string' && redisConfig.tlsCa.trim() !== '') {
                redisConfig.tls = {
                    //rejectUnauthorized: false,
                    cert: redisConfig.tlsCrt,
                    key: redisConfig.tlsKey,
                    ca: redisConfig.tlsCa,
                }
            }
            if ((typeof redisConfig.tlsCa === 'string' && redisConfig.tlsCa.trim() !== '') || redisConfig.tlsWithoutCert) {
                redisConfig.tls.rejectUnauthorized = redisConfig.tlsRejectUnauthorized === undefined ? false : redisConfig.tlsRejectUnauthorized
            }
            
            let redis = new Redis(redisConfig)
            let redisSubscriber = new Redis(redisConfig)
            // let redis = await new Redis(redisConfig, {autoDetectCluster: true})
            // let redisSubscriber = await new Redis(redisConfig, {autoDetectCluster: true})
            socket.p3xrs.connectionId = connection.id
            socket.p3xrs.readonly = actualConnection.readonly === true
            socket.p3xrs.ioredis = redis
            socket.p3xrs.ioredisSubscriber = redisSubscriber
            let didConnected = false

            const redisErrorFun = async function (error) {
                const consolePrefix = 'socket.io connection-connect redis error fun'
                console.warn(consolePrefix, connection.id, connection.name, 'error')
                console.error(error)
                console.warn(consolePrefix, 'didConnected', didConnected)
                if (!didConnected) {
                    socket.emit(options.responseEvent, {
                        status: 'error',
                        error: error.message
                    })
                }
                const disconnectedData = {
                    connectionId: socket.p3xrs.connectionId,
                    error: error.message,
                    status: 'error',
                }
                console.warn(consolePrefix, 'disconnectedData', disconnectedData)
                socket.p3xrs.io.emit('redis-disconnected', disconnectedData)

                try {
                    await sharedIoRedis.disconnectRedis({
                        socket: socket,
                    })
                } catch (e) {
                    console.warn(consolePrefix, 'disconnectRedis')
                    console.error(e)
                }
                delete p3xrs.redisConnections[socket.connectionId]

                socket.p3xrs.connectionId = undefined
                socket.p3xrs.ioredis = undefined
                socket.p3xrs.ioredisSubscriber = undefined

                sharedIoRedis.sendStatus({
                    socket: socket,
                })
            }

            redis.on('error', redisErrorFun)
            redisSubscriber.on('error', redisErrorFun)

            //console.warn('create psubscribe', actualConnection.id)
            redisSubscriber.psubscribe('*', function (error, count) {
                if (error) {
                    console.error(error)
                }
            })

            //console.warn('create pmessage', actualConnection.id)
            redisSubscriber.on('pmessage', function (channel, pattern, message) {
                //console.log(`receive pmessage channel: ${channel} - pattern: ${pattern}, message: ${message}`);
                //console.log('list clients', actualConnection.id, JSON.stringify(p3xrs.redisConnections[actualConnection.id].clients, null, 4))
                socket.emit('pubsub-message', {
                    channel: pattern,
                    message: message,
                })
            });

            redis.on('connect', async function () {

                try {
                    console.info(consolePrefix, options.payload.connection.id, options.payload.connection.name, 'connected')
                    didConnected = true


                    await generateConnectInfo({
                        redis: redis,
                        socket: socket,
                        responseEvent: options.responseEvent,
                        payload: options.payload,
                    })

                } catch (e) {
                    console.error(e)
                    socket.emit(options.responseEvent, {
                        status: 'error',
                        error: e.message,
                    })
                } finally {
                    sharedIoRedis.sendStatus({
                        socket: socket,
                    })

                }


            })

        }

    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message
        })

    }

}
