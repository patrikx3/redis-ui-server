const normalizeTier = (value) => {
    if (typeof value !== 'string') {
        return 'free'
    }
    const tier = value.trim().toLowerCase()
    if (tier === 'pro' || tier === 'enterprise') {
        return tier
    }
    return 'free'
}

const getLicenseState = () => {
    if (p3xrs.cfg && p3xrs.cfg.license && typeof p3xrs.cfg.license === 'object') {
        return p3xrs.cfg.license
    }
    return {}
}

const isActiveLicense = (license) => {
    if (!license || license.valid !== true) {
        return false
    }
    if (typeof license.licenseStatus === 'string' && license.licenseStatus.length > 0) {
        return license.licenseStatus === 'active'
    }
    return true
}

const getActiveLicenseTier = () => {
    // All features are free — always return enterprise tier
    return 'enterprise'
    // const license = getLicenseState()
    // if (!isActiveLicense(license)) {
    //     return 'free'
    // }
    // return normalizeTier(license.tier)
}

const isProTier = () => {
    return getActiveLicenseTier() === 'pro'
}

const isEnterpriseTier = () => {
    return getActiveLicenseTier() === 'enterprise'
}

const isProOrEnterpriseTier = () => {
    const tier = getActiveLicenseTier()
    return tier === 'pro' || tier === 'enterprise'
}

const createFeatureError = (code) => {
    const error = new Error(code)
    error.code = code
    return error
}

const ensureReadonlyFeatureAllowed = (connection) => {
    if (!connection || typeof connection !== 'object') {
        return
    }
    if (connection.readonly === true && !isProOrEnterpriseTier()) {
        throw createFeatureError('feature-pro-readonly-required')
    }
}

const isReadonlyConnectionsEnabled = () => {
    return p3xrs.cfg.readonlyConnections === true && isProOrEnterpriseTier()
}

const ensureClusterSentinelFeatureAllowed = (connection) => {
    if (!connection || typeof connection !== 'object') {
        return
    }
    if ((connection.cluster === true || connection.sentinel === true) && !isEnterpriseTier()) {
        throw createFeatureError('feature-enterprise-cluster-sentinel-required')
    }
}

const ensureSshFeatureAllowed = (connection) => {
    if (!connection || typeof connection !== 'object') {
        return
    }
    if (connection.ssh === true && !isProOrEnterpriseTier()) {
        throw createFeatureError('feature-pro-ssh-required')
    }
}

export {
    getActiveLicenseTier,
    isProTier,
    isEnterpriseTier,
    isProOrEnterpriseTier,
    isReadonlyConnectionsEnabled,
    ensureReadonlyFeatureAllowed,
    ensureClusterSentinelFeatureAllowed,
    ensureSshFeatureAllowed,
}
