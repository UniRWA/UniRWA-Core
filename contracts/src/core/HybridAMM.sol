// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IChainlinkOracle.sol";

/**
 * @title HybridAMM
 * @notice Uniswap V2-style constant product AMM with oracle price band
 * @dev Key features:
 * - Constant product (x * y = k) for price discovery
 * - Oracle NAV as price guardrail (±5% tolerance)
 * - Fee-on-input (0.3% applied BEFORE swap math)
 * - 80/20 fee split (80% to LPs, 20% to treasury)
 * 
 * CRITICAL DIFFERENCES FROM UNISWAP V2:
 * 1. Fee applied BEFORE swap (amountInWithFee = amountIn * 997/1000)
 * 2. Oracle check prevents manipulation (rejects if >5% deviation)
 * 3. Treasury fees tracked separately (not auto-transferred)
 */
contract HybridAMM is Ownable {
    using SafeERC20 for IERC20;
    
    // USDC token (quote currency)
    IERC20 public immutable usdc;
    
    // Oracle for NAV price checks
    IChainlinkOracle public immutable oracle;
    
    // Reserves per RWA token
    mapping(address => uint256) public reservesRWA;    // RWA token reserves (18 decimals)
    mapping(address => uint256) public reservesUSDC;   // USDC reserves (6 decimals)
    
    // LP tokens (simple mapping, not ERC20 for MVP)
    mapping(address => uint256) public lpSupply;       // Total LP tokens per pool
    mapping(address => mapping(address => uint256)) public lpBalances; // user => token => LP amount
    
    // Treasury fees (claimable by owner)
    mapping(address => uint256) public treasuryFeesRWA;  // Accumulated RWA fees
    mapping(address => uint256) public treasuryFeesUSDC; // Accumulated USDC fees
    
    // Constants
    uint256 private constant FEE_DENOMINATOR = 1000;
    uint256 private constant FEE_NUMERATOR = 997;     // 0.3% fee = 3/1000
    uint256 private constant LP_FEE_PERCENT = 80;     // 80% to LPs
    uint256 private constant TREASURY_FEE_PERCENT = 20; // 20% to treasury
    uint256 private constant ORACLE_TOLERANCE = 5;    // 5% max deviation from oracle
    
    // Events
    event LiquidityAdded(
        address indexed provider,
        address indexed token,
        uint256 usdcAmount,
        uint256 rwaAmount,
        uint256 lpMinted
    );
    event LiquidityRemoved(
        address indexed provider,
        address indexed token,
        uint256 lpBurned,
        uint256 usdcReturned,
        uint256 rwaReturned
    );
    event Swap(
        address indexed trader,
        address indexed token,
        bool isSell,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeAmount
    );
    event TreasuryFeesWithdrawn(address indexed token, uint256 rwaAmount, uint256 usdcAmount);
    
    /**
     * @notice Initialize HybridAMM
     * @param usdc_ USDC token address
     * @param oracle_ MockOracle address (Chainlink-compatible)
     */
    constructor(address usdc_, address oracle_) Ownable(msg.sender) {
        require(usdc_ != address(0), "Invalid USDC address");
        require(oracle_ != address(0), "Invalid oracle address");
        
        usdc = IERC20(usdc_);
        oracle = IChainlinkOracle(oracle_);
    }
    
    /**
     * @notice Add liquidity to a pool
     * @param rwaToken RWA token address (BUIDL, BENJI, OUSG)
     * @param usdcAmount USDC to deposit (6 decimals)
     * @param rwaAmount RWA tokens to deposit (18 decimals)
     * @return lpMinted Amount of LP tokens minted
     */
    function addLiquidity(
        address rwaToken,
        uint256 usdcAmount,
        uint256 rwaAmount
    ) external returns (uint256 lpMinted) {
        require(usdcAmount > 0 && rwaAmount > 0, "Amounts must be positive");
        
        // Transfer tokens from user
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        IERC20(rwaToken).safeTransferFrom(msg.sender, address(this), rwaAmount);
        
        // Calculate LP tokens to mint
        if (lpSupply[rwaToken] == 0) {
            // First liquidity provider: LP = sqrt(usdcAmount * rwaAmount)
            // Normalize decimals: USDC has 6, RWA has 18, so multiply USDC by 1e12
            lpMinted = _sqrt(usdcAmount * 1e12 * rwaAmount);
            require(lpMinted > 0, "Insufficient liquidity");
        } else {
            // Subsequent providers: LP proportional to existing ratio
            // LP = min(usdcAmount * lpSupply / usdcReserve, rwaAmount * lpSupply / rwaReserve)
            uint256 lpFromUSDC = (usdcAmount * lpSupply[rwaToken]) / reservesUSDC[rwaToken];
            uint256 lpFromRWA = (rwaAmount * lpSupply[rwaToken]) / reservesRWA[rwaToken];
            lpMinted = lpFromUSDC < lpFromRWA ? lpFromUSDC : lpFromRWA;
            require(lpMinted > 0, "Insufficient liquidity minted");
        }
        
        // Update state
        reservesUSDC[rwaToken] += usdcAmount;
        reservesRWA[rwaToken] += rwaAmount;
        lpSupply[rwaToken] += lpMinted;
        lpBalances[msg.sender][rwaToken] += lpMinted;
        
        emit LiquidityAdded(msg.sender, rwaToken, usdcAmount, rwaAmount, lpMinted);
        
        return lpMinted;
    }
    
    /**
     * @notice Remove liquidity from a pool
     * @param rwaToken RWA token address
     * @param lpAmount LP tokens to burn
     * @return usdcReturned USDC returned to user
     * @return rwaReturned RWA tokens returned to user
     */
    function removeLiquidity(
        address rwaToken,
        uint256 lpAmount
    ) external returns (uint256 usdcReturned, uint256 rwaReturned) {
        require(lpAmount > 0, "LP amount must be positive");
        require(lpBalances[msg.sender][rwaToken] >= lpAmount, "Insufficient LP balance");
        
        // Calculate proportional share
        usdcReturned = (lpAmount * reservesUSDC[rwaToken]) / lpSupply[rwaToken];
        rwaReturned = (lpAmount * reservesRWA[rwaToken]) / lpSupply[rwaToken];
        
        require(usdcReturned > 0 && rwaReturned > 0, "Insufficient liquidity");
        
        // Update state
        lpBalances[msg.sender][rwaToken] -= lpAmount;
        lpSupply[rwaToken] -= lpAmount;
        reservesUSDC[rwaToken] -= usdcReturned;
        reservesRWA[rwaToken] -= rwaReturned;
        
        // Transfer tokens to user
        usdc.safeTransfer(msg.sender, usdcReturned);
        IERC20(rwaToken).safeTransfer(msg.sender, rwaReturned);
        
        emit LiquidityRemoved(msg.sender, rwaToken, lpAmount, usdcReturned, rwaReturned);
        
        return (usdcReturned, rwaReturned);
    }
    
    /**
     * @notice Swap tokens
     * @param rwaToken RWA token address
     * @param amountIn Amount to swap in
     * @param isSell True if selling RWA for USDC, false if buying RWA with USDC
     * @return amountOut Amount received
     * 
     * CRITICAL: Fee applied BEFORE swap calculation
     * Formula: amountInWithFee = amountIn * 997 / 1000
     * Then: amountOut = (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee)
     */
    function swap(
        address rwaToken,
        uint256 amountIn,
        bool isSell
    ) external returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be positive");
        require(reservesUSDC[rwaToken] > 0 && reservesRWA[rwaToken] > 0, "Pool not initialized");
        
        // 1. Calculate fee and amount with fee
        uint256 feeAmount = (amountIn * (FEE_DENOMINATOR - FEE_NUMERATOR)) / FEE_DENOMINATOR;
        uint256 amountInWithFee = amountIn - feeAmount;
        
        // 2. Get reserves
        uint256 reserveIn;
        uint256 reserveOut;
        
        if (isSell) {
            // Selling RWA for USDC
            reserveIn = reservesRWA[rwaToken];
            reserveOut = reservesUSDC[rwaToken];
        } else {
            // Buying RWA with USDC
            reserveIn = reservesUSDC[rwaToken];
            reserveOut = reservesRWA[rwaToken];
        }
        
        // 3. Calculate output using constant product (x * y = k)
        amountOut = (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
        require(amountOut > 0, "Insufficient output amount");
        
        // 4. Oracle sanity check (±5% tolerance)
        _checkOraclePrice(rwaToken, amountIn, amountOut, isSell);
        
        // 5. Split fee: 80% to LPs (stays in reserves), 20% to treasury
        uint256 lpFee = (feeAmount * LP_FEE_PERCENT) / 100;
        uint256 treasuryFee = feeAmount - lpFee;
        
        // 6. Transfer tokens
        if (isSell) {
            // User sends RWA, receives USDC
            IERC20(rwaToken).safeTransferFrom(msg.sender, address(this), amountIn);
            usdc.safeTransfer(msg.sender, amountOut);
            
            // Update reserves (LP fee stays in reserve)
            reservesRWA[rwaToken] += amountIn - treasuryFee;
            reservesUSDC[rwaToken] -= amountOut;
            treasuryFeesRWA[rwaToken] += treasuryFee;
        } else {
            // User sends USDC, receives RWA
            usdc.safeTransferFrom(msg.sender, address(this), amountIn);
            IERC20(rwaToken).safeTransfer(msg.sender, amountOut);
            
            // Update reserves (LP fee stays in reserve)
            reservesUSDC[rwaToken] += amountIn - treasuryFee;
            reservesRWA[rwaToken] -= amountOut;
            treasuryFeesUSDC[rwaToken] += treasuryFee;
        }
        
        emit Swap(msg.sender, rwaToken, isSell, amountIn, amountOut, feeAmount);
        
        return amountOut;
    }
    
    /**
     * @notice Get quote for a swap (view function)
     * @param rwaToken RWA token address
     * @param amountIn Amount to swap in
     * @param isSell True if selling RWA for USDC
     * @return amountOut Estimated amount out
     */
    function getAmountOut(
        address rwaToken,
        uint256 amountIn,
        bool isSell
    ) external view returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be positive");
        require(reservesUSDC[rwaToken] > 0 && reservesRWA[rwaToken] > 0, "Pool not initialized");
        
        // Apply fee
        uint256 amountInWithFee = (amountIn * FEE_NUMERATOR) / FEE_DENOMINATOR;
        
        // Get reserves
        uint256 reserveIn = isSell ? reservesRWA[rwaToken] : reservesUSDC[rwaToken];
        uint256 reserveOut = isSell ? reservesUSDC[rwaToken] : reservesRWA[rwaToken];
        
        // Calculate output
        amountOut = (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
        
        return amountOut;
    }
    
    /**
     * @notice Check if AMM price is within oracle tolerance
     * @dev Rejects swap if AMM price deviates >5% from oracle NAV
     * 
     * CRITICAL: Oracle is guardrail, NOT pricing engine
     * We allow ±5% deviation for normal market dynamics
     */
    function _checkOraclePrice(
        address rwaToken,
        uint256 amountIn,
        uint256 amountOut,
        bool isSell
    ) internal view {
        // Get oracle NAV (8 decimals, e.g., 100000000 = $1.00)
        (, int256 nav,,,) = oracle.latestRoundData();
        require(nav > 0, "Invalid oracle price");
        
        // Calculate expected output at oracle NAV
        uint256 expectedOut;
        
        if (isSell) {
            // Selling RWA for USDC
            // RWA is 18 decimals, USDC is 6 decimals, NAV is 8 decimals
            // expectedOut = (amountIn * nav) / 1e20 (converts 18+8 decimals to 6)
            expectedOut = (amountIn * uint256(nav)) / 1e20;
        } else {
            // Buying RWA with USDC
            // expectedOut = (amountIn * 1e20) / nav (converts 6 decimals to 18)
            expectedOut = (amountIn * 1e20) / uint256(nav);
        }
        
        // Check if AMM output is within ±5% of oracle price
        uint256 minAcceptable = (expectedOut * (100 - ORACLE_TOLERANCE)) / 100;
        uint256 maxAcceptable = (expectedOut * (100 + ORACLE_TOLERANCE)) / 100;
        
        require(
            amountOut >= minAcceptable && amountOut <= maxAcceptable,
            "AMM price deviation exceeds 5% tolerance"
        );
    }
    
    /**
     * @notice Withdraw accumulated treasury fees
     * @param rwaToken RWA token address
     */
    function withdrawTreasuryFees(address rwaToken) external onlyOwner {
        uint256 rwaFees = treasuryFeesRWA[rwaToken];
        uint256 usdcFees = treasuryFeesUSDC[rwaToken];
        
        require(rwaFees > 0 || usdcFees > 0, "No fees to withdraw");
        
        // Reset fees
        treasuryFeesRWA[rwaToken] = 0;
        treasuryFeesUSDC[rwaToken] = 0;
        
        // Transfer fees to owner
        if (rwaFees > 0) {
            IERC20(rwaToken).safeTransfer(msg.sender, rwaFees);
        }
        if (usdcFees > 0) {
            usdc.safeTransfer(msg.sender, usdcFees);
        }
        
        emit TreasuryFeesWithdrawn(rwaToken, rwaFees, usdcFees);
    }
    
    /**
     * @notice Get pool info for frontend
     */
    function getPoolInfo(address rwaToken) external view returns (
        uint256 rwaReserve,
        uint256 usdcReserve,
        uint256 totalLP,
        uint256 rwaFees,
        uint256 usdcFees
    ) {
        return (
            reservesRWA[rwaToken],
            reservesUSDC[rwaToken],
            lpSupply[rwaToken],
            treasuryFeesRWA[rwaToken],
            treasuryFeesUSDC[rwaToken]
        );
    }
    
    /**
     * @notice Square root function (Babylonian method)
     * @dev Used for initial LP token calculation
     */
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}