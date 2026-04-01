import fs from 'fs'
import path from 'path'
import utils from 'corifeus-utils'
import { isReadonlyConnectionsEnabled } from './license-tier.mjs'

const PRODUCT = 'p3x-redis-ui'
const PAID_TIERS = new Set(['pro', 'enterprise'])
const MAX_DEVICES_REASON = 'LICENSE_MAX_DEVICES_REACHED'

const maskLicenseKey = (value) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return ''
    }
    if (value.length <= 8) {
        return '****'
    }
    return `${value.slice(0, 4)}...${value.slice(-4)}`
}

const parseResponseBody = (body) => {
    if (body === undefined || body === null) {
        return {}
    }
    if (typeof body === 'string') {
        try {
            return JSON.parse(body)
        } catch (e) {
            return {}
        }
    }
    return body
}

const getConfigPath = () => {
    if (typeof p3xrs.configPath === 'string' && p3xrs.configPath.trim() !== '') {
        return p3xrs.configPath
    }
    return path.resolve(process.cwd(), 'p3xrs.json')
}

const saveLicenseInConfig = ({ licenseKey, license }) => {
    const configPath = getConfigPath()
    const configDir = path.dirname(configPath)
    let config = {}

    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
    }

    if (fs.existsSync(configPath)) {
        try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
        } catch (e) {
            console.warn('license config read failed, using empty config', e.message)
        }
    }

    if (!config || typeof config !== 'object') {
        config = {}
    }
    if (!config.p3xrs || typeof config.p3xrs !== 'object') {
        config.p3xrs = {}
    }

    config.p3xrs.licenseKey = licenseKey
    config.p3xrs.license = license

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

const createDefaultLicenseState = () => {
    return {
        status: 'ok',
        action: 'check',
        valid: false,
        reason: 'LICENSE_MISSING',
        product: PRODUCT,
        tier: 'free',
        features: [],
        licenseStatus: 'inactive',
        maxDevices: null,
        activeDevices: null,
        deviceLease: null,
        checkedAt: new Date().toISOString(),
    }
}

const toPublicLicenseState = (licenseState = {}) => {
    const state = Object.assign({}, licenseState)
    const masked = maskLicenseKey(state.licenseKey)
    state.licenseKeyMasked = masked
    delete state.licenseKey
    delete state.customerEmail
    return state
}

const getLicenseEditableFromConfig = () => {
    if (typeof p3xrs.cfg.licenseEditable === 'boolean') {
        return p3xrs.cfg.licenseEditable
    }
    if (typeof p3xrs.cfg.editableActive === 'boolean') {
        return p3xrs.cfg.editableActive
    }
    if (typeof p3xrs.cfg.disabled === 'boolean') {
        return !p3xrs.cfg.disabled
    }
    return true
}

