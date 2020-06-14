const utils = require('corifeus-utils')

const checkLicense = require('../../../lib/check-license')
module.exports = async (options) => {
    options.save = true
    checkLicense(options)
}
