const consolePrefix = 'socket.io console call'
module.exports = async(options) => {
    const { socket, payload } = options;

    const { command } = payload

    try {
        let redis = socket.p3xrs.ioredis

        const commands = command.trim().split(' ').filter(val => val.trim() !== '')
        let mainCommand = commands.shift()
        mainCommand = mainCommand.toLowerCase();
        let result = await redis.call(mainCommand, commands)

        const defaultEmit = {

        }

        let generatedCommand = mainCommand
        if (commands.length > 0) {
            generatedCommand += ' ' + commands.join(' ')
        }
        switch(mainCommand) {
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
    } catch(e) {
        console.error(e)
        socket.emit(options.responseEvent, {
            status: 'error',
            error: e,
        })
    }


}