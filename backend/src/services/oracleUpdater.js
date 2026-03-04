const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { avalancheFuji } = require('viem/chains');
const cron = require('node-cron');
const pool = require('../db/pool');

const FALLBACK_NAV = {
    BUIDL: 100450000n,
    BENJI: 100810000n,
    OUSG: 100230000n,
};

const FALLBACK_APY = {
    BUIDL: 450n,
    BENJI: 485n,
    OUSG: 480n,
};

const MOCK_ORACLE_ABI = [
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
];

const oracleAddress = process.env.MOCK_ORACLE_ADDRESS;

let walletClient;
let publicClient;

function init() {
    const pk = process.env.BACKEND_HOT_WALLET_PRIVATE_KEY;
    if (!pk || !oracleAddress) {
        console.error('[OracleUpdater] Missing BACKEND_HOT_WALLET_PRIVATE_KEY or MOCK_ORACLE_ADDRESS');
        return false;
    }

    const account = privateKeyToAccount(pk);
    const rpcUrl = process.env.FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc';

    walletClient = createWalletClient({
        account,
        chain: avalancheFuji,
        transport: http(rpcUrl),
    });

    publicClient = createPublicClient({
        chain: avalancheFuji,
        transport: http(rpcUrl),
    });

    return true;
}

async function updateOracle() {
    console.log('[OracleUpdater] Running oracle update cycle...');

    const symbols = ['BUIDL', 'BENJI', 'OUSG'];

    for (const symbol of symbols) {
        try {
            const nav = FALLBACK_NAV[symbol];
            const apy = FALLBACK_APY[symbol];

            const txHash = await walletClient.writeContract({
                address: oracleAddress,
                abi: MOCK_ORACLE_ABI,
                functionName: 'setPrice',
                args: [symbol, nav, apy],
            });

            await publicClient.waitForTransactionReceipt({ hash: txHash });

            const navHuman = Number(nav) / 1e8;
            const apyHuman = Number(apy) / 100;

            try {
                await pool.query(
                    `UPDATE assets SET nav = $1, yield_apy = $2, last_updated = NOW() WHERE symbol = $3`,
                    [navHuman.toFixed(8), apyHuman.toFixed(4), symbol]
                );
            } catch (dbErr) {
                console.warn(`[OracleUpdater] DB update failed for ${symbol}: ${dbErr.message}`);
            }

            console.log(`[OracleUpdater] ✅ ${symbol} — NAV: $${navHuman.toFixed(4)}, APY: ${apyHuman.toFixed(2)}% — tx: ${txHash}`);
        } catch (err) {
            console.error(`[OracleUpdater] ❌ Failed to update ${symbol}:`, err.message);
        }
    }
}

function start() {
    if (!init()) {
        console.warn('[OracleUpdater] Skipping oracle updater — missing config');
        return;
    }

    console.log('[OracleUpdater] Starting oracle updater');
    console.log(`[OracleUpdater] MockOracle: ${oracleAddress}`);

    updateOracle();

    cron.schedule('0 * * * *', () => {
        console.log('[OracleUpdater] Hourly cron triggered');
        updateOracle();
    });

    console.log('[OracleUpdater] Cron scheduled — every hour');
}

module.exports = { start, updateOracle };
