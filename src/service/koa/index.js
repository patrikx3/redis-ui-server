const Koa = require('koa');
const Router = require('koa-router')
const fs = require('fs').promises
const koaBody = require('koa-body')

const path = require('path')

const koaService = function() {

    const self = this;

    self.boot = async () => {

        const app = new Koa();

        this.app = app;

        const router = new Router();
        this.router = router;

        app.use(koaBody());

        app.on('error', err => {
            console.error('koa server error', err)
        });

        /*
        app.context.p3x = {
            status: {
                404: () => {
                    const error = new Error('not-found');
                    error.status = 404;
                    throw error;
                }
            }
        }
        */

        app.use(async (ctx) => {
            ctx.body = {
                status: 'operational'
            };
        });

        app.use(router.routes())
        app.use(router.allowedMethods());

        const keyFilename =  path.resolve(process.cwd(), p3xrs.cfg.https2.key)
        const certFilename =  path.resolve(process.cwd(), p3xrs.cfg.https2.cert)
        const certs = await  Promise.all([
            // key
            fs.readFile(keyFilename),
            // cert
            fs.readFile(certFilename),
        ])


        const options = {
            key: certs[0].toString(),
            cert: certs[1].toString(),
        };

        //console.warn('keyFilename', keyFilename, options.key)
        //console.warn('certFilename', certFilename, options.cert)
        const spdy = require('spdy');
        const server = spdy.createServer(options, app.callback())

        // not working with websocket-s native node http2
        //const http2 = require('http2');
        //const server = http2.createSecureServer(options, app.callback());


        this.server = server;

        server.listen(p3xrs.cfg.https2.port || 7843);

    }

}

module.exports = koaService