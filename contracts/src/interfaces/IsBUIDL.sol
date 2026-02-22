// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IsBUIDL
 * @notice Interface for all RWA tokens (BUIDL, BENJI, OUSG)
 * @dev This interface ensures compatibility between mock and real RWA tokens
 * Key functions: getCurrentNAV() and getYieldAPY() are required for pool math
 */
interface IsBUIDL {
    /**
     * @notice Get current Net Asset Value per token
     * @return NAV in 18 decimals (e.g., 1.0045e18 = $1.0045)
     */
    function getCurrentNAV() external view returns (uint256);
    
    /**
     * @notice Get current Annual Percentage Yield
     * @return APY in basis points (e.g., 450 = 4.50%)
     */
    function getYieldAPY() external view returns (uint256);
    

}