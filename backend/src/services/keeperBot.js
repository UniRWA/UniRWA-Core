const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { avalancheFuji } = require('viem/chains');

const RWA_TOKENS = [
    { symbol: 'BUIDL', address: process.env.MOCK_BUIDL_ADDRESS },
    { symbol: 'BENJI', address: process.env.MOCK_BENJI_ADDRESS },
    { symbol: 'OUSG', address: process.env.MOCK_OUSG_ADDRESS },
];

const ORDERBOOK_ABI = [
    {
        name: 'getActiveOrders',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'rwaToken', type: 'address' }],
        outputs: [{
            name: '',
            type: 'tuple[]',
            components: [
                { name: 'id', type: 'uint256' },
                { name: 'trader', type: 'address' },
                { name: 'rwaToken', type: 'address' },
                { name: 'isBuy', type: 'bool' },
                { name: 'limitPrice', type: 'uint256' },
                { name: 'amount', type: 'uint256' },
                { name: 'filled', type: 'uint256' },
                { name: 'timestamp', type: 'uint256' },
                { name: 'active', type: 'bool' },
            ],
        }],
    },
    {
        name: 'matchOrders',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'buyId', type: 'uint256' },
            { name: 'sellId', type: 'uint256' },
        ],
        outputs: [],
    },
];

const orderbookAddress = process.env.ORDERBOOK_ADDRESS;

let walletClient;
let publicClient;

function init() {
    const pk = process.env.BACKEND_HOT_WALLET_PRIVATE_KEY;
    if (!pk || !orderbookAddress) {
        console.error('[Keeper] Missing BACKEND_HOT_WALLET_PRIVATE_KEY or ORDERBOOK_ADDRESS');
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

async function runKeeperCycle() {
    for (const token of RWA_TOKENS) {
        if (!token.address) continue;

        try {
            const orders = await publicClient.readContract({
                address: orderbookAddress,
                abi: ORDERBOOK_ABI,
                functionName: 'getActiveOrders',
                args: [token.address],
            });

            if (!orders || orders.length === 0) {
                continue;
            }

            const buys = orders
                .filter(o => o.isBuy && o.active)
                .sort((a, b) => (b.limitPrice > a.limitPrice ? 1 : -1));

            const sells = orders
                .filter(o => !o.isBuy && o.active)
                .sort((a, b) => (a.limitPrice > b.limitPrice ? 1 : -1));

            if (buys.length === 0 || sells.length === 0) {
                continue;
            }

            if (buys[0].limitPrice >= sells[0].limitPrice) {
                console.log(`[Keeper] Matching order ${buys[0].id} vs ${sells[0].id} for ${token.symbol} at price ${sells[0].limitPrice}`);

                const txHash = await walletClient.writeContract({
                    address: orderbookAddress,
                    abi: ORDERBOOK_ABI,
                    functionName: 'matchOrders',
                    args: [buys[0].id, sells[0].id],
                });

                const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
                console.log(`[Keeper] ✅ Matched — tx: ${txHash} (status: ${receipt.status})`);
            } else {
                console.log(`[Keeper] No match for ${token.symbol} — best buy ${buys[0].limitPrice} < best sell ${sells[0].limitPrice}`);
            }
        } catch (err) {
            console.error(`[Keeper] ❌ Error processing ${token.symbol}:`, err.message);
        }
    }
}

let intervalId;

function start() {
    if (!init()) {
        console.warn('[Keeper] Skipping keeper bot — missing config');
        return;
    }

    console.log('[Keeper] Starting keeper bot — polling every 10s');
    console.log(`[Keeper] Orderbook: ${orderbookAddress}`);
    console.log(`[Keeper] Tokens: ${RWA_TOKENS.filter(t => t.address).map(t => t.symbol).join(', ')}`);

    runKeeperCycle();
    intervalId = setInterval(runKeeperCycle, 10_000);
}

function stop() {
    if (intervalId) {
        clearInterval(intervalId);
        console.log('[Keeper] Stopped');
    }
}

module.exports = { start, stop };
