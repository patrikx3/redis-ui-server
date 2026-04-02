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
                version: p3xrs.cfg?.version || 'unknown',
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

        let hasStatic = false
        let staticPath
        if (typeof p3xrs.cfg.static === 'string') {
            hasStatic = true
            staticPath = resolvePath(p3xrs.cfg.static)
            app.use(express.static(staticPath))
        }

        if (hasStatic) {
            app.use((req, res, next) => {
                if (req.path.startsWith('/socket.io')) {
                    next()
                    return
                }
                res.sendFile(path.resolve(staticPath, 'index.html'), (error) => {
                    if (error) {
                        next(error)
                    }
                })
            })
        } else {
            app.use((req, res) => {
                res.json({
                    status: 'operational'
                })
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
