import checkLicense from '../../../lib/check-license.mjs'

export default async (options) => {
    options.save = true
    await checkLicense(options)
}
