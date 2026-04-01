import fs from 'fs'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const parseBoolean = (value) => {
    if (typeof value === 'boolean') {
        return value
    }
    if (typeof value !== 'string') {
        return undefined
    }
    const normalized = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false
    }
    return undefined
}

const resolveConfiguredHttpAuth = () => {
    const cfg = p3xrs && p3xrs.cfg && typeof p3xrs.cfg === 'object' ? p3xrs.cfg : {}
    const fromServer = cfg.server && typeof cfg.server.httpAuth === 'object' ? cfg.server.httpAuth : {}
    const fromRoot = cfg.httpAuth && typeof cfg.httpAuth === 'object' ? cfg.httpAuth : {}
    const merged = Object.assign({}, fromServer, fromRoot)

    const username = typeof merged.username === 'string' && merged.username.length > 0 ? merged.username : 'admin'
    const password = typeof merged.password === 'string' ? merged.password : ''
    const passwordHash = typeof merged.passwordHash === 'string' ? merged.passwordHash.trim() : ''
    const enabledRaw = parseBoolean(merged.enabled)
    const hasSecret = password.length > 0 || passwordHash.length > 0
    const enabled = enabledRaw === undefined ? hasSecret : enabledRaw

    return {
        enabled,
        username,
        password,
        passwordHash,
    }
}

const safeCompare = (a, b) => {
    const aBuffer = Buffer.from(typeof a === 'string' ? a : '', 'utf8')
    const bBuffer = Buffer.from(typeof b === 'string' ? b : '', 'utf8')
    if (aBuffer.length !== bBuffer.length) {
        return false
    }
    return crypto.timingSafeEqual(aBuffer, bBuffer)
}

const parseBasicAuthorizationHeader = (headerValue) => {
    if (typeof headerValue !== 'string' || headerValue.length === 0) {
        return null
    }
    const parts = headerValue.split(' ')
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'basic') {
        return null
    }
    const decoded = Buffer.from(parts[1], 'base64').toString('utf8')
    const colonIndex = decoded.indexOf(':')
    if (colonIndex === -1) {
        return null
    }
    return {
        username: decoded.slice(0, colonIndex),
        password: decoded.slice(colonIndex + 1),
    }
}

const verifyCredentials = ({ username, password }) => {
    const settings = resolveConfiguredHttpAuth()
    if (!settings.enabled) {
        return true
    }
    if (!safeCompare(username, settings.username)) {
        return false
    }
    if (settings.passwordHash.length > 0) {
        try {
            return bcrypt.compareSync(password, settings.passwordHash)
        } catch (e) {
            return false
        }
    }
    if (settings.password.length > 0) {
        return safeCompare(password, settings.password)
    }
    return false
}

const verifyAuthorizationHeader = (headerValue) => {
    const settings = resolveConfiguredHttpAuth()
    if (!settings.enabled) {
        return true
    }
    const parsed = parseBasicAuthorizationHeader(headerValue)
    if (!parsed) {
        return false
    }
    return verifyCredentials(parsed)
}

const readPasswordHashFromFile = (filename) => {
    if (typeof filename !== 'string' || filename.trim() === '') {
        return ''
    }
    const resolved = filename.trim()
    if (!fs.existsSync(resolved)) {
        return ''
    }
    try {
        return fs.readFileSync(resolved, 'utf8').trim()
    } catch (e) {
        return ''
    }
}

export {
    parseBoolean,
    resolveConfiguredHttpAuth,
    verifyAuthorizationHeader,
    readPasswordHashFromFile,
}
