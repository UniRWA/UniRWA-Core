require('dotenv').config({ path: require('path').resolve(__dirname, '../../backend/.env') });

const { createPublicClient, http, parseAbiItem } = require('viem');
const { avalancheFuji } = require('viem/chains');
const { Pool } = require('pg');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const client = createPublicClient({
    chain: avalancheFuji,
    transport: http(process.env.FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc'),
});

const POOLS = [
    { symbol: 'BUIDL', address: process.env.BUIDL_POOL_ADDRESS },
    { symbol: 'BENJI', address: process.env.BENJI_POOL_ADDRESS },
    { symbol: 'OUSG', address: process.env.OUSG_POOL_ADDRESS },
].filter(p => p.address);

const POOL_ADDRESSES = POOLS.map(p => p.address.toLowerCase());

const POOL_SYMBOL_MAP = {};
POOLS.forEach(p => { POOL_SYMBOL_MAP[p.address.toLowerCase()] = p.symbol; });

const TARGETS = [
    ...POOLS.map(p => ({
        label: `FractionalPool:${p.symbol}`,
        address: p.address,
        events: [
            parseAbiItem('event Deposited(address indexed user, uint256 assets, uint256 shares)'),
            parseAbiItem('event Withdrawn(address indexed user, uint256 shares, uint256 assets)'),
            parseAbiItem('event PoolFunded(uint256 usdcSpent, uint256 rwaReceived, uint256 timestamp)'),
        ],
    })),
    {
        label: 'HybridAMM',
        address: process.env.HYBRID_AMM_ADDRESS,
        events: [
            parseAbiItem('event Swap(address indexed trader, address indexed token, bool isSell, uint256 amountIn, uint256 amountOut, uint256 feeAmount)'),
        ],
    },
    {
        label: 'Orderbook',
        address: process.env.ORDERBOOK_ADDRESS,
        events: [
            parseAbiItem('event OrderPlaced(uint256 indexed orderId, address indexed trader, address indexed rwaToken, bool isBuy, uint256 limitPrice, uint256 amount)'),
            parseAbiItem('event OrderCancelled(uint256 indexed orderId, address indexed trader)'),
            parseAbiItem('event OrdersMatched(uint256 indexed buyId, uint256 indexed sellId, uint256 fillAmount, uint256 fillPrice)'),
        ],
    },
    {
        label: 'ComplianceNFT',
        address: process.env.COMPLIANCE_NFT_ADDRESS,
        events: [
            parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
        ],
    },
    {
        label: 'LiquidityMining',
        address: process.env.LIQUIDITY_MINING_ADDRESS,
        events: [
            parseAbiItem('event Staked(address indexed user, address indexed lpPool, uint256 amount)'),
            parseAbiItem('event Unstaked(address indexed user, address indexed lpPool, uint256 amount)'),
            parseAbiItem('event Claimed(address indexed user, uint256 amount)'),
        ],
    },
].filter(t => t.address);

function extractWallet(eventName, args) {
    if (args.user) return args.user.toLowerCase();
    if (args.trader) return args.trader.toLowerCase();
    if (args.to) return args.to.toLowerCase();
    return null;
}

function getEventName(log) {
    if (!log.eventName) return 'Unknown';
    return log.eventName;
}

function argsToData(args) {
    const out = {};
    for (const [k, v] of Object.entries(args || {})) {
        out[k] = typeof v === 'bigint' ? v.toString() : v;
    }
    return out;
}

async function insertEvent(log, label) {
    const eventName = getEventName(log);
    const wallet = extractWallet(eventName, log.args || {});
    const data = argsToData(log.args);

    if (eventName === 'Transfer' && log.args?.from !== '0x0000000000000000000000000000000000000000') {
        return;
    }

    await db.query(
        `INSERT INTO events (contract, event_name, tx_hash, wallet, data, block_number)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tx_hash, event_name) DO NOTHING`,
        [label, eventName, log.transactionHash, wallet, JSON.stringify(data), Number(log.blockNumber)]
    );
}

async function updateUserPositions(log, poolAddress) {
    const eventName = getEventName(log);
    const symbol = POOL_SYMBOL_MAP[poolAddress.toLowerCase()];
    if (!symbol) return;

    const wallet = (log.args?.user || '').toLowerCase();
    if (!wallet) return;

    if (eventName === 'Deposited') {
        const assets = Number(log.args.assets) / 1e6;
        const shares = Number(log.args.shares) / 1e6;
        await db.query(
            `INSERT INTO user_positions (wallet, asset_symbol, pool_address, token_balance, usdc_value, last_updated)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (wallet, asset_symbol, pool_address) DO UPDATE SET
               token_balance = user_positions.token_balance + EXCLUDED.token_balance,
               usdc_value    = user_positions.usdc_value + EXCLUDED.usdc_value,
               last_updated  = NOW()`,
            [wallet, symbol, poolAddress.toLowerCase(), shares, assets]
        );
    }

    if (eventName === 'Withdrawn') {
        const assets = Number(log.args.assets) / 1e6;
        const shares = Number(log.args.shares) / 1e6;
        await db.query(
            `UPDATE user_positions
             SET token_balance = GREATEST(0, token_balance - $1),
                 usdc_value    = GREATEST(0, usdc_value - $2),
                 last_updated  = NOW()
             WHERE wallet = $3 AND asset_symbol = $4 AND pool_address = $5`,
            [shares, assets, wallet, symbol, poolAddress.toLowerCase()]
        );
    }
}

async function getLastIndexedBlock(currentBlock) {
    const res = await db.query(`SELECT value FROM indexer_state WHERE key = 'lastBlock'`);
    if (!res.rows.length || !res.rows[0].value || res.rows[0].value === '0') {
        return currentBlock - 1000n;
    }
    return BigInt(res.rows[0].value);
}

async function setLastIndexedBlock(blockNumber) {
    await db.query(
        `INSERT INTO indexer_state (key, value) VALUES ('lastBlock', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [blockNumber.toString()]
    );
}

async function poll() {
    try {
        const currentBlock = await client.getBlockNumber();
        const lastBlock = await getLastIndexedBlock(currentBlock);

        if (currentBlock <= lastBlock) {
            return;
        }

        const fromBlock = lastBlock + 1n;
        const toBlock = currentBlock;

        let totalInserted = 0;

        for (const target of TARGETS) {
            for (const event of target.events) {
                try {
                    const logs = await client.getLogs({
                        address: target.address,
                        event,
                        fromBlock,
                        toBlock,
                    });

                    for (const log of logs) {
                        await insertEvent(log, target.label);
                        totalInserted++;

                        if (POOL_ADDRESSES.includes(target.address.toLowerCase())) {
                            await updateUserPositions(log, target.address);
                        }
                    }
                } catch (err) {
                    console.error(`[Indexer] Error fetching ${target.label} ${event.name}:`, err.message);
                }
            }
        }

        await setLastIndexedBlock(toBlock);
        console.log(`[Indexer] Indexed blocks ${fromBlock}→${toBlock} — ${totalInserted} events`);
    } catch (err) {
        console.error('[Indexer] Poll error:', err.message);
    }
}

async function main() {
    console.log('[Indexer] Starting UniRWA Event Indexer');
    console.log(`[Indexer] Contracts: ${TARGETS.map(t => t.label).join(', ')}`);

    await poll();
    setInterval(poll, 15_000);
}

main().catch(err => {
    console.error('[Indexer] Fatal:', err.message);
    process.exit(1);
});
