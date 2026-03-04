require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const assetRoutes = require("./routes/assets");
const poolRoutes = require("./routes/pools");
const kycRoutes = require("./routes/kyc");
const marketRoutes = require("./routes/market");
const portfolioRoutes = require("./routes/portfolio");
const { startCron } = require("./services/aggregatorService");
const keeperBot = require("./services/keeperBot");
const yieldSimulator = require("./services/yieldSimulator");

const app = express();
const PORT = process.env.PORT || 3001;

// middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
  }),
);
app.use(morgan("dev"));
app.use(express.json());

// rate limiting on API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, try again in 15 minutes" },
});
app.use("/api", apiLimiter);

// routes
app.use("/", assetRoutes);
app.use("/", poolRoutes);
app.use("/", kycRoutes);
app.use("/", marketRoutes);
app.use("/", portfolioRoutes);

// start background services
startCron();
keeperBot.start();
yieldSimulator.start();

// start server
app.listen(PORT, () => {
  console.log(`\n🚀 UniRWA Backend running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Assets: http://localhost:${PORT}/api/assets`);
  console.log(`   Pools:  http://localhost:${PORT}/api/pools`);
  console.log(`   Orders: http://localhost:${PORT}/api/orders?token=BUIDL`);
  console.log(`   Portfolio: http://localhost:${PORT}/api/portfolio?wallet=0x...`);
  console.log(`   Quote:  http://localhost:${PORT}/api/market/quote?token=BUIDL&amount=1000`);
  console.log(`   KYC:    http://localhost:${PORT}/api/kyc/status\n`);
});
