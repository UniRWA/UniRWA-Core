// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IComplianceNFT.sol";

/**
 * @title Orderbook
 * @notice Limit order book for RWA token trading
 * @dev Orders are matched off-chain by a keeper bot, settled on-chain
 * 
 * Key features:
 * - KYC-gated order placement
 * - Limit price orders (buy/sell)
 * - Keeper-based matching (prevents front-running)
 * - Locked collateral (USDC for buys, RWA for sells)
 */
contract Orderbook is Ownable {
    using SafeERC20 for IERC20;
    
    // Order structure
    struct Order {
        uint256 id;
        address trader;
        address rwaToken;
        bool isBuy;
        uint256 limitPrice;      // Price in USDC per RWA token (6 decimals)
        uint256 amount;          // USDC amount for buy, RWA amount for sell
        uint256 filled;          // Amount filled so far
        uint256 timestamp;
        bool active;
    }
    
    // State
    mapping(uint256 => Order) public orders;
    uint256[] public activeOrderIds;
    uint256 private _nextOrderId;
    
    // Access control
    address public keeper;
    IComplianceNFT public immutable complianceNFT;
    IERC20 public immutable usdc;
    
    // Events
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed trader,
        address indexed rwaToken,
        bool isBuy,
        uint256 limitPrice,
        uint256 amount
    );
    
    event OrderCancelled(
        uint256 indexed orderId,
        address indexed trader
    );
    
    event OrdersMatched(
        uint256 indexed buyId,
        uint256 indexed sellId,
        uint256 fillAmount,
        uint256 fillPrice
    );
    
    event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);
    
    /**
     * @notice Initialize Orderbook
     * @param usdc_ USDC token address
     * @param complianceNFT_ ComplianceNFT address
     * @param keeper_ Keeper wallet address (can match orders)
     */
    constructor(
        address usdc_,
        address complianceNFT_,
        address keeper_
    ) Ownable(msg.sender) {
        require(usdc_ != address(0), "Invalid USDC address");
        require(complianceNFT_ != address(0), "Invalid ComplianceNFT address");
        require(keeper_ != address(0), "Invalid keeper address");
        
        usdc = IERC20(usdc_);
        complianceNFT = IComplianceNFT(complianceNFT_);
        keeper = keeper_;
        _nextOrderId = 1;
    }
    
    /**
     * @notice Update keeper address
     * @param newKeeper New keeper address
     */
    function setKeeper(address newKeeper) external onlyOwner {
        require(newKeeper != address(0), "Invalid keeper address");
        emit KeeperUpdated(keeper, newKeeper);
        keeper = newKeeper;
    }
    
    /**
     * @notice Place a buy order (buy RWA with USDC)
     * @param rwaToken RWA token address
     * @param limitPrice Maximum price willing to pay (USDC per RWA, 6 decimals)
     * @param usdcAmount USDC amount to spend (6 decimals)
     */
    function placeBuyOrder(
        address rwaToken,
        uint256 limitPrice,
        uint256 usdcAmount
    ) external returns (uint256 orderId) {
        // KYC check
        require(complianceNFT.isVerified(msg.sender), "KYC required");
        require(usdcAmount > 0, "Amount must be positive");
        require(limitPrice > 0, "Price must be positive");
        
        // Lock USDC
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        
        // Create order
        orderId = _nextOrderId++;
        orders[orderId] = Order({
            id: orderId,
            trader: msg.sender,
            rwaToken: rwaToken,
            isBuy: true,
            limitPrice: limitPrice,
            amount: usdcAmount,
            filled: 0,
            timestamp: block.timestamp,
            active: true
        });
        
        activeOrderIds.push(orderId);
        
        emit OrderPlaced(orderId, msg.sender, rwaToken, true, limitPrice, usdcAmount);
        
        return orderId;
    }
    
    /**
     * @notice Place a sell order (sell RWA for USDC)
     * @param rwaToken RWA token address
     * @param limitPrice Minimum price to accept (USDC per RWA, 6 decimals)
     * @param rwaAmount RWA amount to sell (18 decimals)
     */
    function placeSellOrder(
        address rwaToken,
        uint256 limitPrice,
        uint256 rwaAmount
    ) external returns (uint256 orderId) {
        // KYC check
        require(complianceNFT.isVerified(msg.sender), "KYC required");
        require(rwaAmount > 0, "Amount must be positive");
        require(limitPrice > 0, "Price must be positive");
        
        // Lock RWA tokens
        IERC20(rwaToken).safeTransferFrom(msg.sender, address(this), rwaAmount);
        
        // Create order
        orderId = _nextOrderId++;
        orders[orderId] = Order({
            id: orderId,
            trader: msg.sender,
            rwaToken: rwaToken,
            isBuy: false,
            limitPrice: limitPrice,
            amount: rwaAmount,
            filled: 0,
            timestamp: block.timestamp,
            active: true
        });
        
        activeOrderIds.push(orderId);
        
        emit OrderPlaced(orderId, msg.sender, rwaToken, false, limitPrice, rwaAmount);
        
        return orderId;
    }
    
    /**
     * @notice Cancel an order and return locked tokens
     * @param orderId Order ID to cancel
     */
    function cancelOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        
        // Validation
        require(order.trader == msg.sender, "Not order owner");
        require(order.active, "Order not active");
        
        // Return locked tokens
        if (order.isBuy) {
            // Return USDC
            usdc.safeTransfer(order.trader, order.amount - order.filled);
        } else {
            // Return RWA tokens
            IERC20(order.rwaToken).safeTransfer(order.trader, order.amount - order.filled);
        }
        
        // Deactivate order
        order.active = false;
        _removeFromActiveOrders(orderId);
        
        emit OrderCancelled(orderId, msg.sender);
    }
    
    /**
     * @notice Match a buy order with a sell order (keeper only)
     * @param buyId Buy order ID
     * @param sellId Sell order ID
     * 
     * CRITICAL: Must verify buy.limitPrice >= sell.limitPrice FIRST
     * This prevents keeper from matching any two orders arbitrarily
     */
    function matchOrders(uint256 buyId, uint256 sellId) external {
        require(msg.sender == keeper, "Only keeper can match");
        
        Order storage buyOrder = orders[buyId];
        Order storage sellOrder = orders[sellId];
        
        // Validation
        require(buyOrder.active, "Buy order not active");
        require(sellOrder.active, "Sell order not active");
        require(buyOrder.isBuy, "First order must be buy");
        require(!sellOrder.isBuy, "Second order must be sell");
        require(buyOrder.rwaToken == sellOrder.rwaToken, "Token mismatch");
        
        // CRITICAL: Price overlap check - without this, keeper could match incompatible orders
        require(buyOrder.limitPrice >= sellOrder.limitPrice, "No price overlap");
        
        // Calculate fill
        // Use sell price (better for buyer)
        uint256 fillPrice = sellOrder.limitPrice;
        
        // Determine fill amount (limited by both orders)
        // Buy order: amount is in USDC (6 decimals)
        // Sell order: amount is in RWA tokens (18 decimals)
        // Need to convert to same units for comparison
        
        uint256 buyRemainingUSDC = buyOrder.amount - buyOrder.filled;
        uint256 sellRemainingRWA = sellOrder.amount - sellOrder.filled;
        
        // Convert sell RWA to USDC terms: rwaAmount * price / 1e18
        uint256 sellRemainingUSDC = (sellRemainingRWA * fillPrice) / 1e18;
        
        uint256 fillUSDC = buyRemainingUSDC < sellRemainingUSDC 
            ? buyRemainingUSDC 
            : sellRemainingUSDC;
        
        // Convert back to RWA amount: usdcAmount * 1e18 / price
        uint256 fillRWA = (fillUSDC * 1e18) / fillPrice;
        
        require(fillUSDC > 0 && fillRWA > 0, "Nothing to fill");
        
        // Execute settlement
        // Transfer RWA to buyer
        IERC20(buyOrder.rwaToken).safeTransfer(buyOrder.trader, fillRWA);
        
        // Transfer USDC to seller
        usdc.safeTransfer(sellOrder.trader, fillUSDC);
        
        // Update filled amounts
        buyOrder.filled += fillUSDC;
        sellOrder.filled += fillRWA;
        
        // Deactivate fully filled orders
        if (buyOrder.filled >= buyOrder.amount) {
            buyOrder.active = false;
            _removeFromActiveOrders(buyId);
        }
        
        if (sellOrder.filled >= sellOrder.amount) {
            sellOrder.active = false;
            _removeFromActiveOrders(sellId);
        }
        
        emit OrdersMatched(buyId, sellId, fillRWA, fillPrice);
    }
    
    /**
     * @notice Get all active orders for a token (for keeper scanning)
     * @param rwaToken RWA token address
     * @return activeOrders Array of active orders
     */
    function getActiveOrders(address rwaToken) external view returns (Order[] memory) {
        // Count matching orders
        uint256 count = 0;
        for (uint256 i = 0; i < activeOrderIds.length; i++) {
            uint256 orderId = activeOrderIds[i];
            if (orders[orderId].rwaToken == rwaToken && orders[orderId].active) {
                count++;
            }
        }
        
        // Build array
        Order[] memory activeOrders = new Order[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < activeOrderIds.length; i++) {
            uint256 orderId = activeOrderIds[i];
            if (orders[orderId].rwaToken == rwaToken && orders[orderId].active) {
                activeOrders[index] = orders[orderId];
                index++;
            }
        }
        
        return activeOrders;
    }
    
    /**
     * @notice Get best available fill price (for Router quote)
     * @param rwaToken RWA token address
     * @param amount Amount to trade (USDC for sell, RWA for buy)
     * @param isSell True if selling (need to check buy orders), false if buying (check sell orders)
     * @return bestPrice Best available price (0 if no liquidity)
     */
    function getBestFillPrice(
        address rwaToken,
        uint256 amount,
        bool isSell
    ) external view returns (uint256 bestPrice) {
        bestPrice = 0;
        uint256 remainingAmount = amount;
        
        // Scan active orders
        for (uint256 i = 0; i < activeOrderIds.length; i++) {
            uint256 orderId = activeOrderIds[i];
            Order memory order = orders[orderId];
            
            if (!order.active || order.rwaToken != rwaToken) continue;
            
            // If we're selling, look at buy orders
            // If we're buying, look at sell orders
            if (isSell && !order.isBuy) continue;
            if (!isSell && order.isBuy) continue;
            
            uint256 orderRemaining = order.amount - order.filled;
            if (orderRemaining == 0) continue;
            
            // Update best price and remaining
            if (bestPrice == 0 || 
                (isSell && order.limitPrice > bestPrice) ||
                (!isSell && order.limitPrice < bestPrice)) {
                bestPrice = order.limitPrice;
            }
            
            remainingAmount = remainingAmount > orderRemaining 
                ? remainingAmount - orderRemaining 
                : 0;
            
            if (remainingAmount == 0) break;
        }
        
        // If couldn't fill full amount, return 0 (no liquidity)
        if (remainingAmount > 0) {
            return 0;
        }
        
        return bestPrice;
    }
    
    /**
     * @notice Remove order from active list (internal)
     * @param orderId Order ID to remove
     */
    function _removeFromActiveOrders(uint256 orderId) internal {
        for (uint256 i = 0; i < activeOrderIds.length; i++) {
            if (activeOrderIds[i] == orderId) {
                // Swap with last element and pop
                activeOrderIds[i] = activeOrderIds[activeOrderIds.length - 1];
                activeOrderIds.pop();
                break;
            }
        }
    }
    
    /**
     * @notice Get orderbook stats for frontend
     */
    function getOrderbookInfo() external view returns (
        uint256 totalOrders,
        uint256 activeOrders,
        address keeperAddress
    ) {
        return (
            _nextOrderId - 1,
            activeOrderIds.length,
            keeper
        );
    }
}