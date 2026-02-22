// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";   
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IRWAToken.sol";

/**
 * @title MockBUIDL
 * @notice Mock BlackRock BUIDL token with KYC whitelist (mirrors real BUIDL behavior)
 * @dev CRITICAL: Contracts (Pool, AMM, Orderbook) must be whitelisted or transfers fail
 * Real BUIDL has strict transfer controls - this mock replicates that
 */
contract MockBUIDL is ERC20, Ownable, IRWAToken {
    // KYC whitelist (mirrors real BUIDL's transfer controls)
    mapping(address => bool) public whitelist;
    
    // NAV and yield tracking
    uint256 private _currentNAV = 1.0000e18;  // Starts at $1.00 (18 decimals)
    uint256 private _yieldAPY = 450;           // 4.50% APY (basis points)
    uint256 public lastYieldDistribution;
    
    // Yield distribution tracking
    uint256 public totalYieldDistributed;
    
    constructor() ERC20("Mock BUIDL", "mBUILD") Ownable(msg.sender) {
        lastYieldDistribution = block.timestamp;
        
        // Whitelist deployer automatically
        whitelist[msg.sender] = true;
    }
    
    /**
     * @notice Get current NAV (implements IsBUIDL)
     */
    function getCurrentNAV() external view override returns (uint256) {
        return _currentNAV;
    }
    
    /**
     * @notice Get current APY (implements IsBUIDL)
     */
    function getYieldAPY() external view override returns (uint256) {
        return _yieldAPY;
    }
    
    /**
     * @notice Check if address is whitelisted (implements IRWAToken)
     */
    function isWhitelisted(address account) external view override returns (bool) {
        return whitelist[account];
    }
    
    /**
     * @notice Whitelist an address (for KYC'd users and contracts)
     * @dev MUST whitelist Pool, AMM, Orderbook contracts or they can't hold BUIDL
     */
    function whitelistAddress(address account) external onlyOwner {
        whitelist[account] = true;
        emit Whitelisted(account);
    }
    
    /**
     * @notice Whitelist multiple addresses at once (for efficiency)
     */
    function whitelistBatch(address[] calldata accounts) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            whitelist[accounts[i]] = true;
            emit Whitelisted(accounts[i]);
        }
    }
    
    /**
     * @notice Remove from whitelist
     */
    function removeFromWhitelist(address account) external onlyOwner {
        whitelist[account] = false;
        emit RemovedFromWhitelist(account);
    }
    
    /**
     * @notice Mint tokens (only owner can mint for demo seeding)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(whitelist[to], "Recipient not whitelisted");
        _mint(to, amount);
    }
    
    /**
     * @notice Distribute yield (callable monthly)
     * @dev Increases NAV proportionally to simulate yield accrual
     */
    function distributeYield(uint256 yieldAmount) external override onlyOwner {
        require(
            block.timestamp >= lastYieldDistribution + 30 days,
            "Must wait 30 days between distributions"
        );
        
        uint256 supply = totalSupply();
        require(supply > 0, "No tokens in circulation");
        
        // Increase NAV proportionally
        uint256 navIncrease = (yieldAmount * 1e18) / supply;
        _currentNAV += navIncrease;
        
        lastYieldDistribution = block.timestamp;
        totalYieldDistributed += yieldAmount;
        
        emit YieldDistributed(yieldAmount, _currentNAV);
    }
    
    /**
     * @notice Update NAV manually (for demo purposes)
     */
    function setNAV(uint256 newNAV) external onlyOwner {
        require(newNAV > 0, "NAV must be positive");
        _currentNAV = newNAV;
        emit NAVUpdated(newNAV);
    }
    
    /**
     * @notice Update APY (for demo purposes)
     */
    function setAPY(uint256 newAPY) external onlyOwner {
        require(newAPY <= 10000, "APY cannot exceed 100%");
        _yieldAPY = newAPY;
        emit APYUpdated(newAPY);
    }
    
    /**
     * @notice Override _update to enforce KYC on ALL transfers
     * @dev This is what makes BUIDL special - strict transfer controls
     */
    function _update(address from, address to, uint256 value) internal virtual override {
        // Allow minting (from == address(0))
        if (from != address(0)) {
            require(whitelist[from], "Sender not whitelisted");
        }
        
        // Allow burning (to == address(0))
        if (to != address(0)) {
            require(whitelist[to], "Recipient not whitelisted");
        }
        
        super._update(from, to, value);
    }
    
    event Whitelisted(address indexed account);
    event RemovedFromWhitelist(address indexed account);
    event YieldDistributed(uint256 amount, uint256 newNAV);
    event NAVUpdated(uint256 newNAV);
    event APYUpdated(uint256 newAPY);
}