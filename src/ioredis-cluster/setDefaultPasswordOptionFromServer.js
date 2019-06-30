const getDefaultPasswordFromServer = require('./getDefaultPasswordFromServer')
module.exports = function setDefaultPasswordOptionFromServer(options, server) {
    const defaultPassword = getDefaultPasswordFromServer(server)
    let {redisOptions} = options
    if (redisOptions === undefined) {
        redisOptions = {}
        options.redisOptions = redisOptions
    }
    if (redisOptions.password === undefined) {
        redisOptions.password = defaultPassword
    }
    return options
}
