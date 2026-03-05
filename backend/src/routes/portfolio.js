const express = require("express");
const { createPublicClient, http } = require("viem");
const { avalancheFuji } = require("viem/chains");
const redisClient = require("../db/redis");
const pgPool = require("../db/pool");

const router = express.Router();

const CACHE_TTL = 30; // 30s — portfolio data is personal + changes on every block

const client = createPublicClient({
  chain: avalancheFuji,
  transport: http(
    process.env.FUJI_RPC || "https://api.avax-test.network/ext/bc/C/rpc",
  ),
});

// ─── Address Maps ──────────────────────────────────────────────────
const POOLS = [
  { symbol: "BUIDL", address: process.env.BUIDL_POOL_ADDRESS },
  { symbol: "BENJI", address: process.env.BENJI_POOL_ADDRESS },
  { symbol: "OUSG", address: process.env.OUSG_POOL_ADDRESS },
].filter((p) => p.address);

const RWA_TOKENS = [
  { symbol: "BUIDL", address: process.env.MOCK_BUIDL_ADDRESS },
  { symbol: "BENJI", address: process.env.MOCK_BENJI_ADDRESS },
  { symbol: "OUSG", address: process.env.MOCK_OUSG_ADDRESS },
].filter((t) => t.address);

const USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS;
const LIQUIDITY_MINING_ADDRESS = process.env.LIQUIDITY_MINING_ADDRESS;
const ORDERBOOK_ADDRESS = process.env.ORDERBOOK_ADDRESS;

// ─── Minimal ABIs for multicall ────────────────────────────────────
const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

const ERC4626_ABI = [
  ...ERC20_BALANCE_ABI,
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "poolFunded",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
];

const STAKED_LP_ABI = [
  {
    name: "stakedLP",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "lpPool", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
];

const PENDING_REWARDS_ABI = [
  {
    name: "pendingRewards",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "pending", type: "uint256" }],
  },
];

