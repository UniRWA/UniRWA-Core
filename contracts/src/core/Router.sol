// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./HybridAMM.sol";

/**
 * @title Router
 * @notice Routes trades to either AMM or Orderbook for best execution
 * @dev For trades >$10K, checks orderbook liquidity and routes to better price
 * 
 * Current routing logic:
 * - Trades ≤$10K → Always AMM
 * - Trades >$10K → Orderbook if it has liquidity and better price, else AMM
 */
contract Router is Ownable {
    using SafeERC20 for IERC20;
    
    // Route types
    enum Route { AMM, ORDERBOOK }
    
    // Connected contracts
    HybridAMM public immutable amm;
    address public orderbook; // Will be set when Orderbook deployed (Day 7)
    
    // Threshold for considering orderbook routing
    uint256 public constant LARGE_TRADE_THRESHOLD = 10_000e6; // $10K USDC
    
    // Events
    event SwapExecuted(
        address indexed user,
        Route indexed route,
        address indexed rwaToken,
        uint256 amountIn,
        uint256 amountOut
    );
    
    event OrderbookSet(address indexed orderbook);
    
    /**
     * @notice Initialize Router
     * @param amm_ HybridAMM address
     */
    constructor(address amm_) Ownable(msg.sender) {
        require(amm_ != address(0), "Invalid AMM address");
        amm = HybridAMM(amm_);
    }
    
    /**
     * @notice Set orderbook address (Day 7)
     * @param orderbook_ Orderbook contract address
     */
    function setOrderbook(address orderbook_) external onlyOwner {
        require(orderbook_ != address(0), "Invalid orderbook address");
        orderbook = orderbook_;
        emit OrderbookSet(orderbook_);
    }
    
    /**
     * @notice Get best route and expected output for a trade
     * @param rwaToken RWA token address
     * @param amount Amount to trade (in input token decimals)
     * @param isSell True if selling RWA for USDC, false if buying RWA with USDC
     * @return route Best route (AMM or ORDERBOOK)
     * @return expectedOut Expected output amount
     */
    function getBestRoute(
        address rwaToken,
        uint256 amount,
        bool isSell
    ) external view returns (Route route, uint256 expectedOut) {
        // Get AMM quote
        uint256 ammQuote = amm.getAmountOut(rwaToken, amount, isSell);
        
        // Check if trade is large enough to consider orderbook
        // Convert to USDC terms for threshold check
        uint256 usdcValue = isSell ? ammQuote : amount;
        
        if (usdcValue <= LARGE_TRADE_THRESHOLD || orderbook == address(0)) {
            // Small trade or no orderbook → always use AMM
            return (Route.AMM, ammQuote);
        }
        
        // Large trade → check orderbook
        // getBestFillPrice(address token, uint256 amount, bool isBuy) returns uint256
        // This is a stub until Day 7 - orderbook will return 0 for now
        (bool success, bytes memory data) = orderbook.staticcall(
            abi.encodeWithSignature(
                "getBestFillPrice(address,uint256,bool)",
                rwaToken,
                amount,
                !isSell // Orderbook uses isBuy (opposite of isSell)
            )
        );
        
        if (success && data.length > 0) {
            uint256 orderbookQuote = abi.decode(data, (uint256));
            
            if (orderbookQuote > ammQuote) {
                // Orderbook is better
                return (Route.ORDERBOOK, orderbookQuote);
            }
        }
        
        // Default to AMM
        return (Route.AMM, ammQuote);
    }
    
    /**
     * @notice Execute a swap via best route
     * @param rwaToken RWA token address
     * @param amount Amount to trade (input token)
     * @param isSell True if selling RWA for USDC
     * @param minOut Minimum output amount (slippage protection)
     * @return actualOut Actual output received
     */
    function executeSwap(
        address rwaToken,
        uint256 amount,
        bool isSell,
        uint256 minOut
    ) external returns (uint256 actualOut) {
        require(amount > 0, "Amount must be positive");
        
        // Determine best route
        (Route route, uint256 expectedOut) = this.getBestRoute(rwaToken, amount, isSell);
        
        // Pull input tokens from user
        address inputToken = isSell ? rwaToken : address(amm.usdc());
        IERC20(inputToken).safeTransferFrom(msg.sender, address(this), amount);
        
        if (route == Route.AMM) {
            // Route through AMM
            // Approve AMM to spend tokens
            IERC20(inputToken).safeIncreaseAllowance(address(amm), amount);
            
            // Execute swap
            actualOut = amm.swap(rwaToken, amount, isSell);
            
            // Transfer output to user
            address outputToken = isSell ? address(amm.usdc()) : rwaToken;
            IERC20(outputToken).safeTransfer(msg.sender, actualOut);
            
        } else {
            // Route through orderbook (Day 7)
            // For now, revert since orderbook isn't deployed yet
            revert("Orderbook not yet deployed");
        }
        
        // Slippage check
        require(actualOut >= minOut, "Slippage exceeded");
        
        emit SwapExecuted(msg.sender, route, rwaToken, amount, actualOut);
        
        return actualOut;
    }
    
    /**
     * @notice Get router info for frontend
     */
    function getRouterInfo() external view returns (
        address ammAddress,
        address orderbookAddress,
        uint256 largeTradeThreshold
    ) {
        return (
            address(amm),
            orderbook,
            LARGE_TRADE_THRESHOLD
        );
    }
}