require('corifeus-utils');

const boot = async () => {

    global.p3xrs = {}

    p3xrs.cfg = undefined

    const cli = require('./cli');


    if (!cli()) {
        return;
    }

    const consoleStamp = require('./console-stamp')
    consoleStamp()


    const koaService = require('../service/koa')
    p3xrs.koa = new koaService()
    await p3xrs.koa.boot()

    const socketIoService = require('../service/socket.io')
    p3xrs.socketIo = new socketIoService();
    await p3xrs.socketIo.boot({
        koaService: p3xrs.koa
    })

    /*
    const checkLicense = require('./check-license')
    checkLicense({
        socket: p3xrs.socketIo.socketio,
        payload: {
            license: p3xrs.connections.license
        }
    })

    setInterval(() => {
        checkLicense({
            socket: p3xrs.socketIo.socketio,
            payload: {
                license: p3xrs.connections.license
            }
        })
    }, 1000 * 60 /* 1 minute */ //* 60)

    
    // it was not working, so it's disabled...
    p3xrs.cfg.donated = true

    p3xrs.redisConnections = {}
    p3xrs.redisConnectionsSubscriber = {}

}

module.exports = boot

