const chalk = require('chalk');
const consoleStamp = () => {
// overriding the console should be after this!!!

    const methods = ['log', 'info', 'warn', 'error', 'debug']
    const originalMethods = {}
    for(let method of methods) {
        originalMethods[method] = console[method]

        console[method] = function() {
            if (arguments[0]) {
                let label
                switch(method) {
                    case 'error':
                        label = chalk`{bold.red ${method.toUpperCase()}}`;
                        break;

                    case 'warn':
                        label = chalk`{bold.blue ${method.toUpperCase()}}`;
                        break;

                    default:
                        label = chalk`{green ${method.toUpperCase()}}`;
                }

                let data = '' //chalk`${moment().format(`YYYY/MM/DD HH:mm:ss.SSS`)} `
                data += chalk`{black.grey [P3XRS]}` + ` [PID: ${(String(process.pid).padStart(6, 0))}] [${label.padStart(5, ' ')}]: `

                //arguments[0] = data + arguments[0]
                const mainArguments = Array.prototype.slice.call(arguments);
                mainArguments.unshift(data);
                originalMethods[method].apply(null, mainArguments)
            } else {
                originalMethods[method].apply(null, arguments)
            }
        }
    }
}

module.exports = consoleStamp
