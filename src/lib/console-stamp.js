const chalk = require('chalk');
const consoleStamp = () => {
// overriding the console should be after this!!!
    require('console-stamp')(console, {
        pattern: 'yyyy/mm/dd HH:MM:ss.l',
        datePrefix: '[P3XRS] ',
        dateSuffix: '',
        metadata: function () {
            return `[PID: ${(String(process.pid).padStart(6, 0))}]`;
        },
        colors: {
            stamp: "yellow",
            label: function() {
                let color;
                switch(arguments[0]) {
                    case '[ERROR]':
                        color = chalk.bold.red
                        break;

                    case '[WARN]':
                        color = chalk.bold.blue
                        break;

                    default:
                        color = chalk.green;
                }

                return color(arguments[0])
            },
            metadata: chalk.black.bgGreenBright,
        },
    });
}

module.exports = consoleStamp
