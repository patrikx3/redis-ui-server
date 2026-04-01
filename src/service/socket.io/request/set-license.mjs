import checkLicense from '../../../lib/check-license.mjs'

export default async (options) => {
    let licenseEditable = true
    if (typeof p3xrs.cfg.licenseEditable === 'boolean') {
        licenseEditable = p3xrs.cfg.licenseEditable
    } else if (typeof p3xrs.cfg.editableActive === 'boolean') {
        licenseEditable = p3xrs.cfg.editableActive
    } else if (typeof p3xrs.cfg.disabled === 'boolean') {
        licenseEditable = !p3xrs.cfg.disabled
    }

    if (!licenseEditable) {
        options.socket.emit(options.responseEvent, {
            status: 'error',
            error: 'license_readonly',
        })
        return
    }

    options.save = true
    await checkLicense(options)
}
