const utils = require('corifeus-utils')
module.exports = async (options) => {
    const { socket } = options;

    p3xrs.cfg.donated = true
    socket.emit(options.responseEvent || 'info-interval', {
        donated: true,
        info: 'ok',
        status: 'ok',
    })

        /*

    console.log(new Date().toLocaleString(), 'check license')

    let license = options.payload.license || '';

    let donated = false
    try {
        let serverError = false

        let disableDonated = false
        if (typeof license === 'string' && license.trim().length === 0) {
            disableDonated = true
        }
        if (disableDonated === false && (typeof license !== 'string' || license.length !== 128)) {
            throw new Error('invalid_license')
        }

        if (!disableDonated) {
            const response = await utils.http.request({
                url: `https://server.patrikx3.com/api/patrikx3/redis-ui/status/${license}`
//                url: `https://server.patrikx3.com/api/patrikx3/test/521`
            })
            if (response.statusCode !== 200) {
                license = ''
                serverError = true
            } else if (response.body.isValid === false) {
                license = ''
            } else {
                donated = true
            }
        }

        if (typeof license === 'string' && license.length === 128) {
            console.log(new Date().toLocaleString(), 'valid license')
        } else {
            console.log(new Date().toLocaleString(), 'in-valid license')
        }
        const fs = require('fs')
        p3xrs.connections.license = license
        fs.writeFileSync(p3xrs.cfg.connections.home, JSON.stringify(p3xrs.connections, null, 4))

        p3xrs.cfg.donated = donated

        socket.emit(options.responseEvent || 'info-interval', {
            donated: donated,
            info: disableDonated ? 'cleared_license' : (serverError ? 'server_error': 'ok'),
            status: 'ok',
        })
    } catch (e) {
        p3xrs.cfg.donated = false
        console.error(e)
        socket.emit(options.responseEvent || 'info-interval', {
            donated: false,
            status: 'error',
            error: e.message
        })

    }
            */
}
