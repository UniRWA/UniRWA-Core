const express = require('express');
const { createPublicClient, http } = require('viem');
const { avalancheFuji } = require('viem/chains');
const redisClient = require('../db/redis');
const pool = require('../db/pool');

const router = express.Router();

const CACHE_TTL = 60;

const client = createPublicClient({
    chain: avalancheFuji,
    transport: http(process.env.FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc'),
});

const POOL_ABI = [
    {
        name: 'getPoolInfo',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            { name: 'symbol', type: 'string' },
            { name: 'target', type: 'uint256' },
            { name: 'deposited', type: 'uint256' },
            { name: 'minDep', type: 'uint256' },
            { name: 'funded', type: 'bool' },
            { name: 'progress', type: 'uint256' },
        ],
    },
    {
        name: 'totalDeposited',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
];

const FACTORY_ABI = [
    {
        name: 'getAllPools',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address[]' }],
    },
];

const KNOWN_POOLS = [
    process.env.BUIDL_POOL_ADDRESS,
    process.env.BENJI_POOL_ADDRESS,
    process.env.OUSG_POOL_ADDRESS,
].filter(Boolean);

const ASSET_META = {
    'BUIDL': { name: 'BlackRock BUIDL Pool', issuer: 'BlackRock (via Securitize)' },
    'BENJI': { name: 'Franklin BENJI Pool', issuer: 'Franklin Templeton' },
    'OUSG': { name: 'Ondo OUSG Pool', issuer: 'Ondo Finance' },
};

async function fetchPoolData(poolAddresses) {
    const calls = poolAddresses.map((addr) => ({
        address: addr,
        abi: POOL_ABI,
        functionName: 'getPoolInfo',
    }));

    const results = await client.multicall({ contracts: calls });

    const pools = [];

    for (let i = 0; i < poolAddresses.length; i++) {
        const result = results[i];
        const address = poolAddresses[i];

        if (result.status === 'failure') {
            console.warn(`[Pools] ⚠ getPoolInfo() failed for ${address}`);
            continue;
        }

        const [symbol, target, deposited, minDep, funded, progress] = result.result;

        const thresholdNum = Number(target) / 1e6;
        const filledNum = Number(deposited) / 1e6;
        const minDepositNum = Number(minDep) / 1e6;

        let apy = '0.00';
        let nav = '1.0000';
        try {
            const dbResult = await pool.query(
                'SELECT yield_apy, nav FROM assets WHERE symbol = $1',
                [symbol]
            );
            if (dbResult.rows.length > 0) {
                apy = Number(dbResult.rows[0].yield_apy).toFixed(2);
                nav = Number(dbResult.rows[0].nav).toFixed(4);
            }
        } catch (err) {
            console.warn(`[Pools] Could not fetch DB data for ${symbol}: ${err.message}`);
        }

        const meta = ASSET_META[symbol] || { name: `${symbol} Pool`, issuer: 'Unknown' };

        pools.push({
            address,
            asset_symbol: symbol,
            asset_name: `${meta.name} #1`,
            status: funded ? 'funded' : 'filling',
            filled: filledNum,
            threshold: thresholdNum,
            participants: 0,
            min_deposit: minDepositNum,
            apy: `${apy}%`,
            nav: `$${nav}`,
            issuer: meta.issuer,
            progress: Number(progress),
        });
    }

    return pools;
}

router.get('/api/pools', async (req, res) => {
    try {
        const cacheKey = 'pools:all';
        const cached = await redisClient.get(cacheKey).catch(() => null);

        if (cached) {
            console.log('[Pools] Cache hit — pools:all');
            return res.json(JSON.parse(cached));
        }

        let poolAddresses = KNOWN_POOLS;
        const factoryAddress = process.env.POOL_FACTORY_ADDRESS;

        if (factoryAddress) {
            try {
                const onChainPools = await client.readContract({
                    address: factoryAddress,
                    abi: FACTORY_ABI,
                    functionName: 'getAllPools',
                });
                if (onChainPools && onChainPools.length > 0) {
                    poolAddresses = onChainPools;
                }
            } catch (err) {
                console.warn('[Pools] PoolFactory.getAllPools() failed, using known addresses:', err.message);
            }
        }

        if (poolAddresses.length === 0) {
            return res.json([]);
        }

        const pools = await fetchPoolData(poolAddresses);

        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(pools)).catch(() => { });

        console.log(`[Pools] Fetched ${pools.length} pools from chain, cached for ${CACHE_TTL}s`);
        res.json(pools);
    } catch (err) {
        console.error('[Pools] Error fetching pools:', err.message);
        res.status(500).json({ error: 'Failed to fetch pools' });
    }
});

router.get('/api/pools/:address', async (req, res) => {
    try {
        const { address } = req.params;

        const cacheKey = `pools:${address.toLowerCase()}`;
        const cached = await redisClient.get(cacheKey).catch(() => null);

        if (cached) {
            console.log(`[Pools] Cache hit — ${cacheKey}`);
            return res.json(JSON.parse(cached));
        }

        const pools = await fetchPoolData([address]);

        if (pools.length === 0) {
            return res.status(404).json({ error: `Pool "${address}" not found or contract call failed` });
        }

        const poolData = pools[0];

        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(poolData)).catch(() => { });

        console.log(`[Pools] Cache miss — fetched pool ${address} from chain, cached for ${CACHE_TTL}s`);
        res.json(poolData);
    } catch (err) {
        console.error('[Pools] Error fetching pool:', err.message);
        res.status(500).json({ error: 'Failed to fetch pool' });
    }
});

module.exports = router;
