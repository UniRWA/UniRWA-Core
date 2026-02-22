// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IsBUIDL.sol";

/**
 * @title IRWAToken
 * @notice Extended interface for RWA tokens with additional functionality
 * @dev Inherits from IsBUIDL, adds RWA-specific functions
 */
interface IRWAToken is IsBUIDL {
    /**
     * @notice Distribute yield to all token holders
     * @param yieldAmount Amount of yield to distribute (in token's decimals)
     */
    function distributeYield(uint256 yieldAmount) external;
    
    /**
     * @notice Check if an address is whitelisted (for KYC compliance)
     * @param account Address to check
     * @return True if whitelisted
     */
    function isWhitelisted(address account) external view returns (bool);
    
    /**
     * @notice Get last yield distribution timestamp
     * @return Timestamp of last distribution
     */
    function lastYieldDistribution() external view returns (uint256);
}