export default async (options = {}) => {
    const socket = options.socket
    const payload = options.payload || {}

    const hasPayloadLicense = Object.prototype.hasOwnProperty.call(payload, 'license')
    const payloadLicense = hasPayloadLicense && typeof payload.license === 'string' ? payload.license : ''
    const providedLicenseKey = payloadLicense.trim()
    const currentLicenseKey = typeof p3xrs.cfg.licenseKey === 'string' ? p3xrs.cfg.licenseKey : ''
    const licenseEditable = getLicenseEditableFromConfig()

    const requestedLicenseKey = hasPayloadLicense ? providedLicenseKey : currentLicenseKey
    const shouldClear = hasPayloadLicense && requestedLicenseKey.length === 0

    let donated = p3xrs.cfg.donated === true
    let info = 'ok'
    let licenseState = p3xrs.cfg.license || createDefaultLicenseState()
    let licenseKeyToPersist = currentLicenseKey

    try {
        if (shouldClear) {
            donated = false
            info = 'cleared_license'
            licenseKeyToPersist = ''
            licenseState = {
                ...createDefaultLicenseState(),
                reason: 'LICENSE_CLEARED',
            }
        } else if (requestedLicenseKey.length > 0) {
            const response = await utils.http.request({
                url: `https://network.corifeus.com/public/license/check/${encodeURIComponent(requestedLicenseKey)}`
            })

            if (response.statusCode !== 200) {
                throw new Error('server_error')
            }

            const body = parseResponseBody(response.body)
            const productMatches = body.product === PRODUCT
            const isValid = body.valid === true && productMatches
            const reason = body.reason || (isValid ? 'LICENSE_VALID' : 'LICENSE_INVALID')
            const isDeviceLimitReached = reason === MAX_DEVICES_REASON
            const tier = typeof body.tier === 'string' ? body.tier : 'free'
            donated = isValid && PAID_TIERS.has(tier)
            const bodyDeviceLease = body.deviceLease && typeof body.deviceLease === 'object' ? body.deviceLease : null
            const maxDevices = typeof body.maxDevices === 'number'
                ? body.maxDevices
                : (bodyDeviceLease && typeof bodyDeviceLease.maxDevices === 'number' ? bodyDeviceLease.maxDevices : null)
            const activeDevices = typeof body.activeDevices === 'number'
                ? body.activeDevices
                : (bodyDeviceLease && typeof bodyDeviceLease.activeDevices === 'number' ? bodyDeviceLease.activeDevices : null)

            licenseState = {
                status: body.status || 'ok',
                action: body.action || 'check',
                valid: isValid,
                reason: reason,
                product: body.product || PRODUCT,
                licenseKey: body.licenseKey || requestedLicenseKey,
                checkedAt: body.checkedAt || new Date().toISOString(),
                tier: tier,
                startsAt: body.startsAt || null,
                expiresAt: body.expiresAt || null,
                createdAt: body.createdAt || null,
                updatedAt: body.updatedAt || null,
                daysLeft: typeof body.daysLeft === 'number' ? body.daysLeft : null,
                features: Array.isArray(body.features) ? body.features : [],
                licenseStatus: body.licenseStatus || (isValid ? 'active' : 'inactive'),
                maxDevices: maxDevices,
                activeDevices: activeDevices,
                deviceLease: bodyDeviceLease,
                signature: body.signature || '',
            }

            if (isValid) {
                licenseKeyToPersist = requestedLicenseKey
                info = 'ok'
            } else if (productMatches && isDeviceLimitReached) {
                donated = false
                licenseKeyToPersist = requestedLicenseKey
                info = 'license_max_devices_reached'
            } else {
                donated = false
                licenseKeyToPersist = ''
                info = 'invalid_license'
            }
        } else {
            donated = false
            info = 'cleared_license'
            licenseKeyToPersist = ''
            licenseState = {
                ...createDefaultLicenseState(),
                reason: 'LICENSE_MISSING',
            }
        }
    } catch (e) {
        info = 'server_error'
        console.warn('license validation failed', e.message)
    }

    // All features are free — always enterprise
    p3xrs.cfg.donated = true
    p3xrs.cfg.licenseKey = licenseKeyToPersist
    licenseState.licenseKey = licenseKeyToPersist
    p3xrs.cfg.license = licenseState

    if (options.save === true) {
        try {
            saveLicenseInConfig({
                licenseKey: licenseKeyToPersist,
                license: licenseState,
            })
        } catch (e) {
            console.error('license save failed', e.message)
        }
    }

    if (socket && typeof socket.emit === 'function') {
        const publicLicense = toPublicLicenseState(licenseState)
        socket.emit(options.responseEvent || 'info-interval', {
            donated: true,
            info: info,
            status: 'ok',
            readonlyConnections: isReadonlyConnectionsEnabled(),
            licenseEditable: licenseEditable,
            editableActive: licenseEditable,
            disabled: !licenseEditable,
            hasLicenseKey: licenseKeyToPersist.length > 0,
            licenseKeyMasked: maskLicenseKey(licenseKeyToPersist),
            tier: publicLicense.tier || 'free',
            license: publicLicense,
        })
    }
}
