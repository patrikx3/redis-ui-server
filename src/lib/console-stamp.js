const chalk = require('chalk');
const consoleStamp = () => {
// overriding the console should be after this!!!
    require('console-stamp')(console, {
        format: ':date(yyyy/mm/dd HH:MM:ss.l).cyan :p3x.yellow :myLabel',
        tokens:{
            p3x: () => {
                return chalk`{black.grey [P3XRS]}` + ` [PID: ${(String(process.pid).padStart(6, 0))}] `;
            },
            myLabel: ( arg ) => {
                const { method, defaultTokens } = arg;
                let label = defaultTokens.label( arg );
                switch(method) {
                    case 'error':
                        label = chalk`{bold.red ${label}}`;
                        break;

                    case 'warn':
                        label = chalk`{bold.blue ${label}}`;
                        break;

                    default:
                        label = chalk`{green ${label}}`;
                }
                return label;
            }
        },
    });
}

module.exports = consoleStamp
