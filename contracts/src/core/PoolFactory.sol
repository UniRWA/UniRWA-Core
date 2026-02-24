// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./FractionalPool.sol";

/**
 * @title PoolFactory
 * @notice Factory for deploying FractionalPool instances
 * @dev Tracks all deployed pools, prevents duplicate deployments
 */
contract PoolFactory {
    // All deployed pools
    address[] public allPools;
    
    // Mapping to check if address is a pool
    mapping(address => bool) public isPool;
    
    // Events
    event PoolCreated(
        address indexed pool,
        string indexed symbol,
        uint256 threshold,
        uint256 minDeposit,
        uint256 timestamp
    );
    
    /**
     * @notice Create a new fractional pool
     * @param asset USDC token address
     * @param symbol RWA symbol (e.g., "BUIDL", "BENJI", "OUSG")
     * @param threshold Target USDC amount (e.g., 50_000e6 = $50K)
     * @param minDeposit Minimum per-user deposit (e.g., 1_000e6 = $1K)
     * @param complianceNFT ComplianceNFT contract address
     * @param issuer MockIssuer contract address
     * @return pool Address of newly created pool
     */
    function createPool(
        address asset,
        string memory symbol,
        uint256 threshold,
        uint256 minDeposit,
        address complianceNFT,
        address issuer
    ) external returns (address pool) {
        // Deploy new pool
        FractionalPool newPool = new FractionalPool(
            asset,
            symbol,
            threshold,
            minDeposit,
            complianceNFT,
            issuer
        );
        
        pool = address(newPool);
        
        // Track pool
        allPools.push(pool);
        isPool[pool] = true;
        
        emit PoolCreated(pool, symbol, threshold, minDeposit, block.timestamp);
        
        return pool;
    }
    
    /**
     * @notice Get all deployed pools
     * @return Array of all pool addresses
     */
    function getAllPools() external view returns (address[] memory) {
        return allPools;
    }
    
    /**
     * @notice Get total number of pools
     */
    function poolCount() external view returns (uint256) {
        return allPools.length;
    }
}