// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IRWAToken.sol";

/**
 * @title MockBENJI
 * @notice Mock Franklin Templeton BENJI token
 * @dev Simpler than MockBUIDL - standard ERC20 with NAV/APY
 * No transfer restrictions (unlike BUIDL)
 */
contract MockBENJI is ERC20, Ownable, IRWAToken {
    uint256 private _currentNAV = 1.0050e18;
    uint256 private _yieldAPY = 475;
    uint256 public lastYieldDistribution;
    
    mapping(address => bool) private _alwaysTrue;
    
    constructor() ERC20("Mock BENJI", "mBENJI") Ownable(msg.sender) {
        lastYieldDistribution = block.timestamp;
    }
    
    /// @notice Get current Net Asset Value per token
    /// @return NAV in 18 decimals (e.g., 1.005e18 = $1.005)
    function getCurrentNAV() external view override returns (uint256) {
        return _currentNAV;
    }
    
    /// @notice Get current Annual Percentage Yield
    /// @return APY in basis points (e.g., 475 = 4.75%)
    function getYieldAPY() external view override returns (uint256) {
        return _yieldAPY;
    }
    
    /// @notice Check if address is whitelisted (BENJI has no whitelist, always returns true)
    /// @return Always true
    function isWhitelisted(address) external pure override returns (bool) {
        return true;
    }
    
    /// @notice Mint BENJI tokens (owner only, for demo seeding)
    /// @param to Recipient address
    /// @param amount Amount to mint (18 decimals)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @notice Distribute yield to increase NAV proportionally
     * @param yieldAmount Amount of yield to distribute (18 decimals)
     */
    function distributeYield(uint256 yieldAmount) external override onlyOwner {
        require(
            block.timestamp >= lastYieldDistribution + 30 days,
            "Must wait 30 days"
        );
        
        uint256 supply = totalSupply();
        require(supply > 0, "No tokens in circulation");
        
        uint256 navIncrease = (yieldAmount * 1e18) / supply;
        _currentNAV += navIncrease;
        
        lastYieldDistribution = block.timestamp;
        
        emit YieldDistributed(yieldAmount, _currentNAV);
    }
    
    /// @notice Update NAV manually (for demo/testing)
    /// @param newNAV New NAV value (18 decimals)
    function setNAV(uint256 newNAV) external onlyOwner {
        require(newNAV > 0, "NAV must be positive");
        _currentNAV = newNAV;
        emit NAVUpdated(newNAV);
    }
    
    /// @notice Update APY (for demo/testing)
    /// @param newAPY New APY in basis points (e.g., 475 = 4.75%)
    function setAPY(uint256 newAPY) external onlyOwner {
        require(newAPY <= 10000, "APY cannot exceed 100%");
        _yieldAPY = newAPY;
        emit APYUpdated(newAPY);
    }
    
    event YieldDistributed(uint256 amount, uint256 newNAV);
    event NAVUpdated(uint256 newNAV);
    event APYUpdated(uint256 newAPY);
}