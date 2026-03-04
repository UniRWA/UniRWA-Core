const express = require("express");
const { createPublicClient, http } = require("viem");
const { avalancheFuji } = require("viem/chains");
const redisClient = require("../db/redis");

const router = express.Router();

const CACHE_TTL = 10; // short TTL — orderbook changes frequently

const client = createPublicClient({
  chain: avalancheFuji,
  transport: http(
    process.env.FUJI_RPC || "https://api.avax-test.network/ext/bc/C/rpc",
  ),
});

// ─── Token address lookup ──────────────────────────────────────────
const TOKEN_MAP = {
  BUIDL: process.env.MOCK_BUIDL_ADDRESS,
  BENJI: process.env.MOCK_BENJI_ADDRESS,
  OUSG: process.env.MOCK_OUSG_ADDRESS,
};

const ORDERBOOK_ADDRESS = process.env.ORDERBOOK_ADDRESS;

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

// ─── Helper: format order for API response ─────────────────────────
function formatOrder(order) {
  return {
    id: Number(order.id),
    trader: order.trader,
    rwaToken: order.rwaToken,
    isBuy: order.isBuy,
    limitPrice: Number(order.limitPrice) / 1e6, // 6 decimals → human readable
    rawPrice: order.limitPrice.toString(),
    amount: order.isBuy
      ? Number(order.amount) / 1e6 // Buy amount is USDC (6 decimals)
      : Number(order.amount) / 1e18, // Sell amount is RWA (18 decimals)
    rawAmount: order.amount.toString(),
    filled: order.isBuy
      ? Number(order.filled) / 1e6
      : Number(order.filled) / 1e18,
    rawFilled: order.filled.toString(),
    timestamp: Number(order.timestamp),
    active: order.active,
  };
}

// ─── GET /api/orders ───────────────────────────────────────────────
// Query params:
//   token  (required) — BUIDL | BENJI | OUSG
//   wallet (optional) — filter by trader address
//   page   (optional) — page number, default 1
//   limit  (optional) — orders per page, default 20
router.get("/api/orders", async (req, res) => {
  try {
    const { token, wallet, page = "1", limit = "20" } = req.query;

    if (!token) {
      return res
        .status(400)
        .json({
          error: "Missing required query param: token (BUIDL | BENJI | OUSG)",
        });
    }

    const tokenAddress = TOKEN_MAP[token.toUpperCase()];
    if (!tokenAddress) {
      return res
        .status(400)
        .json({
          error: `Unknown token: ${token}. Supported: BUIDL, BENJI, OUSG`,
        });
    }

    if (!ORDERBOOK_ADDRESS) {
      return res
        .status(500)
        .json({ error: "ORDERBOOK_ADDRESS not configured" });
    }

    // ── Cache check (only for non-wallet-filtered requests) ──
    const cacheKey = wallet
      ? `orders:${token.toUpperCase()}:${wallet.toLowerCase()}`
      : `orders:${token.toUpperCase()}`;

    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) {
      console.log(`[Orders] Cache hit — ${cacheKey}`);
      return res.json(JSON.parse(cached));
    }

    // ── Fetch from chain ──
    const rawOrders = await client.readContract({
      address: ORDERBOOK_ADDRESS,
      abi: ORDERBOOK_ABI,
      functionName: "getActiveOrders",
      args: [tokenAddress],
    });

    let formattedOrders = (rawOrders || [])
      .filter((o) => o.active)
      .map(formatOrder);

    // ── Filter by wallet if provided ──
    if (wallet) {
      formattedOrders = formattedOrders.filter(
        (o) => o.trader.toLowerCase() === wallet.toLowerCase(),
      );
    }

    // ── Separate buys and sells, sort ──
    const buys = formattedOrders
      .filter((o) => o.isBuy)
      .sort((a, b) => b.limitPrice - a.limitPrice); // descending by price

    const sells = formattedOrders
      .filter((o) => !o.isBuy)
      .sort((a, b) => a.limitPrice - b.limitPrice); // ascending by price

    // ── Paginate ──
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const paginateSide = (orders) => {
      const start = (pageNum - 1) * limitNum;
      return orders.slice(start, start + limitNum);
    };

    const response = {
      token: token.toUpperCase(),
      buys: paginateSide(buys),
      sells: paginateSide(sells),
      totalBuys: buys.length,
      totalSells: sells.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
      },
    };

    // ── Cache result ──
    await redisClient
      .setEx(cacheKey, CACHE_TTL, JSON.stringify(response))
      .catch(() => { });
    console.log(
      `[Orders] Fetched ${buys.length} buys + ${sells.length} sells for ${token.toUpperCase()}, cached ${CACHE_TTL}s`,
    );

    res.json(response);
  } catch (err) {
    console.error("[Orders] Error fetching orders:", err.message);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});