const ORDERBOOK_ABI = [
  {
    name: "getActiveOrders",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "rwaToken", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "trader", type: "address" },
          { name: "rwaToken", type: "address" },
          { name: "isBuy", type: "bool" },
          { name: "limitPrice", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "filled", type: "uint256" },
          { name: "timestamp", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
];

// ─── GET /api/portfolio?wallet=0x... ───────────────────────────────
router.get("/api/portfolio", async (req, res) => {
  try {
    const { wallet } = req.query;

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return res
        .status(400)
        .json({ error: "Missing or invalid wallet address" });
    }

    const walletAddr = wallet;

    // Cache check
    const cacheKey = `portfolio:${walletAddr.toLowerCase()}`;
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) {
      console.log(`[Portfolio] Cache hit — ${cacheKey}`);
      return res.json(JSON.parse(cached));
    }

    // ── Build multicall batch (20 calls, 1 RPC) ──
    const contracts = [];

    // 1. For each pool: balanceOf, totalAssets, totalSupply, poolFunded (4 × 3 = 12)
    for (const pool of POOLS) {
      contracts.push(
        {
          address: pool.address,
          abi: ERC4626_ABI,
          functionName: "balanceOf",
          args: [walletAddr],
        },
        {
          address: pool.address,
          abi: ERC4626_ABI,
          functionName: "totalAssets",
        },
        {
          address: pool.address,
          abi: ERC4626_ABI,
          functionName: "totalSupply",
        },
        { address: pool.address, abi: ERC4626_ABI, functionName: "poolFunded" },
      );
    }

    // 2. For each RWA token: balanceOf (3)
    for (const token of RWA_TOKENS) {
      contracts.push({
        address: token.address,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [walletAddr],
      });
    }

    // 3. LiquidityMining.stakedLP(wallet, pool) × 3 pools (3)
    if (LIQUIDITY_MINING_ADDRESS) {
      for (const pool of POOLS) {
        contracts.push({
          address: LIQUIDITY_MINING_ADDRESS,
          abi: STAKED_LP_ABI,
          functionName: "stakedLP",
          args: [walletAddr, pool.address],
        });
      }
    }

    // 4. LiquidityMining.pendingRewards(wallet) (1)
    if (LIQUIDITY_MINING_ADDRESS) {
      contracts.push({
        address: LIQUIDITY_MINING_ADDRESS,
        abi: PENDING_REWARDS_ABI,
        functionName: "pendingRewards",
        args: [walletAddr],
      });
    }

    // 5. USDC.balanceOf(wallet) (1)
    if (USDC_ADDRESS) {
      contracts.push({
        address: USDC_ADDRESS,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [walletAddr],
      });
    }

    // ── Execute multicall ──
    const results = await client.multicall({ contracts });

    // ── Parse results ──
    let idx = 0;

    // Fetch NAV from DB for USD conversion
    let navMap = {};
    try {
      const dbResult = await pgPool.query("SELECT symbol, nav FROM assets");
      for (const row of dbResult.rows) {
        navMap[row.symbol] = Number(row.nav);
      }
    } catch (err) {
      console.warn("[Portfolio] Could not fetch NAV from DB:", err.message);
    }

    // Fetch deposited values from user_positions table
    let depositedMap = {};
    try {
      const posResult = await pgPool.query(
        "SELECT pool_address, usdc_value FROM user_positions WHERE wallet = $1",
        [walletAddr.toLowerCase()],
      );
      for (const row of posResult.rows) {
        depositedMap[row.pool_address.toLowerCase()] = Number(row.usdc_value);
      }
    } catch (err) {
      console.warn("[Portfolio] Could not fetch user_positions:", err.message);
    }

    // 1. Parse pool positions
    const pools = [];
    for (const pool of POOLS) {
      const shares = safeNumber(results[idx++], 6); // ERC4626 shares in USDC decimals
      const totalAssets = safeNumber(results[idx++], 6);
      const totalSupply = safeNumber(results[idx++], 6);
      const funded = results[idx++]?.result ?? false;

      // Calculate USDC value of shares
      let usdcValue = 0;
      if (totalSupply > 0) {
        usdcValue = (shares / totalSupply) * totalAssets;
      }

      const depositedValue = depositedMap[pool.address.toLowerCase()] ?? 0;
      const yieldEarned = usdcValue - depositedValue;

      pools.push({
        poolAddress: pool.address,
        assetSymbol: pool.symbol,
        shares: round(shares, 2),
        usdcValue: round(usdcValue, 2),
        depositedValue: round(depositedValue, 2),
        yieldEarned: round(Math.max(0, yieldEarned), 2),
        status: funded ? "funded" : "filling",
      });
    }

    // 2. Parse direct holdings
    const directHoldings = [];
    for (const token of RWA_TOKENS) {
      const balance = safeNumber(results[idx++], 18); // RWA tokens are 18 decimals
      const nav = navMap[token.symbol] || 1.0;
      directHoldings.push({
        symbol: token.symbol,
        balance: round(balance, 4),
        nav: round(nav, 4),
        usdcValue: round(balance * nav, 2),
      });
    }

    // 3. Parse staked LP
    const stakedLP = {};
    if (LIQUIDITY_MINING_ADDRESS) {
      for (const pool of POOLS) {
        stakedLP[pool.symbol] = round(safeNumber(results[idx++], 18), 4);
      }
    }

    // 4. Parse pending AVAX rewards
    let pendingAVAX = 0;
    if (LIQUIDITY_MINING_ADDRESS) {
      pendingAVAX = round(safeNumber(results[idx++], 18), 6);
    }

    // 5. Parse USDC balance
    let usdcBalance = 0;
    if (USDC_ADDRESS) {
      usdcBalance = round(safeNumber(results[idx++], 6), 2);
    }

    // Add USDC to direct holdings
    directHoldings.push({
      symbol: "USDC",
      balance: usdcBalance,
      nav: 1.0,
      usdcValue: usdcBalance,
    });

    // 6. Count open orders (quick scan)
    let openOrders = 0;
    if (ORDERBOOK_ADDRESS) {
      try {
        for (const token of RWA_TOKENS) {
          const activeOrders = await client.readContract({
            address: ORDERBOOK_ADDRESS,
            abi: ORDERBOOK_ABI,
            functionName: "getActiveOrders",
            args: [token.address],
          });
          openOrders += (activeOrders || []).filter(
            (o) =>
              o.active && o.trader.toLowerCase() === walletAddr.toLowerCase(),
          ).length;
        }
      } catch (err) {
        console.warn("[Portfolio] Could not count open orders:", err.message);
      }
    }

    // ── Calculate total portfolio value ──
    const totalPoolValue = pools.reduce((s, p) => s + p.usdcValue, 0);
    const totalHoldingsValue = directHoldings.reduce(
      (s, h) => s + h.usdcValue,
      0,
    );
    const totalPortfolioValue = round(totalPoolValue + totalHoldingsValue, 2);

    const response = {
      wallet: walletAddr,
      totalPortfolioValue,
      pools,
      directHoldings,
      stakedLP,
      pendingAVAX,
      openOrders,
    };

    // Cache
    await redisClient
      .setEx(cacheKey, CACHE_TTL, JSON.stringify(response))
      .catch(() => { });
    console.log(
      `[Portfolio] Fetched for ${walletAddr.slice(0, 8)}…, totalValue=$${totalPortfolioValue}, cached ${CACHE_TTL}s`,
    );

    res.json(response);
  } catch (err) {
    console.error("[Portfolio] Error:", err.message);
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
});

