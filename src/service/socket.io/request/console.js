const parser = (input, sep, keepQuotes) => {
    var separator = sep || /\s/g;
    var singleQuoteOpen = false;
    var doubleQuoteOpen = false;
    var tokenBuffer = [];
    var ret = [];

    var arr = input.split('');
    for (var i = 0; i < arr.length; ++i) {
        var element = arr[i];
        var matches = element.match(separator);
        if (element === "'" && !doubleQuoteOpen) {
            if (keepQuotes === true) {
                tokenBuffer.push(element);
            }
            singleQuoteOpen = !singleQuoteOpen;
            continue;
        } else if (element === '"' && !singleQuoteOpen) {
            if (keepQuotes === true) {
                tokenBuffer.push(element);
            }
            doubleQuoteOpen = !doubleQuoteOpen;
            continue;
        }

        if (!singleQuoteOpen && !doubleQuoteOpen && matches) {
            if (tokenBuffer.length > 0) {
                ret.push(tokenBuffer.join(''));
                tokenBuffer = [];
            } else if (!!sep) {
                ret.push(element);
            }
        } else {
            tokenBuffer.push(element);
        }
    }
    if (tokenBuffer.length > 0) {
        ret.push(tokenBuffer.join(''));
    } else if (!!sep) {
        ret.push('');
    }
    return ret;
}

const consolePrefix = 'socket.io console call'
module.exports = async (options) => {
    const {socket, payload} = options;

    const {command} = payload

    try {
        let redis = socket.p3xrs.ioredis

        const commands = parser( command);
        let mainCommand = commands.shift()
        mainCommand = mainCommand.toLowerCase();

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
