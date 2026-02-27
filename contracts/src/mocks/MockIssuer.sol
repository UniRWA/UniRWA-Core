// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IComplianceNFT.sol";
import "../interfaces/IChainlinkOracle.sol";
import "../interfaces/IRWAToken.sol";

/**
 * @title MockIssuer
 * @notice Simulates RWA token issuer (Securitize, Franklin Templeton, etc.)
 * @dev Handles both direct user purchases and pool purchases
 *
 * Real issuers:
 * - Securitize (BUIDL) - $50K minimum
 * - Franklin Templeton (BENJI) - $100K minimum
 * - Ondo (OUSG) - $25K minimum
 *
 * This mock:
 * - Allows any amount (for testing)
 * - Mints tokens instantly (vs T+1 settlement)
 * - Uses oracle NAV for pricing
 */
contract MockIssuer is Ownable {
    using SafeERC20 for IERC20;

    // USDC token (payment currency)
    IERC20 public immutable usdc;

    // Oracle for NAV prices
    IChainlinkOracle public immutable oracle;

    // ComplianceNFT for KYC checks
    IComplianceNFT public immutable complianceNFT;

    // Registered assets
    struct AssetInfo {
        address tokenAddress; // Mock RWA token address
        uint256 minimumPurchase; // Minimum USDC amount (6 decimals)
        bool registered;
    }

    mapping(string => AssetInfo) public assets;

    // Authorized pools (can call buyForPool)
    mapping(address => bool) public authorizedPools;

    // Events
    event AssetRegistered(
        string indexed symbol,
        address indexed token,
        uint256 minimum
    );
    event PoolAuthorized(address indexed pool);
    event Purchase(
        address indexed buyer,
        string indexed symbol,
        uint256 usdcAmount,
        uint256 tokensReceived
    );

    /**
     * @notice Initialize MockIssuer
     * @param usdc_ USDC token address
     * @param oracle_ MockOracle address
     * @param complianceNFT_ ComplianceNFT address
     */
    constructor(
        address usdc_,
        address oracle_,
        address complianceNFT_
    ) Ownable(msg.sender) {
        usdc = IERC20(usdc_);
        oracle = IChainlinkOracle(oracle_);
        complianceNFT = IComplianceNFT(complianceNFT_);
    }

    /**
     * @notice Register an RWA asset
     * @param symbol Token symbol (e.g., "BUIDL", "BENJI", "OUSG")
     * @param tokenAddress Mock RWA token address
     * @param minimum Minimum purchase amount in USDC (6 decimals)
     */
    function registerAsset(
        string memory symbol,
        address tokenAddress,
        uint256 minimum
    ) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token address");
        require(!assets[symbol].registered, "Asset already registered");

        assets[symbol] = AssetInfo({
            tokenAddress: tokenAddress,
            minimumPurchase: minimum,
            registered: true
        });

        emit AssetRegistered(symbol, tokenAddress, minimum);
    }

    /**
     * @notice Authorize a pool to call buyForPool()
     * @param pool Pool address
     * @dev CRITICAL: Must be called after pool deployment in DeployCore script
     */
    function authorizePool(address pool) external onlyOwner {
        require(pool != address(0), "Invalid pool address");
        authorizedPools[pool] = true;
        emit PoolAuthorized(pool);
    }

    /**
     * @notice Direct purchase by user (not used in MVP, but here for completeness)
     * @param symbol Token symbol to buy
     * @param usdcAmount USDC to spend (6 decimals)
     */
    function buy(string memory symbol, uint256 usdcAmount) external {
        // Verify KYC
        require(complianceNFT.isVerified(msg.sender), "KYC required");

        // Get asset info
        AssetInfo memory asset = assets[symbol];
        require(asset.registered, "Asset not registered");
        require(usdcAmount >= asset.minimumPurchase, "Below minimum purchase");

        // Execute purchase
        _executePurchase(symbol, usdcAmount, msg.sender);
    }

    /**
     * @notice Purchase for a pool (called by FractionalPool)
     * @param symbol Token symbol to buy
     * @param usdcAmount USDC to spend (6 decimals)
     * @dev msg.sender must be an authorized pool
     */
    function buyForPool(string memory symbol, uint256 usdcAmount) external {
        // Verify pool is authorized
        require(authorizedPools[msg.sender], "Not authorized pool");

        // Get asset info
        AssetInfo memory asset = assets[symbol];
        require(asset.registered, "Asset not registered");

        // Note: No minimum check for pools (they aggregate deposits)
        // Note: No KYC check (pools check KYC on deposits)

        // Execute purchase
        _executePurchase(symbol, usdcAmount, msg.sender);
    }

    /**
     * @notice Internal function to execute purchase
     * @param symbol Token symbol
     * @param usdcAmount USDC amount (6 decimals)
     * @param recipient Address to receive RWA tokens
     */
    function _executePurchase(
        string memory symbol,
        uint256 usdcAmount,
        address recipient
    ) internal {
        AssetInfo memory asset = assets[symbol];

        // 1. Pull USDC from buyer/pool
        usdc.safeTransferFrom(recipient, address(this), usdcAmount);

        // 2. Get current NAV from oracle (8 decimals)
        (, int256 nav, , , ) = oracle.getLatestRoundData(symbol);
        require(nav > 0, "Invalid NAV");

        // 3. Calculate RWA tokens to mint
        // USDC: 6 decimals
        // NAV: 8 decimals ($1.00 = 100000000)
        // RWA: 18 decimals
        // Formula: (usdcAmount * 1e18) / (nav * 1e6 / 1e8) = (usdcAmount * 1e20) / nav
        uint256 tokensToMint = (usdcAmount * 1e20) / uint256(nav);

        // 4. Mint RWA tokens to recipient
        IRWAToken rwaToken = IRWAToken(asset.tokenAddress);

        // Call mint() on the mock token (requires issuer to be owner or authorized)
        // Since we're using mocks, we'll need to handle this carefully
        // The mock tokens have an onlyOwner mint() function
        // So either: (a) issuer must own the tokens, or (b) tokens need mintTo() function

        // For now, we'll assume issuer owns the mock tokens (set in deployment script)
        // Cast to interface that has mint function
        (bool success, ) = address(rwaToken).call(
            abi.encodeWithSignature(
                "mint(address,uint256)",
                recipient,
                tokensToMint
            )
        );
        require(success, "Mint failed");

        emit Purchase(recipient, symbol, usdcAmount, tokensToMint);
    }

    // ====== Admin Proxy Functions ======
    // Since MockIssuer owns the mock tokens (after DeployCore transfers ownership),
    // these functions let the deployer (MockIssuer's owner) proxy onlyOwner calls.

    /**
     * @notice Whitelist an address on a mock RWA token (admin proxy)
     * @param token Mock RWA token address (e.g., MockBUIDL)
     * @param account Address to whitelist (e.g., AMM contract, deployer wallet)
     * @dev Routes through MockIssuer since it owns the mock tokens after DeployCore
     */
    function whitelistOnToken(address token, address account) external onlyOwner {
        (bool success, ) = token.call(
            abi.encodeWithSignature("whitelistAddress(address)", account)
        );
        require(success, "Whitelist call failed");
    }

    /**
     * @notice Mint mock RWA tokens (admin proxy)
     * @param token Mock RWA token address (e.g., MockBUIDL)
     * @param to Recipient address
     * @param amount Amount to mint (18 decimals for RWA tokens)
     * @dev Routes through MockIssuer since it owns the mock tokens after DeployCore
     */
    function mintToken(address token, address to, uint256 amount) external onlyOwner {
        (bool success, ) = token.call(
            abi.encodeWithSignature("mint(address,uint256)", to, amount)
        );
        require(success, "Mint call failed");
    }
}