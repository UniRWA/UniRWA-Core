// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IComplianceNFT.sol";

interface IHybridAMM {
    function lpBalances(address user, address token) external view returns (uint256);
}

contract LiquidityMining is Ownable {

    IHybridAMM public immutable amm;
    IComplianceNFT public immutable complianceNFT;

    mapping(address => mapping(address => uint256)) public stakedLP;
    mapping(address => uint256) public rewardDebt;
    mapping(address => uint256) public totalStaked;
    mapping(address => uint256) public lastStakeTime;

    uint256 public avaxPerSecond;
    uint256 public totalRewardsPaid;
    uint256 public totalStakedAllPools;

    address[] public registeredPools;
    mapping(address => bool) public isRegisteredPool;

    event Staked(address indexed user, address indexed lpPool, uint256 amount);
    event Unstaked(address indexed user, address indexed lpPool, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
    event AvaxPerSecondUpdated(uint256 oldRate, uint256 newRate);
    event PoolRegistered(address indexed lpPool);

    constructor(
        address amm_,
        address complianceNFT_,
        uint256 avaxPerSecond_
    ) Ownable(msg.sender) {
        require(amm_ != address(0), "Invalid AMM address");
        require(complianceNFT_ != address(0), "Invalid ComplianceNFT address");

        amm = IHybridAMM(amm_);
        complianceNFT = IComplianceNFT(complianceNFT_);
        avaxPerSecond = avaxPerSecond_;
    }

    receive() external payable {}

    function stake(address lpPool, uint256 amount) external {
        require(complianceNFT.isVerified(msg.sender), "KYC required");
        require(amount > 0, "Amount must be positive");

        uint256 userLPBalance = amm.lpBalances(msg.sender, lpPool);
        require(
            userLPBalance >= stakedLP[msg.sender][lpPool] + amount,
            "Insufficient LP balance on AMM"
        );

        _claimPending(msg.sender);

        if (!isRegisteredPool[lpPool]) {
            registeredPools.push(lpPool);
            isRegisteredPool[lpPool] = true;
            emit PoolRegistered(lpPool);
        }

        stakedLP[msg.sender][lpPool] += amount;
        totalStaked[lpPool] += amount;
        totalStakedAllPools += amount;
        lastStakeTime[msg.sender] = block.timestamp;

        emit Staked(msg.sender, lpPool, amount);
    }

    function unstake(address lpPool, uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        require(stakedLP[msg.sender][lpPool] >= amount, "Insufficient staked balance");

        _claimPending(msg.sender);

        stakedLP[msg.sender][lpPool] -= amount;
        totalStaked[lpPool] -= amount;
        totalStakedAllPools -= amount;
        lastStakeTime[msg.sender] = block.timestamp;

        emit Unstaked(msg.sender, lpPool, amount);
    }

    function claimRewards() external {
        _claimPending(msg.sender);
    }

    function pendingRewards(address user) external view returns (uint256 pending) {
        if (totalStakedAllPools == 0 || lastStakeTime[user] == 0) {
            return 0;
        }

        uint256 timeElapsed = block.timestamp - lastStakeTime[user];
        uint256 totalUserStake = _getUserTotalStake(user);

        if (totalUserStake == 0) {
            return 0;
        }

        pending = (totalUserStake * avaxPerSecond * timeElapsed) / totalStakedAllPools;
    }

    function _claimPending(address user) internal {
        if (totalStakedAllPools == 0 || lastStakeTime[user] == 0) {
            lastStakeTime[user] = block.timestamp;
            return;
        }

        uint256 timeElapsed = block.timestamp - lastStakeTime[user];
        uint256 totalUserStake = _getUserTotalStake(user);

        if (totalUserStake == 0 || timeElapsed == 0) {
            lastStakeTime[user] = block.timestamp;
            return;
        }

        uint256 pending = (totalUserStake * avaxPerSecond * timeElapsed) / totalStakedAllPools;

        lastStakeTime[user] = block.timestamp;

        if (pending > 0 && address(this).balance >= pending) {
            rewardDebt[user] += pending;
            totalRewardsPaid += pending;
            
            (bool success, ) = payable(user).call{value: pending}("");
            require(success, "AVAX transfer failed");

            emit Claimed(user, pending);
        }
    }

    function _getUserTotalStake(address user) internal view returns (uint256 total) {
        for (uint256 i = 0; i < registeredPools.length; i++) {
            total += stakedLP[user][registeredPools[i]];
        }
    }

    function setAvaxPerSecond(uint256 newRate) external onlyOwner {
        emit AvaxPerSecondUpdated(avaxPerSecond, newRate);
        avaxPerSecond = newRate;
    }

    function getStakingInfo() external view returns (
        uint256 rate,
        uint256 totalStakedAll,
        uint256 rewardsBalance,
        uint256 rewardsPaid,
        uint256 poolCount
    ) {
        return (
            avaxPerSecond,
            totalStakedAllPools,
            address(this).balance,
            totalRewardsPaid,
            registeredPools.length
        );
    }

    function getUserInfo(address user, address lpPool) external view returns (
        uint256 staked,
        uint256 totalUserStake,
        uint256 pending,
        uint256 lastTime
    ) {
        staked = stakedLP[user][lpPool];
        totalUserStake = _getUserTotalStake(user);
        
        if (totalStakedAllPools > 0 && lastStakeTime[user] > 0 && totalUserStake > 0) {
            uint256 timeElapsed = block.timestamp - lastStakeTime[user];
            pending = (totalUserStake * avaxPerSecond * timeElapsed) / totalStakedAllPools;
        }
        
        lastTime = lastStakeTime[user];
    }
}
