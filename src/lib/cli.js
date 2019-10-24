const path = require('path')
const fs = require('fs')


const cli = () => {
    const pkg = require('../../package')

    if (!process.versions.hasOwnProperty('electron') && !process.env.hasOwnProperty('P3XRS_DOCKER_HOME')) {
        const program = require('commander')
        program
            .version(pkg.version)
            .option('-c, --config [config]', 'Set the p3xr.json p3x-redis-ui-server configuration, see more help in https://github.com/patrikx3/redis-ui-server')
            .option('-r, --readonly-connections', 'Set the connections to be readonly, no adding, saving or delete a connection')
            .option('-n, --connections-file-name [filename]', 'Set the connections file name, overrides default .p3xrs-conns.json')
            .parse(process.argv);

        if (!program.config) {


            program.config = path.resolve(path.dirname(require.main.filename) + path.sep + '..', `.${path.sep}p3xrs.json`)

            //        program.outputHelp()
            //        return false
        }

        const configPath = path.resolve(process.cwd(), program.config)
        //console.log(configPath)

        p3xrs.cfg = require(configPath).p3xrs


        if (program.readonlyConnections) {
            // console.warn(program.readonlyConnections)
            p3xrs.cfg.readonlyConnections = true
            //console.warn(p3xrs.cfg.readonlyConnections === true)
        }

        if (typeof program.connectionsFileName !== 'undefined' && program.connectionsFileName) {
            // console.warn(program.connectionsFileName)
            p3xrs.cfg.connectionsFileName = program.connectionsFileName
            //console.warn(p3xrs.cfg.readonlyConnections === true)
        }


    } else {
        p3xrs.cfg = {
            "http": {
                "port-info": "this is ommitted, it will be default 7843",
                "port": process.env.hasOwnProperty('P3XRS_DOCKER_HOME') ? 7843 : 7844
            },
            "connections": {
                "home-dir-info": "if the dir config is empty or home, the connections are saved in the home folder, otherwise it will resolve the directory set as it is, either relative ./ or absolute starting with /. NodeJs will resolve this directory in p3xrs.connections.dir",
                "home-dir": "home"
            },
            "static-info": "This is the best configuration, if it starts with ~, then it is in resolve the path in the node_modules, otherwise it resolves to the current process current working directory.",
            "static": "~p3x-redis-ui-material/dist"
        }
        p3xrs.cfg.readonlyConnections = false
    }

    if (p3xrs.cfg.connectionsFileName === undefined) {
        p3xrs.cfg.connectionsFileName = '.p3xrs-conns.json'
    }

    if (!p3xrs.cfg.hasOwnProperty('static')) {

    }

    if (!p3xrs.cfg.hasOwnProperty('connections')) {
        p3xrs.cfg.connections = {}
    }
    if (!p3xrs.cfg.connections.hasOwnProperty('home-dir')) {
        p3xrs.cfg.connections = 'home'
    }

    if (p3xrs.cfg.connections['home-dir'] === 'home') {
        p3xrs.cfg.connections['home-dir'] = require('os').homedir();
    }
    if (process.env.hasOwnProperty('P3XRS_DOCKER_HOME')) {
        p3xrs.cfg.connections['home-dir'] = process.env.P3XRS_DOCKER_HOME
    }
    p3xrs.cfg.connections['home'] = path.resolve(p3xrs.cfg.connections['home-dir'], p3xrs.cfg.connectionsFileName)

    console.info('using home config is', p3xrs.cfg.connections['home'])

    if (!fs.existsSync(p3xrs.cfg.connections.home)) {

        fs.writeFileSync(p3xrs.cfg.connections.home, JSON.stringify({
            update: new Date(),
            list: [],
        }, null, 4))
    }
    p3xrs.connections = require(p3xrs.cfg.connections.home)
    //console.log(p3xrs.cfg.connections.home, p3xrs.connections)
    //console.log(p3xrs.connections)

    /*
    p3xrs.redis = {}
    let keyStreamPaging = 10000
    Object.defineProperty(p3xrs.redis, 'key-stream-paging', {
        get: () => {
            return keyStreamPaging
        },
        set: (value) => {
            keyStreamPaging = value
        }
    })
    */

    return true;
}

module.exports = cli;
