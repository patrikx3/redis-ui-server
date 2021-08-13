const sharedIoRedis = require('../shared')

const parser = sharedIoRedis.argumentParser

const disabledCommands = ['monitor']

const consolePrefix = 'socket.io console call'
module.exports = async (options) => {
    const {socket, payload} = options;

    const {command} = payload

    try {
        let redis = socket.p3xrs.ioredis

        const commands = parser( command);
        let mainCommand = commands.shift()
        mainCommand = mainCommand.toLowerCase();

        if (disabledCommands.includes('monitor')) {
            throw new Error('invalid_console_command')
        }

        if (mainCommand !== 'select') {
            sharedIoRedis.ensureReadonlyConnection({ socket })
        }

        console.info(consolePrefix, mainCommand, commands)
        /*
        if (!socket.p3xrs.commands.includes(mainCommand)) {
            throw new Error(`ERR Unknown command '${mainCommand}'.`)
        }
         */
        let result = await redis.call(mainCommand, commands)

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
