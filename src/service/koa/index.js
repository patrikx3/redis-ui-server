const Koa = require('koa');
//const Router = require('koa-router')
const fs = require('fs')
//const koaBody = require('koa-body')
const path = require('path')

const koaService = function () {

    const self = this;

    self.boot = async () => {

        const app = new Koa();
        this.app = app;

        // const router = new Router();
        // this.router = router;

        // app.use(koaBody());

        const resolvePath = (inputPath) => {
            let resolvedPath
            if (inputPath.startsWith('~')) {
                const inputPathFromNodeModules = inputPath.substring(1)
                resolvedPath = path.resolve(path.dirname(require.main.filename) + path.sep + '..', `node_modules${path.sep}${inputPathFromNodeModules}`)
            } else {
                resolvedPath = path.resolve(process.cwd(), inputPath)
            }
            return resolvedPath
        }

        let hasStatic = false
        let staticPath
        if (typeof p3xrs.cfg.static === 'string') {
            hasStatic = true
            staticPath = resolvePath(p3xrs.cfg.static)
            const serve = require('koa-static');
            app.use(serve(staticPath));
        }

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

        /*
        app.use(async (ctx) => {
            ctx.body = {
                status: 'operational'
            };
        });
        */

        if (hasStatic) {
            const send = require('koa-send')
            app.use(async (ctx) => {
                await send(ctx, 'index.html', {root: staticPath});
            });
        } else {
            app.use(async (ctx) => {
                ctx.response.body = {
                    status: 'operational'
                }
            });
        }


        // app.use(router.routes())
        // app.use(router.allowedMethods());

        /*
        const keyFilename = resolvePath(p3xrs.cfg.https2.key)
        const certFilename = resolvePath(p3xrs.cfg.https2.cert)
        const certs = [
            // key
            fs.readFileSync(keyFilename),
            // cert
            fs.readFileSync(certFilename),
        ]

        const options = {
            key: certs[0].toString(),
            cert: certs[1].toString(),
        };
        */

        //console.warn('keyFilename', keyFilename, options.key)
        //console.warn('certFilename', certFilename, options.cert)
        //const spdy = require('spdy');
        //const server = spdy.createServer(options, app.callback())

        // not working with websocket-s native node http2
        //const http2 = require('http2');
        //const server = http2.createSecureServer(options, app.callback());
        const http = require('http')
        const server = http.createServer(app.callback())

        this.server = server;

        server.listen(p3xrs.cfg.http.port || 7843, '0.0.0.0');

    }

}

module.exports = koaService
