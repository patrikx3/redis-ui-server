import path from 'path'
import fs from 'fs'
import os from 'os'
import { program } from 'commander'
import { parseBoolean, readPasswordHashFromFile } from './http-auth.mjs'

const isPlainObject = (value) => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const mergeDeep = (target, source) => {
    const output = isPlainObject(target) ? { ...target } : {}
    if (!isPlainObject(source)) {
        return output
    }

    for (const [key, value] of Object.entries(source)) {
        if (Array.isArray(value)) {
            output[key] = value.slice()
            continue
        }
        if (isPlainObject(value)) {
            output[key] = mergeDeep(isPlainObject(output[key]) ? output[key] : {}, value)
            continue
        }
        output[key] = value
    }

    return output
}

const loadJsonFile = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return undefined
    }
    try {
        const content = fs.readFileSync(filePath, 'utf8')
        return JSON.parse(content)
    } catch (e) {
        console.warn(`Could not read config ${filePath}:`, e.message)
        return undefined
    }
}

const cli = async () => {
    const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    p3xrs.version = pkg.version

    program
        .version(pkg.version)
        .option('-c, --config [config]', 'Set the p3xr.json p3x-redis-ui-server configuration, see more help in p3x-redis-ui-server')
        .option('-r, --readonly-connections', 'Set the connections to be readonly, no adding, saving or delete a connection')
        .option('-n, --connections-file-name [filename]', 'Set the connections file name, overrides default .p3xrs-conns.json')
        .option('--http-auth-enable', 'Enable HTTP Basic auth')
        .option('--http-auth-disable', 'Disable HTTP Basic auth')
        .option('--http-auth-username [username]', 'HTTP Basic auth username')
        .option('--http-auth-password [password]', 'HTTP Basic auth plain password')
        .option('--http-auth-password-hash [hash]', 'HTTP Basic auth bcrypt password hash')
        .option('--http-auth-password-hash-file [file]', 'Read HTTP Basic auth bcrypt password hash from file')
        .option('--groq-api-key [key]', 'Groq API key for AI-powered Redis query translation (get a free key at console.groq.com)')
        .option('--groq-api-key-readonly', 'Prevent users from changing the Groq API key via the UI')
        .parse(process.argv);

    const programOptions = program.opts();

    if (!process.versions.hasOwnProperty('electron') && !process.env.hasOwnProperty('P3XRS_DOCKER_HOME')) {

        if (!programOptions.config) {
            const findConfigFile = (startPath, filename) => {
                let currentPath = startPath;
                while (currentPath !== path.resolve(currentPath, '..')) { // Check until we reach the root directory
                    const filePath = path.join(currentPath, filename);
                    if (fs.existsSync(filePath)) {
                        return filePath;
                    }
                    currentPath = path.resolve(currentPath, '..'); // Move up one directory level
                }
                throw new Error('The specified configuration file could not be found.');
            }
            const resolveConfigPath = () => {
                // Attempt to find the config file starting from the directory of the main script or current directory
                const startPath = process.cwd();
                return findConfigFile(startPath, 'p3xrs.json');
            }
            programOptions.config = resolveConfigPath()

            //        program.outputHelp()
            //        return false
        }

        const configPath = path.resolve(process.cwd(), programOptions.config)
        //console.log(configPath)
        p3xrs.configPath = configPath

        p3xrs.cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')).p3xrs


        if (programOptions.readonlyConnections) {
            // console.warn(programOptions.readonlyConnections)
            p3xrs.cfg.readonlyConnections = true
            //console.warn(p3xrs.cfg.readonlyConnections === true)
        }

        if (typeof programOptions.groqApiKey === 'string' && programOptions.groqApiKey.trim()) {
            p3xrs.cfg.groqApiKey = programOptions.groqApiKey.trim()
        }
        if (programOptions.groqApiKeyReadonly) {
            p3xrs.cfg.groqApiKeyReadonly = true
        }

        if (typeof programOptions.connectionsFileName !== 'undefined' && programOptions.connectionsFileName) {
            // console.warn(programOptions.connectionsFileName)
            p3xrs.cfg.connectionsFileName = programOptions.connectionsFileName
            //console.warn(p3xrs.cfg.readonlyConnections === true)
        }


    } else {
        const defaultElectronConfig = {
            "http": {
                "port-info": "this is ommitted, it will be default 7843",
                "port": process.env.hasOwnProperty('P3XRS_DOCKER_HOME') ? 7843 : global.p3xrsElectronPort,
                "bind-info": "the interface with listen to, could be 127.0.0.1 or 0.0.0.0 or specific interface",
                "bind": "0.0.0.0",
            },
            "connections": {
                "home-dir-info": "if the dir config is empty or home, the connections are saved in the home folder, otherwise it will resolve the directory set as it is, either relative ./ or absolute starting with /. NodeJs will resolve this directory in p3xrs.connections.dir",
                "home-dir": "home"
            },
            "static-info": "This is the best configuration, if it starts with ~, then it is in resolve the path in the node_modules, otherwise it resolves to the current process current working directory.",
            "static": "~p3x-redis-ui-material/dist",
            "httpAuth": {
                "enabled": false,
                "username": "admin",
                "password": "",
                "passwordHash": "",
            },
            "treeDividers": [
                ":",
                "/",
                "|",
                "-",
                "@"
            ]
        }

        let electronUserDataDir = ''
        try {
            const electron = await import('electron')
            const electronApp = electron.default?.app || electron.app
            if (electronApp && typeof electronApp.getPath === 'function') {
                electronUserDataDir = electronApp.getPath('userData')
            }
        } catch (e) {
            electronUserDataDir = ''
        }
        const configuredDir = typeof process.env.P3XRS_ELECTRON_CONFIG_DIR === 'string'
            ? process.env.P3XRS_ELECTRON_CONFIG_DIR.trim()
            : ''
        const electronConfigDir = configuredDir || electronUserDataDir || os.homedir()
        p3xrs.configPath = path.resolve(electronConfigDir, 'p3xrs.json')

        let persistedRoot = loadJsonFile(p3xrs.configPath)
        if ((!persistedRoot || !isPlainObject(persistedRoot.p3xrs))) {
            const legacyConfigPath = path.resolve(process.cwd(), 'p3xrs.json')
            const legacyRoot = loadJsonFile(legacyConfigPath)
            if (legacyRoot && isPlainObject(legacyRoot.p3xrs)) {
                persistedRoot = legacyRoot
            }
        }

        const persistedConfig = persistedRoot && isPlainObject(persistedRoot.p3xrs)
            ? persistedRoot.p3xrs
            : {}

        p3xrs.cfg = mergeDeep(defaultElectronConfig, persistedConfig)

        if (programOptions.readonlyConnections) {
            p3xrs.cfg.readonlyConnections = true
        } else {
            p3xrs.cfg.readonlyConnections = false
        }

        if (typeof programOptions.groqApiKey === 'string' && programOptions.groqApiKey.trim()) {
            p3xrs.cfg.groqApiKey = programOptions.groqApiKey.trim()
        }
        if (programOptions.groqApiKeyReadonly) {
            p3xrs.cfg.groqApiKeyReadonly = true
        }
    }

    const applyHttpAuthConfig = () => {
        if (!p3xrs.cfg.httpAuth || typeof p3xrs.cfg.httpAuth !== 'object') {
            if (p3xrs.cfg.server && typeof p3xrs.cfg.server.httpAuth === 'object') {
                p3xrs.cfg.httpAuth = Object.assign({}, p3xrs.cfg.server.httpAuth)
            } else {
                p3xrs.cfg.httpAuth = {}
            }
        }
        const httpAuth = p3xrs.cfg.httpAuth

        if (typeof p3xrs.cfg.httpUser === 'string' && !httpAuth.username) {
            httpAuth.username = p3xrs.cfg.httpUser
        }
        if (typeof p3xrs.cfg.httpPassword === 'string' && !httpAuth.password) {
            httpAuth.password = p3xrs.cfg.httpPassword
        }

        if (typeof process.env.HTTP_USER === 'string' && process.env.HTTP_USER.trim() !== '') {
            httpAuth.username = process.env.HTTP_USER.trim()
        }
        if (typeof process.env.HTTP_PASSWORD === 'string') {
            httpAuth.password = process.env.HTTP_PASSWORD
        }
        if (typeof process.env.HTTP_PASSWORD_HASH === 'string' && process.env.HTTP_PASSWORD_HASH.trim() !== '') {
            httpAuth.passwordHash = process.env.HTTP_PASSWORD_HASH.trim()
        }
        if (typeof process.env.HTTP_PASSWORD_HASH_FILE === 'string' && process.env.HTTP_PASSWORD_HASH_FILE.trim() !== '') {
            const hashFromFile = readPasswordHashFromFile(process.env.HTTP_PASSWORD_HASH_FILE)
            if (hashFromFile) {
                httpAuth.passwordHash = hashFromFile
            }
        }
        const envEnabled = parseBoolean(process.env.HTTP_AUTH_ENABLED)
        if (envEnabled !== undefined) {
            httpAuth.enabled = envEnabled
        }

        if (typeof programOptions.httpAuthUsername === 'string' && programOptions.httpAuthUsername.trim() !== '') {
            httpAuth.username = programOptions.httpAuthUsername.trim()
        }
        if (typeof programOptions.httpAuthPassword === 'string') {
            httpAuth.password = programOptions.httpAuthPassword
        }
        if (typeof programOptions.httpAuthPasswordHash === 'string' && programOptions.httpAuthPasswordHash.trim() !== '') {
            httpAuth.passwordHash = programOptions.httpAuthPasswordHash.trim()
        }
        if (typeof programOptions.httpAuthPasswordHashFile === 'string' && programOptions.httpAuthPasswordHashFile.trim() !== '') {
            const hashFromCliFile = readPasswordHashFromFile(programOptions.httpAuthPasswordHashFile)
            if (hashFromCliFile) {
                httpAuth.passwordHash = hashFromCliFile
            }
        }
        if (programOptions.httpAuthEnable === true) {
            httpAuth.enabled = true
        }
        if (programOptions.httpAuthDisable === true) {
            httpAuth.enabled = false
        }


    }
    applyHttpAuthConfig()

    const authLog = p3xrs.cfg && p3xrs.cfg.httpAuth && typeof p3xrs.cfg.httpAuth === 'object'
        ? p3xrs.cfg.httpAuth
        : {}
    const authEnabled = parseBoolean(authLog.enabled) === true
    const authHasHash = typeof authLog.passwordHash === 'string' && authLog.passwordHash.trim().length > 0
    const authHasPlain = typeof authLog.password === 'string' && authLog.password.length > 0
    console.info(`http auth: ${authEnabled ? 'enabled' : 'disabled'} (user=${authLog.username || 'admin'}, hash=${authHasHash ? 'set' : 'empty'}, plain=${authHasPlain ? 'set' : 'empty'})`)

    if (p3xrs.cfg.connectionsFileName === undefined) {
        p3xrs.cfg.connectionsFileName = '.p3xrs-conns.json'
    }

    if (!p3xrs.cfg.hasOwnProperty('static')) {
        p3xrs.cfg.static = '~p3x-redis-ui-material/dist'
    }

    // staticReact: no default — auto-detected from static path in http service
    // staticVue: no default — auto-detected from static path in http service

    if (!p3xrs.cfg.hasOwnProperty('connections')) {
        p3xrs.cfg.connections = {}
    }
    if (!p3xrs.cfg.connections.hasOwnProperty('home-dir')) {
        p3xrs.cfg.connections = 'home'
    }

    if (p3xrs.cfg.connections['home-dir'] === 'home') {
        p3xrs.cfg.connections['home-dir'] = os.homedir();
    }
    if (process.env.hasOwnProperty('P3XRS_DOCKER_HOME')) {
        p3xrs.cfg.connections['home-dir'] = process.env.P3XRS_DOCKER_HOME
    }
    if (process.env.FLATPAK_ID) {
        // process.env.XDG_DATA_HOME
        p3xrs.cfg.connections['home-dir'] = '/var/data/'
    }
    if (process.env.hasOwnProperty('P3XRS_PORT')) {
        p3xrs.cfg.http.port = process.env.P3XRS_PORT
    }
    p3xrs.cfg.connections['home'] = path.resolve(p3xrs.cfg.connections['home-dir'], p3xrs.cfg.connectionsFileName)

    console.info('using home config is', p3xrs.cfg.connections['home'])

    if (!fs.existsSync(p3xrs.cfg.connections.home)) {

        fs.writeFileSync(p3xrs.cfg.connections.home, JSON.stringify({
            update: new Date(),
            list: [],
        }, null, 4))
    }
    p3xrs.connections = JSON.parse(fs.readFileSync(p3xrs.cfg.connections.home, 'utf8'))
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

export default cli;
