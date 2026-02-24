const express = require('express');
const pool = require('../db/pool');
const redisClient = require('../db/redis');

const router = express.Router();

const CACHE_TTL = 60; // seconds

// GET /health
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// GET /api/assets — all assets sorted by TVL desc, cached 60s
router.get('/api/assets', async (req, res) => {
    try {
        // check Redis cache
        const cacheKey = 'assets:all';
        const cached = await redisClient.get(cacheKey).catch(() => null);

        if (cached) {
            console.log('[Assets] Cache hit — assets:all');
            return res.json(JSON.parse(cached));
        }

        // query DB
        const result = await pool.query(
            'SELECT * FROM assets ORDER BY tvl DESC'
        );

        const assets = result.rows;

        // cache result
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(assets)).catch(() => { });

        console.log('[Assets] Cache miss — queried DB, cached for 60s');
        res.json(assets);
    } catch (err) {
        console.error('[Assets] Error fetching assets:', err.message);
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
});

// GET /api/assets/:symbol — single asset, cached 60s
router.get('/api/assets/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const upperSymbol = symbol.toUpperCase();

        // check Redis cache
        const cacheKey = `assets:${upperSymbol}`;
        const cached = await redisClient.get(cacheKey).catch(() => null);

        if (cached) {
            console.log(`[Assets] Cache hit — ${cacheKey}`);
            return res.json(JSON.parse(cached));
        }

        // query DB
        const result = await pool.query(
            'SELECT * FROM assets WHERE symbol = $1',
            [upperSymbol]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Asset "${upperSymbol}" not found` });
        }

        const asset = result.rows[0];

        // cache result
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(asset)).catch(() => { });

        console.log(`[Assets] Cache miss — queried DB for ${upperSymbol}, cached for 60s`);
        res.json(asset);
    } catch (err) {
        console.error('[Assets] Error fetching asset:', err.message);
        res.status(500).json({ error: 'Failed to fetch asset' });
    }
});

module.exports = router;
