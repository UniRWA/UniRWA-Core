// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/core/Orderbook.sol";
import "../src/mocks/MockUSDC.sol";
import "../src/mocks/MockBUIDL.sol";

/**
 * @title OrderbookTest
 * @notice Tests for Orderbook contract
 */
contract OrderbookTest is Test {
    Orderbook public orderbook;
    MockUSDC public usdc;
    MockBUIDL public buidl;
    MockComplianceNFT public complianceNFT;
    
    address public keeper = address(0x999);
    address public alice = address(0x1);
    address public bob = address(0x2);
    
    function setUp() public {
        // Deploy mocks
        usdc = new MockUSDC();
        buidl = new MockBUIDL();
        complianceNFT = new MockComplianceNFT();
        
        // Deploy orderbook
        orderbook = new Orderbook(
            address(usdc),
            address(complianceNFT),
            keeper
        );
        
        // Give KYC to users
        complianceNFT.mint(alice);
        complianceNFT.mint(bob);
        
        // CRITICAL: Whitelist users on MockBUIDL
        buidl.whitelistAddress(alice);
        buidl.whitelistAddress(bob);
        buidl.whitelistAddress(address(orderbook)); // Whitelist orderbook too!
        
        // Mint tokens
        usdc.mint(alice, 100_000e6);
        usdc.mint(bob, 100_000e6);
        buidl.mint(alice, 100_000e18);
        buidl.mint(bob, 100_000e18);
    }
    
    function test_PlaceBuyOrder() public {
        vm.startPrank(alice);
        
        usdc.approve(address(orderbook), 10_000e6);
        uint256 orderId = orderbook.placeBuyOrder(
            address(buidl),
            1000000, // $1.00 per BUIDL (6 decimals)
            10_000e6
        );
        
        vm.stopPrank();
        
        (
            uint256 id,
            address trader,
            address rwaToken,
            bool isBuy,
            uint256 limitPrice,
            uint256 amount,
            ,
            ,
            bool active
        ) = orderbook.orders(orderId);
        
        assertEq(id, 1);
        assertEq(trader, alice);
        assertEq(rwaToken, address(buidl));
        assertTrue(isBuy);
        assertEq(limitPrice, 1000000);
        assertEq(amount, 10_000e6);
        assertTrue(active);
    }
    
    function test_PlaceSellOrder() public {
        vm.startPrank(bob);
        
        buidl.approve(address(orderbook), 10_000e18);
        uint256 orderId = orderbook.placeSellOrder(
            address(buidl),
            1000000, // $1.00 per BUIDL
            10_000e18
        );
        
        vm.stopPrank();
        
        (
            uint256 id,
            address trader,
            address rwaToken,
            bool isBuy,
            uint256 limitPrice,
            uint256 amount,
            ,
            ,
            bool active
        ) = orderbook.orders(orderId);
        
        assertEq(id, 1);
        assertEq(trader, bob);
        assertEq(rwaToken, address(buidl));
        assertFalse(isBuy);
        assertEq(limitPrice, 1000000);
        assertEq(amount, 10_000e18);
        assertTrue(active);
    }
    
    function test_MatchOrders() public {
        // Alice places buy order
        vm.startPrank(alice);
        usdc.approve(address(orderbook), 10_000e6);
        uint256 buyId = orderbook.placeBuyOrder(
            address(buidl),
            1000000,
            10_000e6
        );
        vm.stopPrank();
        
        // Bob places sell order
        vm.startPrank(bob);
        buidl.approve(address(orderbook), 10_000e18);
        uint256 sellId = orderbook.placeSellOrder(
            address(buidl),
            1000000,
            10_000e18
        );
        vm.stopPrank();
        
        // Keeper matches
        vm.prank(keeper);
        orderbook.matchOrders(buyId, sellId);
        
        // Verify settlement
        // Alice started with 100K, got 10K more from match
        assertEq(buidl.balanceOf(alice), 110_000e18);
        // Bob started with 100K, got 10K USDC from match
        assertEq(usdc.balanceOf(bob), 110_000e6);
    }
    
    function test_CancelOrder() public {
        vm.startPrank(alice);
        
        usdc.approve(address(orderbook), 10_000e6);
        uint256 orderId = orderbook.placeBuyOrder(
            address(buidl),
            1000000,
            10_000e6
        );
        
        // Cancel order
        orderbook.cancelOrder(orderId);
        
        vm.stopPrank();
        
        // Verify USDC returned
        assertEq(usdc.balanceOf(alice), 100_000e6);
        
        // Verify order inactive
        (,,,,,,,,bool active) = orderbook.orders(orderId);
        assertFalse(active);
    }
}

/**
 * @notice Mock ComplianceNFT for testing
 */
contract MockComplianceNFT {
    mapping(address => bool) public verified;
    
    function mint(address to) external {
        verified[to] = true;
    }
    
    function isVerified(address wallet) external view returns (bool) {
        return verified[wallet];
    }
}