// ─── GET /api/portfolio/history?wallet=&limit=20&offset=0 ──────────
router.get("/api/portfolio/history", async (req, res) => {
  try {
    const { wallet, limit = "20", offset = "0" } = req.query;

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return res
        .status(400)
        .json({ error: "Missing or invalid wallet address" });
    }

    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offsetNum = Math.max(0, parseInt(offset, 10) || 0);

    // Cache check
    const cacheKey = `portfolio:history:${wallet.toLowerCase()}:${limitNum}:${offsetNum}`;
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) {
      console.log(`[Portfolio] Cache hit — ${cacheKey}`);
      return res.json(JSON.parse(cached));
    }

    // Query events table
    const result = await pgPool.query(
      `SELECT id, contract, event_name, tx_hash, wallet, data, block_number, timestamp
             FROM events
             WHERE LOWER(wallet) = LOWER($1)
             ORDER BY timestamp DESC
             LIMIT $2 OFFSET $3`,
      [wallet, limitNum, offsetNum],
    );

    // Get total count for pagination
    const countResult = await pgPool.query(
      "SELECT COUNT(*) FROM events WHERE LOWER(wallet) = LOWER($1)",
      [wallet],
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);

    const events = result.rows.map((row) => ({
      id: row.id,
      type: formatEventType(row.event_name),
      contract: row.contract,
      eventName: row.event_name,
      txHash: row.tx_hash,
      txLink: row.tx_hash
        ? `https://testnet.snowtrace.io/tx/${row.tx_hash}`
        : null,
      wallet: row.wallet,
      data: row.data,
      blockNumber: Number(row.block_number),
      timestamp: row.timestamp,
    }));

    const response = {
      wallet,
      events,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < totalCount,
      },
    };

    await redisClient
      .setEx(cacheKey, CACHE_TTL, JSON.stringify(response))
      .catch(() => { });
    console.log(
      `[Portfolio] History for ${wallet.slice(0, 8)}… — ${events.length} events (total: ${totalCount})`,
    );

    res.json(response);
  } catch (err) {
    console.error("[Portfolio] History error:", err.message);
    res.status(500).json({ error: "Failed to fetch portfolio history" });
  }
});

// ─── Helpers ───────────────────────────────────────────────────────
function safeNumber(result, decimals) {
  if (!result || result.status === "failure") return 0;
  return Number(result.result) / 10 ** decimals;
}

function round(n, dp) {
  return Math.round(n * 10 ** dp) / 10 ** dp;
}

function formatEventType(eventName) {
  if (!eventName) return "Unknown";
  // "Deposited" → "Deposit", "Withdrawn" → "Withdraw", etc.
  const map = {
    Deposited: "Deposit",
    Withdrawn: "Withdraw",
    PoolFunded: "Pool Funded",
    Swap: "Swap",
    SwapExecuted: "Swap",
    OrderPlaced: "Order",
    OrderCancelled: "Cancel",
    OrdersMatched: "Trade",
    Staked: "Stake",
    Unstaked: "Unstake",
    Claimed: "Claim",
    KYCVerified: "KYC",
  };
  return map[eventName] || eventName;
}

module.exports = router;
