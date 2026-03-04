const { createPublicClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { avalancheFuji } = require('viem/chains');
const cron = require('node-cron');
const pool = require('../db/pool');

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
    {
        name: 'setPrice',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'symbol', type: 'string' },
            { name: 'nav', type: 'int256' },
            { name: 'apy', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        name: 'prices',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'symbol', type: 'string' }],
        outputs: [
            { name: 'nav', type: 'int256' },
            { name: 'updatedAt', type: 'uint256' },
            { name: 'apy', type: 'uint256' },
        ],
    },
];

const DEFAULT_PRICES = {
    BUIDL: { nav: 100450000n, apy: 450n },
    BENJI: { nav: 100810000n, apy: 485n },
    OUSG: { nav: 100230000n, apy: 480n },
};

const SYMBOLS = ['BUIDL', 'BENJI', 'OUSG'];
const STALENESS_THRESHOLD = 2 * 60 * 60;

const rpcUrl = process.env.FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc';

const publicClient = createPublicClient({
    chain: avalancheFuji,
    transport: http(rpcUrl),
});

let walletClient = null;

function initWalletClient() {
    const pk = process.env.BACKEND_HOT_WALLET_PRIVATE_KEY;
    if (!pk) {
        console.warn('[Aggregator] No BACKEND_HOT_WALLET_PRIVATE_KEY — cannot refresh oracle prices');
        return false;
    }
    const account = privateKeyToAccount(pk);
    walletClient = createWalletClient({
        account,
        chain: avalancheFuji,
        transport: http(rpcUrl),
    });
    return true;
}

async function refreshOraclePrices() {
    const oracleAddress = process.env.MOCK_ORACLE_ADDRESS;
    if (!oracleAddress || !walletClient) return;

    try {
        for (const symbol of SYMBOLS) {
            try {
                const priceData = await publicClient.readContract({
                    address: oracleAddress,
                    abi: ORACLE_ABI,
                    functionName: 'prices',
                    args: [symbol],
                });

                const [nav, updatedAt, apy] = priceData;
                const now = BigInt(Math.floor(Date.now() / 1000));
                const age = Number(now - updatedAt);

                if (updatedAt === 0n || age > STALENESS_THRESHOLD - 1800) {
                    const navToSet = updatedAt === 0n ? DEFAULT_PRICES[symbol].nav : nav;
                    const apyToSet = updatedAt === 0n ? DEFAULT_PRICES[symbol].apy : apy;

                    const txHash = await walletClient.writeContract({
                        address: oracleAddress,
                        abi: ORACLE_ABI,
                        functionName: 'setPrice',
                        args: [symbol, navToSet, apyToSet],
                    });

                    await publicClient.waitForTransactionReceipt({ hash: txHash });
                    console.log(`[Aggregator] 🔄 Refreshed oracle price for ${symbol} (was ${age}s old)`);
                }
            } catch (err) {
                console.warn(`[Aggregator] Could not refresh ${symbol} price:`, err.message);
            }
        }
    } catch (err) {
        console.error('[Aggregator] Oracle refresh error:', err.message);
    }
}

async function fetchAndStoreAssetData() {
    const oracleAddress = process.env.MOCK_ORACLE_ADDRESS;

    if (!oracleAddress) {
        console.error('[Aggregator] MOCK_ORACLE_ADDRESS not set in env');
        return;
    }

    await refreshOraclePrices();

    console.log('[Aggregator] Fetching NAV + APY from MockOracle...');

    try {
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

        const results = await publicClient.multicall({ contracts: calls });

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

            const navRaw = navResult.result;
            const nav = Number(navRaw) / 1e8;

            const apyRaw = apyResult.result;
            const yieldApy = Number(apyRaw) / 100;

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
    }
}

function startCron() {
    initWalletClient();

    fetchAndStoreAssetData();

    cron.schedule('*/5 * * * *', () => {
        console.log('[Aggregator] Cron triggered — refreshing asset data...');
        fetchAndStoreAssetData();
    });

    console.log('[Aggregator] Cron scheduled — every 5 minutes');
}

module.exports = { startCron, fetchAndStoreAssetData };
