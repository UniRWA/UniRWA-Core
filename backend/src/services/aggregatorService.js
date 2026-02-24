const { createPublicClient, http } = require('viem');
const { avalancheFuji } = require('viem/chains');
const cron = require('node-cron');
const pool = require('../db/pool');

// MockOracle ABI — only the functions we need
const ORACLE_ABI = [
    {
        name: 'getNAV',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'symbol', type: 'string' }],
        outputs: [{ name: '', type: 'int256' }],
    },
    {
        name: 'getAPY',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'symbol', type: 'string' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
];

const SYMBOLS = ['BUIDL', 'BENJI', 'OUSG'];

// viem public client for Fuji
const client = createPublicClient({
    chain: avalancheFuji,
    transport: http(process.env.FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc'),
});

/**
 * Fetch NAV + APY from MockOracle via multicall, update assets table
 */
async function fetchAndStoreAssetData() {
    const oracleAddress = process.env.MOCK_ORACLE_ADDRESS;

    if (!oracleAddress) {
        console.error('[Aggregator] MOCK_ORACLE_ADDRESS not set in env');
        return;
    }

    console.log('[Aggregator] Fetching NAV + APY from MockOracle...');

    try {
        // build multicall contracts — 6 calls total (getNAV + getAPY for each symbol)
        const calls = SYMBOLS.flatMap((symbol) => [
            {
                address: oracleAddress,
                abi: ORACLE_ABI,
                functionName: 'getNAV',
                args: [symbol],
            },
            {
                address: oracleAddress,
                abi: ORACLE_ABI,
                functionName: 'getAPY',
                args: [symbol],
            },
        ]);

        const results = await client.multicall({ contracts: calls });

        // process results in pairs (nav, apy) for each symbol
        for (let i = 0; i < SYMBOLS.length; i++) {
            const symbol = SYMBOLS[i];
            const navResult = results[i * 2];
            const apyResult = results[i * 2 + 1];

            if (navResult.status === 'failure') {
                console.warn(`[Aggregator] ⚠ getNAV("${symbol}") reverted — keeping last DB value`);
                continue;
            }
            if (apyResult.status === 'failure') {
                console.warn(`[Aggregator] ⚠ getAPY("${symbol}") reverted — keeping last DB value`);
                continue;
            }

            // nav is int256 with 8 decimals → convert to human readable
            // e.g. 100450000n → 1.00450000
            const navRaw = navResult.result;
            const nav = Number(navRaw) / 1e8;

            // apy is uint256 in basis points → convert to percentage
            // e.g. 450n → 4.50
            const apyRaw = apyResult.result;
            const yieldApy = Number(apyRaw) / 100;

            // upsert into assets table
            await pool.query(
                `UPDATE assets
         SET nav = $1, yield_apy = $2, last_updated = NOW()
         WHERE symbol = $3`,
                [nav.toFixed(8), yieldApy.toFixed(4), symbol]
            );

            console.log(`[Aggregator] ✓ ${symbol} — NAV: $${nav.toFixed(4)}, APY: ${yieldApy.toFixed(2)}%`);
        }

        console.log('[Aggregator] ✅ Asset data updated successfully');
    } catch (err) {
        console.error('[Aggregator] ❌ Failed to fetch oracle data:', err.message);
        // graceful failure — DB keeps last known values
    }
}

/**
 * Start the cron job (every 5 minutes) and run immediately
 */
function startCron() {
    // run immediately on startup
    fetchAndStoreAssetData();

    // schedule every 5 minutes
    cron.schedule('*/5 * * * *', () => {
        console.log('[Aggregator] Cron triggered — refreshing asset data...');
        fetchAndStoreAssetData();
    });

    console.log('[Aggregator] Cron scheduled — every 5 minutes');
}

module.exports = { startCron, fetchAndStoreAssetData };
