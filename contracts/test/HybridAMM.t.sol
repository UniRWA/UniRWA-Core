// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/core/HybridAMM.sol";
import "../src/mocks/MockUSDC.sol";
import "../src/mocks/MockBUIDL.sol";
import "../src/mocks/MockOracle.sol";

contract HybridAMMTest is Test {
    HybridAMM public amm;
    MockUSDC public usdc;
    MockBUIDL public buidl;
    MockOracle public oracle;

    address public alice = address(0x1);
    address public bob = address(0x2);
    address public owner;

    uint256 public constant INITIAL_USDC = 100_000e6;
    uint256 public constant INITIAL_BUIDL = 100_000e18;

    function setUp() public {
        owner = address(this);

        usdc = new MockUSDC();
        buidl = new MockBUIDL();
        oracle = new MockOracle();

        oracle.setPrice("BUIDL", 100000000, 450);

        amm = new HybridAMM(address(usdc), address(oracle));

        buidl.whitelistAddress(alice);
        buidl.whitelistAddress(bob);
        buidl.whitelistAddress(address(amm));

        usdc.mint(alice, INITIAL_USDC);
        usdc.mint(bob, INITIAL_USDC);
        buidl.mint(alice, INITIAL_BUIDL);
        buidl.mint(bob, INITIAL_BUIDL);
    }

    function test_AddLiquidity_FirstProvider() public {
        vm.startPrank(alice);
        usdc.approve(address(amm), 50_000e6);
        buidl.approve(address(amm), 50_000e18);

        uint256 lpMinted = amm.addLiquidity(address(buidl), 50_000e6, 50_000e18);
        vm.stopPrank();

        assertGt(lpMinted, 0, "Should mint LP tokens");
        assertEq(amm.reservesUSDC(address(buidl)), 50_000e6, "USDC reserves should match");
        assertEq(amm.reservesRWA(address(buidl)), 50_000e18, "RWA reserves should match");
        assertEq(amm.lpBalances(alice, address(buidl)), lpMinted, "Alice should hold LP tokens");
    }

    function test_AddLiquidity_SecondProvider() public {
        vm.startPrank(alice);
        usdc.approve(address(amm), 50_000e6);
        buidl.approve(address(amm), 50_000e18);
        amm.addLiquidity(address(buidl), 50_000e6, 50_000e18);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(amm), 25_000e6);
        buidl.approve(address(amm), 25_000e18);
        uint256 lpMinted = amm.addLiquidity(address(buidl), 25_000e6, 25_000e18);
        vm.stopPrank();

        assertGt(lpMinted, 0, "Bob should receive LP tokens");
        assertEq(amm.reservesUSDC(address(buidl)), 75_000e6, "USDC reserves should be 75K");
        assertEq(amm.reservesRWA(address(buidl)), 75_000e18, "RWA reserves should be 75K");
    }

    function test_RemoveLiquidity() public {
        vm.startPrank(alice);
        usdc.approve(address(amm), 50_000e6);
        buidl.approve(address(amm), 50_000e18);
        uint256 lpMinted = amm.addLiquidity(address(buidl), 50_000e6, 50_000e18);

        uint256 usdcBefore = usdc.balanceOf(alice);
        uint256 buidlBefore = buidl.balanceOf(alice);

        (uint256 usdcReturned, uint256 rwaReturned) = amm.removeLiquidity(address(buidl), lpMinted);
        vm.stopPrank();

        assertEq(usdcReturned, 50_000e6, "Should return all USDC");
        assertEq(rwaReturned, 50_000e18, "Should return all RWA");
        assertEq(usdc.balanceOf(alice), usdcBefore + usdcReturned, "Alice USDC balance should increase");
        assertEq(buidl.balanceOf(alice), buidlBefore + rwaReturned, "Alice BUIDL balance should increase");
        assertEq(amm.reservesUSDC(address(buidl)), 0, "USDC reserves should be 0");
        assertEq(amm.reservesRWA(address(buidl)), 0, "RWA reserves should be 0");
    }

    function test_Swap_BuyRWA() public {
        _seedLiquidity(alice, 50_000e6, 50_000e18);

        uint256 swapAmount = 1_000e6;
        vm.startPrank(bob);
        usdc.approve(address(amm), swapAmount);

        uint256 buidlBefore = buidl.balanceOf(bob);
        uint256 amountOut = amm.swap(address(buidl), swapAmount, false);
        vm.stopPrank();

        assertGt(amountOut, 0, "Should receive BUIDL tokens");
        assertEq(buidl.balanceOf(bob), buidlBefore + amountOut, "Bob BUIDL balance should increase");
    }

    function test_Swap_SellRWA() public {
        _seedLiquidity(alice, 50_000e6, 50_000e18);

        uint256 swapAmount = 1_000e18;
        vm.startPrank(bob);
        buidl.approve(address(amm), swapAmount);

        uint256 usdcBefore = usdc.balanceOf(bob);
        uint256 amountOut = amm.swap(address(buidl), swapAmount, true);
        vm.stopPrank();

        assertGt(amountOut, 0, "Should receive USDC");
        assertEq(usdc.balanceOf(bob), usdcBefore + amountOut, "Bob USDC balance should increase");
    }

    function test_GetAmountOut_MatchesSwap() public {
        _seedLiquidity(alice, 50_000e6, 50_000e18);

        uint256 swapAmount = 1_000e6;
        uint256 quote = amm.getAmountOut(address(buidl), swapAmount, false);

        vm.startPrank(bob);
        usdc.approve(address(amm), swapAmount);
        uint256 actual = amm.swap(address(buidl), swapAmount, false);
        vm.stopPrank();

        assertEq(actual, quote, "Actual swap should match quoted amount");
    }

    function test_Swap_EmitsEvent() public {
        _seedLiquidity(alice, 50_000e6, 50_000e18);

        uint256 swapAmount = 1_000e6;
        vm.startPrank(bob);
        usdc.approve(address(amm), swapAmount);

        vm.expectEmit(true, true, false, false);
        emit HybridAMM.Swap(bob, address(buidl), false, 0, 0, 0);

        amm.swap(address(buidl), swapAmount, false);
        vm.stopPrank();
    }

    function test_Swap_PoolNotInitialized_Reverts() public {
        vm.startPrank(bob);
        usdc.approve(address(amm), 1_000e6);

        vm.expectRevert("Pool not initialized");
        amm.swap(address(buidl), 1_000e6, false);
        vm.stopPrank();
    }

    function test_Swap_ZeroAmount_Reverts() public {
        _seedLiquidity(alice, 50_000e6, 50_000e18);

        vm.startPrank(bob);
        vm.expectRevert("Amount must be positive");
        amm.swap(address(buidl), 0, false);
        vm.stopPrank();
    }

    function test_TreasuryFees_Accumulate() public {
        _seedLiquidity(alice, 50_000e6, 50_000e18);

        vm.startPrank(bob);
        usdc.approve(address(amm), 1_000e6);
        amm.swap(address(buidl), 1_000e6, false);
        vm.stopPrank();

        uint256 usdcFees = amm.treasuryFeesUSDC(address(buidl));
        assertGt(usdcFees, 0, "Treasury USDC fees should accumulate on buy");
    }

    function test_WithdrawTreasuryFees() public {
        _seedLiquidity(alice, 50_000e6, 50_000e18);

        vm.startPrank(bob);
        usdc.approve(address(amm), 1_000e6);
        amm.swap(address(buidl), 1_000e6, false);
        vm.stopPrank();

        uint256 ownerUsdcBefore = usdc.balanceOf(owner);

        amm.withdrawTreasuryFees(address(buidl));

        uint256 ownerUsdcAfter = usdc.balanceOf(owner);
        assertGt(ownerUsdcAfter, ownerUsdcBefore, "Owner should receive treasury fees");
        assertEq(amm.treasuryFeesUSDC(address(buidl)), 0, "Treasury fees should be zeroed");
    }

    function test_GetPoolInfo() public {
        _seedLiquidity(alice, 50_000e6, 50_000e18);

        (
            uint256 rwaReserve,
            uint256 usdcReserve,
            uint256 totalLP,
            uint256 rwaFees,
            uint256 usdcFees
        ) = amm.getPoolInfo(address(buidl));

        assertEq(usdcReserve, 50_000e6, "USDC reserve should be 50K");
        assertEq(rwaReserve, 50_000e18, "RWA reserve should be 50K");
        assertGt(totalLP, 0, "Total LP should be positive");
        assertEq(rwaFees, 0, "No RWA fees yet");
        assertEq(usdcFees, 0, "No USDC fees yet");
    }

    function _seedLiquidity(address provider, uint256 usdcAmt, uint256 rwaAmt) internal {
        vm.startPrank(provider);
        usdc.approve(address(amm), usdcAmt);
        buidl.approve(address(amm), rwaAmt);
        amm.addLiquidity(address(buidl), usdcAmt, rwaAmt);
        vm.stopPrank();
    }
}
