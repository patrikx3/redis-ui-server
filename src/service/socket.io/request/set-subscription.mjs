export default async (options) => {
    const { socket, payload } = options;

    try {
        if (!socket.p3xrs.ioredisSubscriber) {
            socket.emit(options.responseEvent, { status: 'error', error: 'Not connected to Redis' })
            return
        }

        //sharedIoRedis.ensureReadonlyConnection({ socket })

        //console.log('Unsubscribing from all patterns');
        await socket.p3xrs.ioredisSubscriber.punsubscribe();
        //console.log('All patterns unsubscribed');

        socket.p3xrs.ioredisSubscriber.removeAllListeners('pmessage');
        socket.p3xrs.ioredisSubscriber.removeAllListeners('pmessageBuffer');
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


            // Use pmessageBuffer to preserve raw binary data (e.g. msgpack from socket.io-adapter)
            // Socket.IO will transmit the Buffer as binary, frontend handles decoding
            socket.p3xrs.ioredisSubscriber.on('pmessageBuffer', (pattern, channel, message) => {
                const channelStr = channel.toString('utf-8');
                console.log('socket.p3xrs.ioredisSubscriber.on(pmessageBuffer)', pattern.toString('utf-8'), channelStr)
                socket.emit('pubsub-message', {
                    channel: channelStr,
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
