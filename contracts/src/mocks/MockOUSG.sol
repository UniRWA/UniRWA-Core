// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IRWAToken.sol";

/**
 * @title MockOUSG
 * @notice Mock Ondo OUSG token with REBASING mechanism
 * @dev CRITICAL: balanceOf() override makes this "rebasing"
 * Balance grows automatically without transfers - this is the key feature
 * TEST THIS: Stake 100 OUSG, simulate a day, check balanceOf grows
 */
contract MockOUSG is ERC20, Ownable, IRWAToken {
    // Rebase index - starts at 1.0 (1e18), increases to simulate yield
    uint256 public rebaseIndex = 1e18;
    
    // Internal balances (before rebase multiplication)
    mapping(address => uint256) private _internalBalances;
    uint256 private _internalTotalSupply;
    
    // NAV and yield
    uint256 private _currentNAV = 1.0023e18;  // Starts at $1.0023
    uint256 private _yieldAPY = 485;           // 4.85% APY
    uint256 public lastYieldDistribution;
    uint256 public lastRebase;
    
    constructor() ERC20("Mock OUSG", "mOUSG") Ownable(msg.sender) {
        lastYieldDistribution = block.timestamp;
        lastRebase = block.timestamp;
    }
    
    function getCurrentNAV() external view override returns (uint256) {
        return _currentNAV;
    }
    
    function getYieldAPY() external view override returns (uint256) {
        return _yieldAPY;
    }
    
    function isWhitelisted(address) external pure override returns (bool) {
        return true; // OUSG has no whitelist
    }
    
    /**
     * @notice Override balanceOf to apply rebase multiplier
     * @dev This is what makes OUSG "rebasing" - balance grows without transfers
     */
    function balanceOf(address account) public view override returns (uint256) {
        return (_internalBalances[account] * rebaseIndex) / 1e18;
    }
    
    /**
     * @notice Override totalSupply to apply rebase multiplier
     */
    function totalSupply() public view override returns (uint256) {
        return (_internalTotalSupply * rebaseIndex) / 1e18;
    }
    
    /**
     * @notice Rebase - increases rebaseIndex to simulate yield accrual
     * @dev Callable daily, simulates 0.013% daily yield (4.85% APY)
     */
    function rebase() external onlyOwner {
        require(
            block.timestamp >= lastRebase + 1 days,
            "Must wait 1 day between rebases"
        );
        
        // Daily rebase: 4.85% APY ≈ 0.013% per day
        // New index = old index * 1.00013
        uint256 dailyRate = 13; // 0.013% in basis points * 100
        uint256 increase = (rebaseIndex * dailyRate) / 100000;
        
        rebaseIndex += increase;
        lastRebase = block.timestamp;
        
        emit Rebased(rebaseIndex, block.timestamp);
    }
    
    /**
     * @notice Mint tokens (owner only, for demo)
     * @dev Mints to internal balance, actual balance = internal * rebaseIndex
     */
    function mint(address to, uint256 amount) external onlyOwner {
        // Convert amount to internal balance
        uint256 internalAmount = (amount * 1e18) / rebaseIndex;
        
        _internalBalances[to] += internalAmount;
        _internalTotalSupply += internalAmount;
        
        emit Transfer(address(0), to, amount);
    }
    
    /**
     * @notice Distribute yield (for compatibility with IRWAToken)
     */
    function distributeYield(uint256) external override onlyOwner {
        require(
            block.timestamp >= lastYieldDistribution + 30 days,
            "Must wait 30 days"
        );
        
        // For OUSG, yield distribution happens via rebase
        // This function just updates timestamp for compatibility
        lastYieldDistribution = block.timestamp;
        
        emit YieldDistributed(0, _currentNAV);
    }
    
    /**
     * @notice Override _update to work with internal balances
     */
    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0)) {
            // Minting - handled in mint()
            return;
        }
        
        if (to == address(0)) {
            // Burning
            uint256 internalAmount = (value * 1e18) / rebaseIndex;
            _internalBalances[from] -= internalAmount;
            _internalTotalSupply -= internalAmount;
            
            emit Transfer(from, address(0), value);
            return;
        }
        
        // Transfer
        uint256 internalAmount = (value * 1e18) / rebaseIndex;
        
        require(_internalBalances[from] >= internalAmount, "Insufficient balance");
        
        _internalBalances[from] -= internalAmount;
        _internalBalances[to] += internalAmount;
        
        emit Transfer(from, to, value);
    }
    
    /**
     * @notice Get internal balance (for debugging)
     */
    function internalBalanceOf(address account) external view returns (uint256) {
        return _internalBalances[account];
    }
    
    function setNAV(uint256 newNAV) external onlyOwner {
        require(newNAV > 0, "NAV must be positive");
        _currentNAV = newNAV;
        emit NAVUpdated(newNAV);
    }
    
    function setAPY(uint256 newAPY) external onlyOwner {
        require(newAPY <= 10000, "APY cannot exceed 100%");
        _yieldAPY = newAPY;
        emit APYUpdated(newAPY);
    }
    
    event Rebased(uint256 newIndex, uint256 timestamp);
    event YieldDistributed(uint256 amount, uint256 newNAV);
    event NAVUpdated(uint256 newNAV);
    event APYUpdated(uint256 newAPY);
}