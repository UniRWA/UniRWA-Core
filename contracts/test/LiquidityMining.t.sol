// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/core/LiquidityMining.sol";
import "../src/mocks/MockUSDC.sol";
import "../src/mocks/MockBUIDL.sol";
import "../src/mocks/MockOracle.sol";
import "../src/core/HybridAMM.sol";

contract LiquidityMiningTest is Test {
    LiquidityMining public mining;
    HybridAMM public amm;
    MockUSDC public usdc;
    MockBUIDL public buidl;
    MockOracle public oracle;
    MockComplianceNFT public complianceNFT;

    address public alice = address(0x1);
    address public bob = address(0x2);

    uint256 public constant AVAX_PER_SECOND = 1e15;

    function setUp() public {
        usdc = new MockUSDC();
        buidl = new MockBUIDL();
        oracle = new MockOracle();
        complianceNFT = new MockComplianceNFT();

        oracle.setPrice("BUIDL", 100000000, 450);

        amm = new HybridAMM(address(usdc), address(oracle));

        mining = new LiquidityMining(
            address(amm),
            address(complianceNFT),
            AVAX_PER_SECOND
        );

        vm.deal(address(mining), 10 ether);

        buidl.whitelistAddress(alice);
        buidl.whitelistAddress(bob);
        buidl.whitelistAddress(address(amm));

        usdc.mint(alice, 100_000e6);
        usdc.mint(bob, 100_000e6);
        buidl.mint(alice, 100_000e18);
        buidl.mint(bob, 100_000e18);

        vm.startPrank(alice);
        usdc.approve(address(amm), 50_000e6);
        buidl.approve(address(amm), 50_000e18);
        amm.addLiquidity(address(buidl), 50_000e6, 50_000e18);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(amm), 50_000e6);
        buidl.approve(address(amm), 50_000e18);
        amm.addLiquidity(address(buidl), 50_000e6, 50_000e18);
        vm.stopPrank();

        complianceNFT.mint(alice);
    }

    function test_StakeWithoutKYC_Reverts() public {
        uint256 bobLP = amm.lpBalances(bob, address(buidl));
        assertGt(bobLP, 0, "Bob should have LP tokens");

        vm.startPrank(bob);
        vm.expectRevert("KYC required");
        mining.stake(address(buidl), bobLP);
        vm.stopPrank();
    }

    function test_StakeWithKYC_Succeeds() public {
        uint256 aliceLP = amm.lpBalances(alice, address(buidl));
        assertGt(aliceLP, 0, "Alice should have LP tokens");

        vm.startPrank(alice);
        mining.stake(address(buidl), aliceLP);
        vm.stopPrank();

        assertEq(mining.stakedLP(alice, address(buidl)), aliceLP, "Staked LP should match");
        assertEq(mining.totalStaked(address(buidl)), aliceLP, "Total staked should match");
        assertEq(mining.totalStakedAllPools(), aliceLP, "Total all pools should match");
    }

    function test_ClaimRewards_AfterTimeElapsed() public {
        uint256 aliceLP = amm.lpBalances(alice, address(buidl));

        vm.startPrank(alice);
        mining.stake(address(buidl), aliceLP);

        uint256 aliceAvaxBefore = alice.balance;

        vm.warp(block.timestamp + 1000);

        uint256 expectedReward = AVAX_PER_SECOND * 1000;

        uint256 pending = mining.pendingRewards(alice);
        assertEq(pending, expectedReward, "Pending should be 1 AVAX");

        mining.claimRewards();
        vm.stopPrank();

        uint256 aliceAvaxAfter = alice.balance;
        assertEq(
            aliceAvaxAfter - aliceAvaxBefore,
            expectedReward,
            "Alice should receive 1 AVAX in rewards"
        );

        assertEq(mining.totalRewardsPaid(), expectedReward, "Total rewards paid should update");
    }

    function test_Unstake_ReturnsLP() public {
        uint256 aliceLP = amm.lpBalances(alice, address(buidl));

        vm.startPrank(alice);
        mining.stake(address(buidl), aliceLP);

        vm.warp(block.timestamp + 100);

        uint256 halfLP = aliceLP / 2;
        mining.unstake(address(buidl), halfLP);
        vm.stopPrank();

        assertEq(
            mining.stakedLP(alice, address(buidl)),
            aliceLP - halfLP,
            "Staked should be halved"
        );
        assertEq(
            mining.totalStakedAllPools(),
            aliceLP - halfLP,
            "Total should be halved"
        );
    }

    function test_MultipleStakers_SplitRewards() public {
        complianceNFT.mint(bob);

        uint256 aliceLP = amm.lpBalances(alice, address(buidl));
        uint256 bobLP = amm.lpBalances(bob, address(buidl));

        vm.prank(alice);
        mining.stake(address(buidl), aliceLP);

        vm.prank(bob);
        mining.stake(address(buidl), bobLP);

        vm.warp(block.timestamp + 1000);

        uint256 alicePending = mining.pendingRewards(alice);
        uint256 bobPending = mining.pendingRewards(bob);

        uint256 totalExpected = AVAX_PER_SECOND * 1000;
        assertApproxEqRel(
            alicePending + bobPending,
            totalExpected,
            0.01e18,
            "Total pending should equal total rewards"
        );
    }
}

contract MockComplianceNFT {
    mapping(address => bool) public verified;

    function mint(address to) external {
        verified[to] = true;
    }

    function isVerified(address wallet) external view returns (bool) {
        return verified[wallet];
    }
}
