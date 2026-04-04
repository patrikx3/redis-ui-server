import express from 'express'
import fs from 'fs'
import path from 'path'
import http from 'http'
import { fileURLToPath } from 'url'
import { resolveConfiguredHttpAuth, verifyAuthorizationHeader } from '../../lib/http-auth.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const httpService = function () {

    const self = this

    self.boot = async () => {

        const app = express()
        this.app = app

        app.disable('x-powered-by')

        // Health endpoint — before auth, always accessible
        app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                version: p3xrs.version || 'unknown',
                uptime: process.uptime(),
            })
        })

        app.use((req, res, next) => {
            const httpAuth = resolveConfiguredHttpAuth()
            if (!httpAuth.enabled) {
                next()
                return
            }
            const authHeader = req.get('authorization')
            if (verifyAuthorizationHeader(authHeader)) {
                next()
                return
            }
            res.set('WWW-Authenticate', 'Basic realm="P3X Redis UI"')
            res.status(401).json({
                error: 'http_auth_required',
            })
        })

        const findModulePath = (startPath, targetPath) => {
            let currentPath = startPath
            while (currentPath !== path.resolve(currentPath, '..')) {
                const nodeModulesPath = path.join(currentPath, targetPath)
                if (fs.existsSync(nodeModulesPath)) {
                    return nodeModulesPath
                }
                currentPath = path.resolve(currentPath, '..')
            }
            throw new Error('The specified module could not be found in any node_modules directory')
        }

        const resolvePath = (inputPath) => {
            if (inputPath.startsWith('~')) {
                const inputPathFromNodeModules = inputPath.substring(1)
                const startPath = __dirname
                return findModulePath(startPath, inputPathFromNodeModules)
            }
            return path.resolve(process.cwd(), inputPath)
        }

        // Mount Angular at /ng/
        let hasNg = false
        let ngPath
        const ngStatic = p3xrs.cfg.static || p3xrs.cfg.staticNg
        if (typeof ngStatic === 'string') {
            try {
                ngPath = resolvePath(ngStatic)
                app.use('/ng', express.static(ngPath, { etag: true, lastModified: true, setHeaders: (res, filePath) => { if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache') } }))
                hasNg = true
                console.info('Angular static mounted at /ng/ from', ngPath)
            } catch (e) {
                console.warn('Could not resolve Angular static path:', ngStatic, '-', e.message)
            }
        }

        // Mount React at /react/
        // Auto-detect: if Angular is at /path/public, React is at /path/public-react
        let hasReact = false
        let reactPath
        let reactStatic = p3xrs.cfg.staticReact
        if (!reactStatic && ngPath) {
            const autoReactPath = ngPath + '-react'
            if (fs.existsSync(autoReactPath)) {
                reactStatic = autoReactPath
            }
        }
        if (!reactStatic) {
            reactStatic = '~p3x-redis-ui-material/dist-react'
        }
        if (typeof reactStatic === 'string') {
            try {
                reactPath = reactStatic.startsWith('~') ? resolvePath(reactStatic) : reactStatic
                if (fs.existsSync(reactPath)) {
                    app.use('/react', express.static(reactPath, { etag: true, lastModified: true, setHeaders: (res, filePath) => { if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache') } }))
                    hasReact = true
                    console.info('React static mounted at /react/ from', reactPath)
                }
            } catch (e) {
                // React build may not exist yet — that's ok
            }
        }

        // Pre-read index.html files so SPA fallback works inside .asar archives
        // (res.sendFile uses the `send` library which breaks inside .asar)
        let ngIndexHtml
        if (hasNg) {
            ngIndexHtml = await fs.promises.readFile(path.resolve(ngPath, 'index.html'), 'utf8')
        }
        let reactIndexHtml
        if (hasReact) {
            reactIndexHtml = await fs.promises.readFile(path.resolve(reactPath, 'index.html'), 'utf8')
        }

        const noCacheHeaders = (res) => res.set('Cache-Control', 'no-cache')

        // Root / → redirect based on localStorage preference (client-side)
        if (hasNg || hasReact) {
            app.get('/', (req, res) => {
                noCacheHeaders(res)
                res.type('html').send(`<!DOCTYPE html><html><head><title>P3X Redis UI</title></head><body><script>
var pref='ng';try{pref=localStorage.getItem('p3xr-frontend')||'ng'}catch(e){}
location.replace(pref==='react'&&${hasReact}?'/react/':'/ng/')
</script></body></html>`)
            })
        }

        // SPA fallback for /ng/* routes
        if (hasNg) {
            app.use('/ng', (req, res, next) => {
                if (req.path.startsWith('/socket.io')) {
                    next()
                    return
                }
                noCacheHeaders(res)
                res.type('html').send(ngIndexHtml)
            })
        }

        // SPA fallback for /react/* routes
        if (hasReact) {
            app.use('/react', (req, res, next) => {
                if (req.path.startsWith('/socket.io')) {
                    next()
                    return
                }
                noCacheHeaders(res)
                res.type('html').send(reactIndexHtml)
            })
        }

        // Fallback when no frontends are available
        if (!hasNg && !hasReact) {
            app.use((req, res) => {
                res.json({ status: 'operational' })
            })
        }

        app.use((error, req, res, next) => {
            console.error('express server error', error)
            if (res.headersSent) {
                next(error)
                return
            }
            res.status(500).json({
                error: 'internal_server_error',
            })
        })

        const server = http.createServer(app)

        this.server = server

        server.listen(p3xrs.cfg.http.port || 7843, p3xrs.cfg.http.bind ? p3xrs.cfg.http.bind : '0.0.0.0')

    }

}

export default httpService
