module.exports = async (options) => {
    const { socket, payload } = options;

    try {
        if (socket.p3xrs && socket.p3xrs.subscription) {
            // Unsubscribe before clearing the old listener to prevent memory leaks
            await socket.p3xrs.ioredisSubscriber.punsubscribe('*');

            // Remove old listeners to prevent multiple listeners from accumulating
            socket.p3xrs.ioredisSubscriber.removeAllListeners('pmessage');
        }

        // Updating subscription settings
        socket.p3xrs.subscription = payload.subscription;
        if (typeof payload.subscriberPattern !== 'string' || payload.subscriberPattern.trim().length === 0) {
            payload.subscriberPattern = '*'; // Default pattern
        }

        if (socket.p3xrs.subscription === true) {
            // Subscribe to the pattern
            await socket.p3xrs.ioredisSubscriber.psubscribe(payload.subscriberPattern);

            console.log('socket.p3xrs.subscription', payload.subscriberPattern)

            // Handle incoming messages
            socket.p3xrs.ioredisSubscriber.on('pmessage', (pattern, channel, message) => {
                //console.log('subscription', pattern, channel, message)
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

