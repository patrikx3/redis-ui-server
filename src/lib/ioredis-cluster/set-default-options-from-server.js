function getDefaultOptionsFromServer(server) {
    const server1 = Array.isArray(server) ? server[0] : server
    if (typeof server1 === 'object' && server1 !== null) {
        return server1
    }
}

module.exports = function(options, server) {
    const serverOptions = getDefaultOptionsFromServer(server)
    //console.log('serverOptions', serverOptions)
    let redisOptions = options.redisOptions
    if (redisOptions === undefined) {
        redisOptions = {}
        options.redisOptions = redisOptions
    }
    if (redisOptions.password === undefined) {
        redisOptions.password = serverOptions.password
    }
    if (serverOptions.tlsWithoutCert) {
        redisOptions.tls =  {
        }
    } else if (typeof serverOptions.tlsCa === 'string' && serverOptions.tlsCa.trim() !== '') {
        redisOptions.tls = {
            cert: serverOptions.tlsCrt,
            key: serverOptions.tlsKey,
            ca: serverOptions.tlsCa,
        }
    }
    if (redisOptions.hasOwnProperty('tls')) {
        redisOptions.tls.rejectUnauthorized = redisOptions.tlsRejectUnauthorized === undefined ? false : redisOptions.tlsRejectUnauthorized 
    }
    return options
}
