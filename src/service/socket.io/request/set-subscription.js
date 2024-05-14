const sharedIoRedis = require('../shared')

module.exports = async (options) => {
    const { socket, payload } = options;

    try {

        //sharedIoRedis.ensureReadonlyConnection({ socket })

        //console.log('Unsubscribing from all patterns');
        await socket.p3xrs.ioredisSubscriber.punsubscribe();
        //console.log('All patterns unsubscribed');
        
        socket.p3xrs.ioredisSubscriber.removeAllListeners('pmessage');
        //console.log('Removed all pmessage listeners');


        // Updating subscription settings
        socket.p3xrs.subscription = payload.subscription;
        if (typeof payload.subscriberPattern !== 'string' || payload.subscriberPattern.trim().length === 0) {
            payload.subscriberPattern = '*'; // Default pattern
        }

        if (socket.p3xrs.subscription === true) {
            // Subscribe to the pattern
            //console.log('socket.p3xrs.ioredisSubscriber.psubscribe', payload.subscriberPattern)
            await socket.p3xrs.ioredisSubscriber.psubscribe(payload.subscriberPattern);


            // Handle incoming messages
            socket.p3xrs.ioredisSubscriber.on('pmessage', (pattern, channel, message) => {
                console.log('socket.p3xrs.ioredisSubscriber.on(pmessage)', pattern, channel, message)
                socket.emit('pubsub-message', { 
                    channel: channel,
                    message: message,
                });
            });
        }
        // Confirm successful setup
        socket.emit(options.responseEvent, { status: 'ok' });
    } catch (e) {
        console.error('Subscription error:', e);
        socket.emit(options.responseEvent, { status: 'error', error: e.message });
    }
};

