const { createClient } = require('redis');

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
    console.error('[Redis] Client error:', err.message || err.code || String(err));
});

redisClient.on('connect', () => {
    console.log('[Redis] Connected');
});

// connect immediately
(async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        console.error('[Redis] Failed to connect:', err.message);
    }
})();

module.exports = redisClient;
