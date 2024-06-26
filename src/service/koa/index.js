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

        const path = require('path');
        const fs = require('fs');
        /*
        const cors = require('@koa/cors'); // Added CORS
        const crypto = require('crypto');

        // Middleware to add a nonce to each request
        app.use(async (ctx, next) => {
            ctx.state.nonce = crypto.randomBytes(16).toString('base64');
            await next();
        });

        // Middleware to add CSP header
        app.use(async (ctx, next) => {
            const nonce = ctx.state.nonce;
            const csp = `
                default-src 'self';
                script-src 'self' https://pagead2.googlesyndication.com https://www.googletagmanager.com 'nonce-${nonce}';
                style-src 'self' 'unsafe-inline';
                img-src * data:;
                connect-src *;
                font-src *;
                object-src 'none';
                frame-src 'self' https://*.doubleclick.net https://*.google.com;
            `.replace(/\s{2,}/g, ' ').trim(); // Remove extra spaces and trim
        
            ctx.set('Content-Security-Policy', csp);
            await next();
        });


        // Added CORS middleware
        app.use(cors({
            origin: '*', // Allow all origins
            allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
            allowHeaders: ['DNT', 'User-Agent', 'X-Requested-With', 'If-Modified-Since', 'Cache-Control', 'Content-Type', 'Range'],
            exposeHeaders: ['Content-Length', 'Content-Range'],
        }));


        app.use(async (ctx, next) => {
            if (ctx.path === '/nonce') {
                ctx.body = { nonce: ctx.state.nonce };
            } else {
                await next();
            }
        });
        */

        const findModulePath = (startPath, targetPath) => {
            let currentPath = startPath;
            while (currentPath !== path.resolve(currentPath, '..')) { // Check until we reach the root directory
                const nodeModulesPath = path.join(currentPath, targetPath);
                if (fs.existsSync(nodeModulesPath)) {
                    return nodeModulesPath;
                }
                currentPath = path.resolve(currentPath, '..'); // Move up one directory level
            }
            throw new Error('The specified module could not be found in any node_modules directory');
        }

        const resolvePath = (inputPath) => {
            if (inputPath.startsWith('~')) {
                const inputPathFromNodeModules = inputPath.substring(1);
                // Attempt to find the module starting from the directory of the main script or current directory
                const startPath = __dirname;
                return findModulePath(startPath, inputPathFromNodeModules);
            } else {
                // Resolve the path relative to the current working directory for non-module specific paths
                return path.resolve(process.cwd(), inputPath);
            }
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

        server.listen(p3xrs.cfg.http.port || 7843, p3xrs.cfg.http.bind ? p3xrs.cfg.http.bind : '0.0.0.0');

    }

}

module.exports = koaService
