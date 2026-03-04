// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IRWAToken.sol";

/**
 * @title MockOUSG
 * @notice Mock Ondo OUSG token with REBASING mechanism
 * @dev balanceOf() override makes this "rebasing" — balance grows automatically
 *      without transfers as rebaseIndex increases daily.
 */
contract MockOUSG is ERC20, Ownable, IRWAToken {
    /// @notice Rebase multiplier, starts at 1.0 (1e18), increases to simulate yield
    uint256 public rebaseIndex = 1e18;
    
    mapping(address => uint256) private _internalBalances;
    uint256 private _internalTotalSupply;
    
    uint256 private _currentNAV = 1.0023e18;
    uint256 private _yieldAPY = 485;
    uint256 public lastYieldDistribution;
    uint256 public lastRebase;
    
    constructor() ERC20("Mock OUSG", "mOUSG") Ownable(msg.sender) {
        lastYieldDistribution = block.timestamp;
        lastRebase = block.timestamp;
    }
    
    /// @notice Get current Net Asset Value per token
    /// @return NAV in 18 decimals (e.g., 1.0023e18 = $1.0023)
    function getCurrentNAV() external view override returns (uint256) {
        return _currentNAV;
    }
    
    /// @notice Get current Annual Percentage Yield
    /// @return APY in basis points (e.g., 485 = 4.85%)
    function getYieldAPY() external view override returns (uint256) {
        return _yieldAPY;
    }
    
    /// @notice Check if address is whitelisted (OUSG has no whitelist, always returns true)
    /// @return Always true
    function isWhitelisted(address) external pure override returns (bool) {
        return true;
    }
    
    /**
     * @notice Override balanceOf to apply rebase multiplier
     * @param account Address to query balance for
     * @return Rebased balance (internal balance × rebaseIndex)
     */
    function balanceOf(address account) public view override returns (uint256) {
        return (_internalBalances[account] * rebaseIndex) / 1e18;
    }
    
    /// @notice Override totalSupply to apply rebase multiplier
    /// @return Rebased total supply
    function totalSupply() public view override returns (uint256) {
        return (_internalTotalSupply * rebaseIndex) / 1e18;
    }
    
    /**
     * @notice Rebase — increases rebaseIndex to simulate daily yield accrual
     * @dev Callable once per day, simulates ~0.013% daily yield (4.85% APY)
     */
    function rebase() external onlyOwner {
        require(
            block.timestamp >= lastRebase + 1 days,
            "Must wait 1 day between rebases"
        );
        
        uint256 dailyRate = 13;
        uint256 increase = (rebaseIndex * dailyRate) / 100000;
        
        rebaseIndex += increase;
        lastRebase = block.timestamp;
        
        emit Rebased(rebaseIndex, block.timestamp);
    }
    
    /**
     * @notice Mint OUSG tokens (owner only, for demo)
     * @param to Recipient address
     * @param amount Amount to mint (18 decimals, in rebased terms)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        uint256 internalAmount = (amount * 1e18) / rebaseIndex;
        
        _internalBalances[to] += internalAmount;
        _internalTotalSupply += internalAmount;
        
        emit Transfer(address(0), to, amount);
    }
    
    /**
     * @notice Distribute yield (for IRWAToken interface compatibility)
     * @dev For OUSG, yield distribution happens via rebase(), this just updates timestamp
     */
    function distributeYield(uint256) external override onlyOwner {
        require(
            block.timestamp >= lastYieldDistribution + 30 days,
            "Must wait 30 days"
        );
        
        lastYieldDistribution = block.timestamp;
        
        emit YieldDistributed(0, _currentNAV);
    }
    
    /// @notice Override _update to work with internal rebased balances
    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0)) {
            return;
        }
        
        if (to == address(0)) {
            uint256 internalAmount = (value * 1e18) / rebaseIndex;
            _internalBalances[from] -= internalAmount;
            _internalTotalSupply -= internalAmount;
            
            emit Transfer(from, address(0), value);
            return;
        }
        
        uint256 internalAmount = (value * 1e18) / rebaseIndex;
        
        require(_internalBalances[from] >= internalAmount, "Insufficient balance");
        
        _internalBalances[from] -= internalAmount;
        _internalBalances[to] += internalAmount;
        
        emit Transfer(from, to, value);
    }
    
    /// @notice Get internal balance before rebase multiplier (for debugging)
    /// @param account Address to query
    /// @return Internal (pre-rebase) balance
    function internalBalanceOf(address account) external view returns (uint256) {
        return _internalBalances[account];
    }
    
    /// @notice Update NAV manually (for demo/testing)
    /// @param newNAV New NAV in 18 decimals
    function setNAV(uint256 newNAV) external onlyOwner {
        require(newNAV > 0, "NAV must be positive");
        _currentNAV = newNAV;
        emit NAVUpdated(newNAV);
    }
    
    /// @notice Update APY (for demo/testing)
    /// @param newAPY New APY in basis points
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