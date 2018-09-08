const program = require('commander')
const path = require('path')
const fs = require('fs')

const cli = () => {
    const pkg = require('../../package')
    program
        .version(pkg.version)
        .option('-c, --config [config]', 'Set the p3xr.json p3x-redis-ui-server configuration, see more help in https://github.com/patrikx3/redis-ui-server')
        .parse(process.argv);

    if (!program.config) {
        program.config = './p3xrs.json'
//        program.outputHelp()
//        return false
    }

    const configPath = path.resolve(process.cwd(), program.config)
    //console.log(configPath)

    p3xrs.cfg = require(configPath).p3xrs


    if (!p3xrs.cfg.hasOwnProperty('connections')) {
        p3xrs.cfg.connections = {}
    }
    if (!p3xrs.cfg.connections.hasOwnProperty('home-dir')) {
        p3xrs.cfg.connections = 'home'
    }

    if (p3xrs.cfg.connections['home-dir'] === 'home') {
        p3xrs.cfg.connections['home-dir'] = require('os').homedir();
    }
    p3xrs.cfg.connections['home'] = path.resolve(p3xrs.cfg.connections['home-dir'], '.p3xrs-conns.json')

    if (!fs.existsSync(p3xrs.cfg.connections.home)) {
        fs.writeFileSync(p3xrs.cfg.connections.home, JSON.stringify({
            update: new Date(),
            list: [],
        }, null, 4))
    }
    p3xrs.connections = require(p3xrs.cfg.connections.home)
    //console.log(p3xrs.cfg.connections.home, p3xrs.connections)
    //console.log(p3xrs.connections)
    return true;
}

module.exports = cli;