const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS;

const ROUTER_ABI = [
  {
    name: "getBestRoute",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "rwaToken", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "isSell", type: "bool" },
    ],
    outputs: [
      { name: "route", type: "uint8" },
      { name: "expectedOut", type: "uint256" },
    ],
  },
];

const ROUTE_NAMES = { 0: "AMM", 1: "ORDERBOOK" };


router.get("/api/market/quote", async (req, res) => {
  try {
    const { token, amount, sell } = req.query;

    if (!token || !amount) {
      return res
        .status(400)
        .json({ error: "Missing required params: token and amount" });
    }

    const tokenAddress = TOKEN_MAP[token.toUpperCase()];
    if (!tokenAddress) {
      return res
        .status(400)
        .json({ error: `Unknown token: ${token}. Supported: BUIDL, BENJI, OUSG` });
    }

    if (!ROUTER_ADDRESS) {
      return res.status(500).json({ error: "ROUTER_ADDRESS not configured" });
    }

    const isSell = sell === "true";
    const amountRaw = isSell
      ? BigInt(Math.floor(parseFloat(amount) * 1e18))
      : BigInt(Math.floor(parseFloat(amount) * 1e6));

    const result = await client.readContract({
      address: ROUTER_ADDRESS,
      abi: ROUTER_ABI,
      functionName: "getBestRoute",
      args: [tokenAddress, amountRaw, isSell],
    });

    const [routeEnum, expectedOut] = result;
    const routeName = ROUTE_NAMES[Number(routeEnum)] || "AMM";
    const expectedOutHuman = isSell
      ? Number(expectedOut) / 1e6
      : Number(expectedOut) / 1e18;

    res.json({
      token: token.toUpperCase(),
      route: routeName,
      expectedOut: expectedOutHuman,
      rawExpectedOut: expectedOut.toString(),
      isSell,
      inputAmount: parseFloat(amount),
    });
  } catch (err) {
    console.error("[Quote] Error fetching quote:", err.message);
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});


const dbPool = require("../db/pool");

let referralTableReady = false;

async function ensureReferralTable() {
  if (referralTableReady) return;
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS referral_clicks (
        id SERIAL PRIMARY KEY,
        wallet VARCHAR(42),
        asset VARCHAR(20),
        issuer_url TEXT,
        clicked_at TIMESTAMP DEFAULT NOW()
      )
    `);
    referralTableReady = true;
  } catch (err) {
    console.warn("[Referral] Could not create table:", err.message);
  }
}

router.post("/api/referral/track", async (req, res) => {
  try {
    await ensureReferralTable();

    const { wallet, asset, issuerUrl } = req.body;

    if (!wallet || !asset) {
      return res
        .status(400)
        .json({ error: "Missing required fields: wallet and asset" });
    }

    await dbPool.query(
      `INSERT INTO referral_clicks (wallet, asset, issuer_url) VALUES ($1, $2, $3)`,
      [wallet, asset.toUpperCase(), issuerUrl || null]
    );

    console.log(`[Referral] Tracked click: ${wallet} → ${asset}`);
    res.json({ tracked: true });
  } catch (err) {
    console.error("[Referral] Error tracking:", err.message);
    res.status(500).json({ error: "Failed to track referral" });
  }
});

module.exports = router;
