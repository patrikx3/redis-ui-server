import * as sharedIoRedis from '../../shared.mjs'

const parser = sharedIoRedis.argumentParser

const disabledCommands = ['subscribe', 'monitor', 'quit', 'psubscribe']

// Commands that have cluster-aware overrides on the Cluster class.
// redis.call() bypasses these, so we invoke the instance method directly.
const clusterOverriddenCommands = ['flushdb', 'flushall', 'dbsize']

const consolePrefix = 'socket.io console call'
export default async (options) => {
    const {socket, payload} = options;

    const {command} = payload

    try {
        let redis = socket.p3xrs?.ioredis

        const commands = parser( command);
        let mainCommand = commands.shift()
        mainCommand = mainCommand.toLowerCase();

        if (disabledCommands.includes(mainCommand)) {
            throw new Error('invalid_console_command')
        }

        // No live Redis client — console command cannot run. Throw a clean
        // message instead of crashing on `undefined.call`.
        if (!redis) {
            throw new Error('not_connected')
        }

        if (mainCommand !== 'select') {
            sharedIoRedis.ensureReadonlyConnection({ socket })
        }

        console.info(consolePrefix, mainCommand, commands)

        let result
        if (clusterOverriddenCommands.includes(mainCommand) && typeof redis[mainCommand] === 'function') {
            result = await redis[mainCommand](...commands)
        } else {
            result = await redis.call(mainCommand, ...commands)
        }

        const defaultEmit = {}

        let generatedCommand = mainCommand
        if (commands.length > 0) {
            generatedCommand += ' ' + commands.join(' ')
        }
        switch (mainCommand) {
            case 'select':
                defaultEmit.database = parseInt(commands[0])
                break;
        }

        /*
        switch (generatedCommand) {
            case 'client list':
                //result = result.split(' ')
                break;
        }
        */

        //console.warn(consolePrefix, typeof result, result)

        /*
        try {
            const clone = JSON.parse(JSON.stringify(result))
            console.warn(consolePrefix, typeof clone, clone)
        } catch(e) {
            console.warn(e)
        }
        */

        socket.emit(options.responseEvent, Object.assign(defaultEmit, {
            status: 'ok',
            result: result,
            generatedCommand: generatedCommand,
        }))
    } catch (e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e.message,
        })
    }


}
