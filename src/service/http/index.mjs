import express from 'express'
import fs from 'fs'
import path from 'path'
import http from 'http'
import { fileURLToPath } from 'url'
import { resolveConfiguredHttpAuth, verifyCredentials, createAuthToken, verifyAuthToken } from '../../lib/http-auth.mjs'
import { version } from '../../lib/resolve-version.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const httpService = function () {

    const self = this

    self.boot = async () => {

        const app = express()
        this.app = app

        app.disable('x-powered-by')

        // Content Security Policy — covers Docker, direct server, and any deployment without a reverse proxy
        app.use((req, res, next) => {
            res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' https://www.googletagmanager.com 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.googletagmanager.com https://www.google-analytics.com; font-src 'self' data:; connect-src 'self' ws: wss: http://localhost:* http://127.0.0.1:* https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com; object-src 'none'; base-uri 'self'; form-action 'self'")
            next()
        })

        // Health endpoint — before auth, always accessible
        const startedAt = new Date().toISOString()
        app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                version: version,
                uptime: process.uptime(),
                startedAt: startedAt,
            })
        })

        // CORS for API endpoints (needed in dev when frontend runs on a different port)
        app.use('/api', (req, res, next) => {
            res.set('Access-Control-Allow-Origin', '*')
            res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            res.set('Access-Control-Allow-Headers', 'Content-Type')
            if (req.method === 'OPTIONS') return res.sendStatus(204)
            next()
        })

        // Auth status — public, tells frontend if login is required
        app.get('/api/auth-status', (req, res) => {
            const httpAuth = resolveConfiguredHttpAuth()
            res.json({ enabled: httpAuth.enabled })
        })

        // Login endpoint — validates credentials, returns JWT token
        app.post('/api/login', express.json(), (req, res) => {
            const httpAuth = resolveConfiguredHttpAuth()
            if (!httpAuth.enabled) {
                return res.json({ status: 'ok', authRequired: false })
            }

            const { username, password } = req.body || {}
            if (!username || !password) {
                return res.status(400).json({ status: 'error', error: 'credentials_required' })
            }

            if (!verifyCredentials({ username, password })) {
                return res.status(401).json({ status: 'error', error: 'invalid_credentials' })
            }

            const token = createAuthToken(username)
            res.json({ status: 'ok', token })
        })

        // Token verify — checks if a stored token is still valid
        app.post('/api/verify-token', express.json(), (req, res) => {
            const httpAuth = resolveConfiguredHttpAuth()
            if (!httpAuth.enabled) {
                return res.json({ valid: true, authRequired: false })
            }
            const { token } = req.body || {}
            const payload = verifyAuthToken(token)
            res.json({ valid: !!payload })
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

        // Mount Vue at /vue/
        let hasVue = false
        let vuePath
        let vueStatic = p3xrs.cfg.staticVue
        if (!vueStatic && ngPath) {
            const autoVuePath = ngPath + '-vue'
            if (fs.existsSync(autoVuePath)) {
                vueStatic = autoVuePath
            }
        }
        if (!vueStatic) {
            vueStatic = '~p3x-redis-ui-material/dist-vue'
        }
        if (typeof vueStatic === 'string') {
            try {
                vuePath = vueStatic.startsWith('~') ? resolvePath(vueStatic) : vueStatic
                if (fs.existsSync(vuePath)) {
                    app.use('/vue', express.static(vuePath, { etag: true, lastModified: true, setHeaders: (res, filePath) => { if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache') } }))
                    hasVue = true
                    console.info('Vue static mounted at /vue/ from', vuePath)
                }
            } catch (e) {
                // Vue build may not exist yet — that's ok
            }
        }

        // Pre-read index.html files so SPA fallback works inside .asar archives
        // (res.sendFile uses the `send` library which breaks inside .asar)
        // For non-asar (server) deployments, re-read from disk each time so
        // deploys that update files after server start don't serve stale HTML.
        const isAsar = (p) => p.includes('.asar')
        let ngIndexHtml
        const ngIndexPath = hasNg ? path.resolve(ngPath, 'index.html') : null
        if (hasNg) {
            ngIndexHtml = await fs.promises.readFile(ngIndexPath, 'utf8')
        }
        let reactIndexHtml
        const reactIndexPath = hasReact ? path.resolve(reactPath, 'index.html') : null
        if (hasReact) {
            reactIndexHtml = await fs.promises.readFile(reactIndexPath, 'utf8')
        }
        let vueIndexHtml
        const vueIndexPath = hasVue ? path.resolve(vuePath, 'index.html') : null
        if (hasVue) {
            vueIndexHtml = await fs.promises.readFile(vueIndexPath, 'utf8')
        }

        const getNgIndexHtml = async () => {
            if (isAsar(ngIndexPath)) return ngIndexHtml
            return fs.promises.readFile(ngIndexPath, 'utf8')
        }
        const getReactIndexHtml = async () => {
            if (isAsar(reactIndexPath)) return reactIndexHtml
            return fs.promises.readFile(reactIndexPath, 'utf8')
        }
        const getVueIndexHtml = async () => {
            if (isAsar(vueIndexPath)) return vueIndexHtml
            return fs.promises.readFile(vueIndexPath, 'utf8')
        }

        const noCacheHeaders = (res) => res.set('Cache-Control', 'no-cache')

        // Root / → redirect based on localStorage preference (client-side)
        if (hasNg || hasReact || hasVue) {
            app.get('/', (req, res) => {
                noCacheHeaders(res)
                res.type('html').send(`<!DOCTYPE html><html><head><title>P3X Redis UI</title></head><body><script>
var pref='ng';try{pref=localStorage.getItem('p3xr-frontend')||'ng'}catch(e){}
if(pref==='vue'&&${hasVue})location.replace('/vue/')
else if(pref==='react'&&${hasReact})location.replace('/react/')
else location.replace('/ng/')
</script></body></html>`)
            })
        }

        // SPA fallback for /ng/* routes
        if (hasNg) {
            app.use('/ng', async (req, res, next) => {
                if (req.path.startsWith('/socket.io')) {
                    next()
                    return
                }
                noCacheHeaders(res)
                res.type('html').send(await getNgIndexHtml())
            })
        }

        // SPA fallback for /react/* routes
        if (hasReact) {
            app.use('/react', async (req, res, next) => {
                if (req.path.startsWith('/socket.io')) {
                    next()
                    return
                }
                noCacheHeaders(res)
                res.type('html').send(await getReactIndexHtml())
            })
        }

        // SPA fallback for /vue/* routes
        if (hasVue) {
            app.use('/vue', async (req, res, next) => {
                if (req.path.startsWith('/socket.io')) {
                    next()
                    return
                }
                noCacheHeaders(res)
                res.type('html').send(await getVueIndexHtml())
            })
        }

        // Fallback when no frontends are available
        if (!hasNg && !hasReact && !hasVue) {
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
