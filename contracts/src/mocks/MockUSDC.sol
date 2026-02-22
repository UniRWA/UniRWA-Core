// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @notice Test USDC token with faucet for Fuji testnet
 * @dev CRITICAL: 6 decimals (not 18!) to match real USDC
 * Pool math will overflow if you use 18 decimals
 */
contract MockUSDC is ERC20, Ownable {
    // Faucet configuration
    uint256 public constant FAUCET_AMOUNT = 10_000e6; // 10,000 USDC (6 decimals)
    uint256 public constant FAUCET_COOLDOWN = 24 hours;
    
    // Track last faucet claim per address
    mapping(address => uint256) public lastFaucetClaim;
    
    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {}
    
    /**
     * @notice Get 6 decimals (matches real USDC)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }
    
    /**
     * @notice Public faucet - anyone can claim 10K USDC once per 24h
     * @dev Prevents spam with cooldown period
     */
    function faucet() external {
        require(
            block.timestamp >= lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN,
            "Faucet cooldown active - wait 24h"
        );
        
        lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }
    
    /**
     * @notice Owner can mint any amount (for seeding demo)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @notice Check cooldown remaining for an address
     * @param account Address to check
     * @return Seconds until next faucet claim available (0 if available now)
     */
    function faucetCooldownRemaining(address account) external view returns (uint256) {
        uint256 nextClaim = lastFaucetClaim[account] + FAUCET_COOLDOWN;
        if (block.timestamp >= nextClaim) return 0;
        return nextClaim - block.timestamp;
    }
    
    event FaucetClaimed(address indexed claimer, uint256 amount);
}