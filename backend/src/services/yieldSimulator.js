const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { avalancheFuji } = require('viem/chains');
const cron = require('node-cron');

const OUSG_ABI = [
    {
        name: 'rebase',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [],
        outputs: [],
    },
    {
        name: 'lastRebase',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
];

const MOCK_ISSUER_ABI = [
    {
        name: 'rebaseToken',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'token', type: 'address' }],
        outputs: [],
    },
    {
        name: 'distributeYieldOnToken',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'token', type: 'address' },
            { name: 'yieldAmount', type: 'uint256' },
        ],
        outputs: [],
    },
];
const issuerAddress = process.env.MOCK_ISSUER_ADDRESS;

const BUIDL_ABI = [
    {
        name: 'distributeYield',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'yieldAmount', type: 'uint256' }],
        outputs: [],
    },
    {
        name: 'lastYieldDistribution',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'totalSupply',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
];

const ousgAddress = process.env.MOCK_OUSG_ADDRESS;
const buidlAddress = process.env.MOCK_BUIDL_ADDRESS;

let walletClient;
let publicClient;

function init() {
    const pk = process.env.BACKEND_HOT_WALLET_PRIVATE_KEY;
    if (!pk) {
        console.error('[YieldSim] Missing BACKEND_HOT_WALLET_PRIVATE_KEY');
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

async function simulateYield() {
    console.log('[YieldSim] Running yield simulation cycle...');

    if (ousgAddress) {
        try {
            const lastRebase = await publicClient.readContract({
                address: ousgAddress,
                abi: OUSG_ABI,
                functionName: 'lastRebase',
            });

            const now = BigInt(Math.floor(Date.now() / 1000));
            const oneDay = 86400n;

            if (now >= lastRebase + oneDay) {
                const txHash = await walletClient.writeContract({
                    address: issuerAddress,
                    abi: MOCK_ISSUER_ABI,
                    functionName: 'rebaseToken',
                    args: [ousgAddress],
                });

                const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
                console.log(`[YieldSim] ✅ OUSG rebased — tx: ${txHash} (status: ${receipt.status})`);
            } else {
                const remaining = Number(lastRebase + oneDay - now);
                console.log(`[YieldSim] OUSG rebase not due — ${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m remaining`);
            }
        } catch (err) {
            console.error('[YieldSim] ❌ OUSG rebase failed:', err.message);
        }
    }

    if (buidlAddress) {
        try {
            const lastDist = await publicClient.readContract({
                address: buidlAddress,
                abi: BUIDL_ABI,
                functionName: 'lastYieldDistribution',
            });

            const now = BigInt(Math.floor(Date.now() / 1000));
            const thirtyDays = 2592000n;

            if (now >= lastDist + thirtyDays) {
                const totalSupply = await publicClient.readContract({
                    address: buidlAddress,
                    abi: BUIDL_ABI,
                    functionName: 'totalSupply',
                });

                const monthlyYield = (totalSupply * 450n) / 120000n;

                const txHash = await walletClient.writeContract({
                    address: issuerAddress,
                    abi: MOCK_ISSUER_ABI,
                    functionName: 'distributeYieldOnToken',
                    args: [buidlAddress, monthlyYield],
                });

                const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
                console.log(`[YieldSim] ✅ BUIDL yield distributed (${monthlyYield}) — tx: ${txHash} (status: ${receipt.status})`);
            } else {
                const remaining = Number(lastDist + thirtyDays - now);
                console.log(`[YieldSim] BUIDL yield not due — ${Math.floor(remaining / 86400)}d remaining`);
            }
        } catch (err) {
            console.error('[YieldSim] ❌ BUIDL yield distribution failed:', err.message);
        }
    }
}

function start() {
    if (!init()) {
        console.warn('[YieldSim] Skipping yield simulator — missing config');
        return;
    }

    console.log('[YieldSim] Starting yield simulator');
    console.log(`[YieldSim] OUSG: ${ousgAddress || 'not configured'}`);
    console.log(`[YieldSim] BUIDL: ${buidlAddress || 'not configured'}`);

    simulateYield();

    cron.schedule('0 0 * * *', () => {
        console.log('[YieldSim] Daily cron triggered');
        simulateYield();
    });

    console.log('[YieldSim] Cron scheduled — midnight daily');
}

module.exports = { start, simulateYield };
