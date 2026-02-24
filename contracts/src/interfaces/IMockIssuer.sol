// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IMockIssuer
 * @notice Interface for RWA token issuer (MockIssuer on Fuji)
 * @dev Used by FractionalPool to purchase RWA tokens
 */
interface IMockIssuer {
    /**
     * @notice Purchase RWA tokens for a pool
     * @param symbol Token symbol (e.g., "BUIDL", "BENJI", "OUSG")
     * @param usdcAmount Amount of USDC to spend (6 decimals)
     * @dev Pool must approve USDC first, issuer mints RWA tokens to pool
     */
    function buyForPool(string memory symbol, uint256 usdcAmount) external;
}