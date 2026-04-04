import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverPkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))

let redisUiPkg = null

// Resolve p3x-redis-ui package.json.
// Works in: Docker, Electron (asar), yarn workspaces, npm flat/nested node_modules.
try {
    // Strategy 1: walk up from __dirname (works for nested node_modules, Docker, Electron)
    let dir = __dirname
    for (let i = 0; i < 10; i++) {
        dir = path.dirname(dir)
        const candidate = path.join(dir, 'package.json')
        if (fs.existsSync(candidate)) {
            const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'))
            if (parsed.name === 'p3x-redis-ui') {
                redisUiPkg = parsed
                break
            }
        }
        if (dir === path.dirname(dir)) break
    }

    // Strategy 2: scan sibling directories (flat node_modules, dev workspace)
    if (!redisUiPkg) {
        const serverRoot = path.resolve(__dirname, '../..')
        const parentDir = path.dirname(serverRoot)
        try {
            const siblings = fs.readdirSync(parentDir)
            for (const sibling of siblings) {
                const candidate = path.join(parentDir, sibling, 'package.json')
                if (fs.existsSync(candidate)) {
                    const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'))
                    if (parsed.name === 'p3x-redis-ui') {
                        redisUiPkg = parsed
                        break
                    }
                }
            }
        } catch { /* parentDir not readable */ }
    }
} catch (e) {
    console.warn('resolve-version: error resolving version', e.message)
}

if (!redisUiPkg) {
    console.info('resolve-version: p3x-redis-ui package not found, using server version')
}

export const isSnapshot = !redisUiPkg
export const version = redisUiPkg?.version ?? serverPkg.version
export const serverVersion = serverPkg.version
export const pkg = redisUiPkg ?? serverPkg
