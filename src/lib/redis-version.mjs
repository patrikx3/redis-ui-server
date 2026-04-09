/**
 * Parse a Redis server version string (e.g. '8.6.2') and provide
 * feature-gating helpers.
 *
 * Usage:
 *   const rv = parseRedisVersion(infoData?.server?.redis_version)
 *   if (rv.isAtLeast(8, 2)) { // use XDELEX }
 */
export function parseRedisVersion(versionStr) {
    if (!versionStr) return { major: 0, minor: 0, patch: 0, isAtLeast: () => false, raw: '' }
    const parts = versionStr.split('.').map(Number)
    const major = parts[0] || 0
    const minor = parts[1] || 0
    const patch = parts[2] || 0
    return {
        major, minor, patch,
        isAtLeast: (reqMajor, reqMinor) =>
            major > reqMajor || (major === reqMajor && minor >= reqMinor),
        raw: versionStr,
    }
}
