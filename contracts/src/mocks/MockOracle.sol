// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IChainlinkOracle.sol";

/**
 * @title MockOracle
 * @notice Chainlink-compatible oracle for NAV prices on Fuji testnet
 * @dev Implements exact Chainlink interface for mainnet compatibility
 * IMPORTANT: 2-hour staleness check mirrors real oracle behavior
 */
contract MockOracle is IChainlinkOracle, Ownable {
    // Price data per symbol
    struct PriceData {
        int256 nav;          // NAV in 8 decimals (Chainlink standard)
        uint256 updatedAt;   // Last update timestamp
        uint256 apy;         // APY in basis points (e.g., 450 = 4.50%)
    }
    
    mapping(string => PriceData) public prices;
    
    uint256 public constant STALENESS_THRESHOLD = 2 hours;
    uint8 public constant DECIMALS = 8; // Chainlink standard
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice Set NAV and APY for a token
     * @param symbol Token symbol (e.g., "BUIDL")
     * @param nav NAV in 8 decimals (e.g., 100000000 = $1.00)
     * @param apy APY in basis points (e.g., 450 = 4.50%)
     */
    function setPrice(string memory symbol, int256 nav, uint256 apy) external onlyOwner {
        require(nav > 0, "NAV must be positive");
        require(apy <= 10000, "APY cannot exceed 100%");
        
        prices[symbol] = PriceData({
            nav: nav,
            updatedAt: block.timestamp,
            apy: apy
        });
        
        emit PriceUpdated(symbol, nav, apy, block.timestamp);
    }
    
    /**
     * @notice Get latest price data for a token (Chainlink interface)
     * @dev REVERTS if data is stale (>2 hours old) - mirrors real oracle behavior
     */
    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        // For demo, we'll use a default symbol
        // In production, this would be set per oracle instance
        return getLatestRoundData("BUIDL");
    }
    
    /**
     * @notice Get latest price data for specific symbol
     */
    function getLatestRoundData(string memory symbol)
        public
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        PriceData memory data = prices[symbol];
        
        require(data.updatedAt > 0, "Price not set");
        require(
            block.timestamp <= data.updatedAt + STALENESS_THRESHOLD,
            "Price data is stale - oracle updater must run"
        );
        
        return (
            1,              // roundId (not used in mock)
            data.nav,       // answer (the NAV price)
            data.updatedAt, // startedAt
            data.updatedAt, // updatedAt
            1               // answeredInRound
        );
    }
    
    /**
     * @notice Get NAV for a symbol (simplified getter)
     * @param symbol Token symbol
     * @return NAV in 8 decimals
     */
    function getNAV(string memory symbol) external view returns (int256) {
        (, int256 answer,,,) = getLatestRoundData(symbol);
        return answer;
    }
    
    /**
     * @notice Get APY for a symbol
     * @param symbol Token symbol
     * @return APY in basis points
     */
    function getAPY(string memory symbol) external view returns (uint256) {
        PriceData memory data = prices[symbol];
        require(data.updatedAt > 0, "Price not set");
        return data.apy;
    }
    
    /// @notice Get price feed decimals (Chainlink standard is 8)
    /// @return Decimal count (always 8)
    function decimals() external pure override returns (uint8) {
        return DECIMALS;
    }
    
    /// @notice Get price feed description
    /// @return Human-readable description of this oracle
    function description() external pure override returns (string memory) {
        return "MockOracle for RWA NAV prices";
    }
    
    event PriceUpdated(string indexed symbol, int256 nav, uint256 apy, uint256 timestamp);
}