// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IComplianceNFT.sol";
import "../interfaces/IMockIssuer.sol";
import "../interfaces/IsBUIDL.sol";

interface IRouter {
    function executeSwap(
        address rwaToken,
        uint256 amount,
        bool isSell,
        uint256 minOut
    ) external returns (uint256 actualOut);
}

/**
 * @title FractionalPool
 * @notice ERC-4626 vault for fractional RWA ownership
 * @dev Pools USDC deposits, auto-executes RWA purchase at threshold
 * 
 * Key features:
 * - KYC gating via ComplianceNFT
 * - Minimum deposit requirement ($1,000 default)
 * - Auto-execution when threshold reached
 * - NAV-based share valuation after funding
 */
contract FractionalPool is ERC4626 {
    using SafeERC20 for IERC20;
    
    // Pool configuration
    string public assetSymbol;           // RWA token symbol (e.g., "BUIDL")
    uint256 public threshold;            // Target amount to trigger purchase
    uint256 public minDeposit;           // Minimum deposit per user
    
    // Pool state
    bool public poolFunded;              // True after RWA purchase executed
    uint256 public totalDeposited;       // Total USDC deposited
    
    // External contracts
    IComplianceNFT public immutable complianceNFT;
    IMockIssuer public immutable issuer;
    IsBUIDL public rwaToken;             // Set after purchase
    IRouter public router;               // Set after Router deployed
    
    // Events
    event PoolFunded(uint256 usdcSpent, uint256 rwaReceived, uint256 timestamp);
    event Deposited(address indexed user, uint256 assets, uint256 shares);
    event Withdrawn(address indexed user, uint256 shares, uint256 assets);
    event RouterSet(address indexed router);
    
    /**
     * @notice Initialize the fractional pool
     * @param asset_ USDC token address (6 decimals)
     * @param assetSymbol_ RWA symbol to purchase (e.g., "BUIDL")
     * @param threshold_ Target USDC amount to trigger purchase (e.g., 50_000e6 = $50K)
     * @param minDeposit_ Minimum deposit per user (e.g., 1_000e6 = $1K)
     * @param complianceNFT_ ComplianceNFT contract for KYC checks
     * @param issuer_ MockIssuer contract for purchasing RWAs
     */
    constructor(
        address asset_,
        string memory assetSymbol_,
        uint256 threshold_,
        uint256 minDeposit_,
        address complianceNFT_,
        address issuer_
    ) ERC4626(IERC20(asset_)) ERC20(
        string(abi.encodePacked("Fractional ", assetSymbol_)),
        string(abi.encodePacked("f", assetSymbol_))
    ) {
        require(threshold_ > 0, "Threshold must be positive");
        require(minDeposit_ > 0, "MinDeposit must be positive");
        require(minDeposit_ <= threshold_, "MinDeposit exceeds threshold");
        
        assetSymbol = assetSymbol_;
        threshold = threshold_;
        minDeposit = minDeposit_;
        complianceNFT = IComplianceNFT(complianceNFT_);
        issuer = IMockIssuer(issuer_);
    }
    
    /**
     * @notice Deposit USDC into pool (override ERC4626)
     * @dev Requires KYC, minimum deposit, and pool not yet funded
     * Auto-executes purchase if threshold reached
     */
    function deposit(uint256 assets, address receiver) 
        public 
        virtual 
        override 
        returns (uint256 shares) 
    {
        // 1. KYC check - CRITICAL for regulatory compliance
        require(complianceNFT.isVerified(msg.sender), "KYC required: complete verification first");
        
        // 2. Minimum deposit check
        require(assets >= minDeposit, "Below minimum deposit");
        
        // 3. Pool must not be funded yet (can't deposit after purchase)
        require(!poolFunded, "Pool already funded - use secondary market");
        
        // 4. Execute standard ERC4626 deposit (mints shares)
        shares = super.deposit(assets, receiver);
        
        // 5. Track total deposited
        totalDeposited += assets;
        
        emit Deposited(receiver, assets, shares);
        
        // 6. Auto-execute purchase if threshold reached
        if (totalDeposited >= threshold && !poolFunded) {
            _executePurchase();
        }
        
        return shares;
    }
    
    /**
     * @notice Execute RWA purchase from issuer
     * @dev Internal function called when threshold is reached
     * 
     * CRITICAL: Pool must be whitelisted on MockBUIDL/BENJI/OUSG first!
     * Add whitelisting step to deployment script (DeployCore.s.sol)
     */
    function _executePurchase() internal {
        // 1. Get USDC balance
        uint256 usdcBalance = IERC20(asset()).balanceOf(address(this));
        require(usdcBalance > 0, "No USDC to spend");
        
        // 2. Approve issuer to spend USDC
        IERC20(asset()).safeIncreaseAllowance(address(issuer), usdcBalance);
        
        // 3. Call issuer to buy RWA tokens
        // Issuer will transfer RWA tokens to this pool
        issuer.buyForPool(assetSymbol, usdcBalance);
        
        // 4. Update pool state
        poolFunded = true;
        
        // 5. Store RWA token address (get from issuer or hardcode mapping)
        // For now, we'll set it via a separate setter function
        // This will be improved in Day 4 when we deploy MockIssuer
        
        emit PoolFunded(usdcBalance, 0, block.timestamp); // RWA amount TBD
    }
    
    /**
     * @notice Set RWA token address after purchase
     * @dev Called by pool owner after purchase completes
     * TODO: Remove this and get address from issuer directly
     */
    function setRWAToken(address rwaToken_) external {
        require(poolFunded, "Pool not funded yet");
        require(address(rwaToken) == address(0), "RWA token already set");
        rwaToken = IsBUIDL(rwaToken_);
    }
    
    /**
     * @notice Set Router address for post-funding withdrawals
     * @param router_ Router contract address
     */
    function setRouter(address router_) external {
        require(router_ != address(0), "Invalid router address");
        router = IRouter(router_);
        emit RouterSet(router_);
    }
    
    /**
     * @notice Withdraw from pool (override ERC4626)
     * @dev Burns shares, returns USDC
     * If pool funded: sells RWA on AMM first (stub for now)
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual override returns (uint256 shares) {
        require(complianceNFT.isVerified(msg.sender), "KYC required");
        
        if (!poolFunded) {
            // Pool not funded yet - just return USDC
            shares = super.withdraw(assets, receiver, owner);
        } else {
            // Pool is funded - sell RWA on AMM via Router
            require(address(router) != address(0), "Router not set");
            require(address(rwaToken) != address(0), "RWA token not set");
            
            // Calculate how many shares correspond to the requested USDC amount
            shares = previewWithdraw(assets);
            require(shares > 0, "Zero shares");
            
            // Check owner allowance if not self
            if (msg.sender != owner) {
                uint256 allowed = allowance(owner, msg.sender);
                require(allowed >= shares, "ERC4626: withdraw exceeds allowance");
                _approve(owner, msg.sender, allowed - shares);
            }
            
            // Burn shares
            _burn(owner, shares);
            
            // Calculate how much RWA to sell (proportional to shares burned)
            uint256 totalRWA = IERC20(address(rwaToken)).balanceOf(address(this));
            uint256 rwaToSell = (totalRWA * shares) / (totalSupply() + shares); // +shares since we already burned
            
            // Approve Router to spend RWA tokens
            IERC20(address(rwaToken)).safeIncreaseAllowance(address(router), rwaToSell);
            
            // Sell RWA → USDC via Router (isSell = true)
            // minOut = assets * 95 / 100 → 5% slippage tolerance
            uint256 minOut = (assets * 95) / 100;
            uint256 usdcReceived = router.executeSwap(
                address(rwaToken),
                rwaToSell,
                true,  // isSell
                minOut
            );
            
            // Transfer USDC to receiver
            IERC20(asset()).safeTransfer(receiver, usdcReceived);
        }
        
        emit Withdrawn(owner, shares, assets);
        return shares;
    }
    
    /**
     * @notice Calculate total pool value (override ERC4626)
     * @dev Before funding: USDC balance
     *      After funding: RWA balance × NAV
     * 
     * CRITICAL: This is the heart of ERC-4626 pricing!
     * Share value = totalAssets() / totalSupply()
     */
    function totalAssets() public view virtual override returns (uint256) {
        if (!poolFunded) {
            // Pre-funding: just USDC balance
            return IERC20(asset()).balanceOf(address(this));
        } else {
            // Post-funding: RWA value in USDC terms
            if (address(rwaToken) == address(0)) {
                // RWA token not set yet (happens briefly after purchase)
                return IERC20(asset()).balanceOf(address(this));
            }
            
            // Get RWA balance
            uint256 rwaBalance = IERC20(address(rwaToken)).balanceOf(address(this));
            
            // Get current NAV (price per RWA token in 18 decimals)
            uint256 nav = rwaToken.getCurrentNAV();
            
            // Calculate value: (rwaBalance × NAV) / 1e18
            // RWA tokens are 18 decimals, NAV is 18 decimals, USDC is 6 decimals
            // So we need: (balance * nav) / 1e18 / 1e12
            return (rwaBalance * nav) / 1e30; // Converts to 6 decimals (USDC)
        }
    }
    
    /**
     * @notice Get pool info for frontend
     */
    function getPoolInfo() external view returns (
        string memory symbol,
        uint256 target,
        uint256 deposited,
        uint256 minDep,
        bool funded,
        uint256 progress
    ) {
        return (
            assetSymbol,
            threshold,
            totalDeposited,
            minDeposit,
            poolFunded,
            totalDeposited * 100 / threshold // Progress percentage
        );
    }
}