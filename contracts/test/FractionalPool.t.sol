// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/core/FractionalPool.sol";
import "../src/core/PoolFactory.sol";
import "../src/mocks/MockUSDC.sol";
import "../src/mocks/MockBUIDL.sol";
import "../src/mocks/MockOracle.sol";

/**
 * @title FractionalPoolTest
 * @notice Tests for FractionalPool contract
 * @dev Tests critical paths: KYC gating, deposits, threshold execution, NAV calculation
 */
contract FractionalPoolTest is Test {
    // Contracts
    FractionalPool public pool;
    PoolFactory public factory;
    MockUSDC public usdc;
    MockBUIDL public buidl;
    MockOracle public oracle;
    MockComplianceNFT public complianceNFT;
    MockIssuer public issuer;
    
    // Test users
    address public alice = address(0x1);
    address public bob = address(0x2);
    address public charlie = address(0x3);
    
    // Pool config
    uint256 public constant THRESHOLD = 50_000e6;  // $50K
    uint256 public constant MIN_DEPOSIT = 1_000e6; // $1K
    
    function setUp() public {
        // Deploy mocks
        usdc = new MockUSDC();
        buidl = new MockBUIDL();
        oracle = new MockOracle();
        complianceNFT = new MockComplianceNFT();
        
        // Deploy issuer
        issuer = new MockIssuer(address(usdc), address(buidl), address(oracle));
        
        // CRITICAL FIX: Transfer BUIDL ownership to issuer so it can mint
        buidl.transferOwnership(address(issuer));
        
        // Set initial NAV in oracle
        oracle.setPrice("BUIDL", 100000000, 450); // $1.00, 4.50% APY
        
        // Deploy factory
        factory = new PoolFactory();
        
        // Create pool via factory
        address poolAddress = factory.createPool(
            address(usdc),
            "BUIDL",
            THRESHOLD,
            MIN_DEPOSIT,
            address(complianceNFT),
            address(issuer)
        );
        pool = FractionalPool(poolAddress);
        
        // Whitelist pool on BUIDL (CRITICAL!)
        // Since we transferred ownership, we need issuer to whitelist
        issuer.whitelistPool(address(pool));
        
        // Mint USDC to test users
        usdc.mint(alice, 10_000e6);
        usdc.mint(bob, 20_000e6);
        usdc.mint(charlie, 30_000e6);
    }
    
    /**
     * TEST 1: Deposit without KYC should revert
     */
    function test_DepositWithoutKYC_Reverts() public {
        // Alice does NOT have ComplianceNFT
        vm.startPrank(alice);
        
        usdc.approve(address(pool), 1_000e6);
        
        vm.expectRevert("KYC required: complete verification first");
        pool.deposit(1_000e6, alice);
        
        vm.stopPrank();
    }
    
    /**
     * TEST 2: Deposit with KYC succeeds and mints shares
     */
    function test_DepositWithKYC_Succeeds() public {
        // Give Alice KYC
        complianceNFT.mint(alice);
        
        vm.startPrank(alice);
        
        // Approve and deposit
        usdc.approve(address(pool), 5_000e6);
        uint256 shares = pool.deposit(5_000e6, alice);
        
        vm.stopPrank();
        
        // Verify shares minted (should be 1:1 initially)
        assertEq(shares, 5_000e6, "Shares should equal USDC deposited");
        assertEq(pool.balanceOf(alice), 5_000e6, "Alice should have shares");
        assertEq(pool.totalDeposited(), 5_000e6, "Total deposited should update");
    }
    
    /**
     * TEST 3: Pool executes purchase when threshold hit
     */
    function test_PoolExecutesAtThreshold() public {
        // Give KYC to all users
        complianceNFT.mint(alice);
        complianceNFT.mint(bob);
        complianceNFT.mint(charlie);
        
        // Alice deposits $10K
        vm.startPrank(alice);
        usdc.approve(address(pool), 10_000e6);
        pool.deposit(10_000e6, alice);
        vm.stopPrank();
        
        // Bob deposits $20K
        vm.startPrank(bob);
        usdc.approve(address(pool), 20_000e6);
        pool.deposit(20_000e6, bob);
        vm.stopPrank();
        
        // Pool not funded yet
        assertFalse(pool.poolFunded(), "Pool should not be funded yet");
        
        // Charlie deposits $20K → triggers threshold
        vm.startPrank(charlie);
        usdc.approve(address(pool), 20_000e6);
        pool.deposit(20_000e6, charlie);
        vm.stopPrank();
        
        // Pool should be funded now
        assertTrue(pool.poolFunded(), "Pool should be funded after threshold");
        
        // Pool should hold BUIDL tokens
        uint256 buidlBalance = buidl.balanceOf(address(pool));
        assertGt(buidlBalance, 0, "Pool should hold BUIDL tokens");
    }
    
    /**
     * TEST 4: totalAssets() returns correct values pre and post funding
     */
    function test_TotalAssets_ReflectsNAV() public {
        // Give KYC
        complianceNFT.mint(alice);
        complianceNFT.mint(bob);
        complianceNFT.mint(charlie);
        
        // Deposit $10K
        vm.startPrank(alice);
        usdc.approve(address(pool), 10_000e6);
        pool.deposit(10_000e6, alice);
        vm.stopPrank();
        
        // PRE-FUNDING: totalAssets should equal USDC balance
        uint256 assetsPreFunding = pool.totalAssets();
        assertEq(assetsPreFunding, 10_000e6, "Pre-funding assets should equal USDC");
        
        // Now fund the pool (Bob deposits $20K, Charlie deposits $20K)
        vm.startPrank(bob);
        usdc.approve(address(pool), 20_000e6);
        pool.deposit(20_000e6, bob);
        vm.stopPrank();
        
        vm.startPrank(charlie);
        usdc.approve(address(pool), 20_000e6);
        pool.deposit(20_000e6, charlie);
        vm.stopPrank();
        
        // Pool is now funded
        assertTrue(pool.poolFunded());
        
        // Set RWA token reference
        pool.setRWAToken(address(buidl));
        
        // POST-FUNDING: totalAssets should reflect NAV
        uint256 assetsPostFunding = pool.totalAssets();
        
        // BUIDL NAV is $1.00, so assets should still be ~$50K
        // (might be slightly different due to precision)
        assertApproxEqRel(
            assetsPostFunding,
            50_000e6,
            0.01e18, // 1% tolerance
            "Post-funding assets should reflect NAV"
        );
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

/**
 * @notice Mock Issuer for testing
 */
contract MockIssuer {
    IERC20 public usdc;
    MockBUIDL public buidl;
    MockOracle public oracle;
    
    constructor(address usdc_, address buidl_, address oracle_) {
        usdc = IERC20(usdc_);
        buidl = MockBUIDL(buidl_);
        oracle = MockOracle(oracle_);
    }
    
    // Helper to whitelist pools (since we own BUIDL now)
    function whitelistPool(address pool) external {
        buidl.whitelistAddress(pool);
    }
    
    function buyForPool(string memory symbol, uint256 usdcAmount) external {
        // Transfer USDC from pool
        usdc.transferFrom(msg.sender, address(this), usdcAmount);
        
        // Get NAV
        (, int256 nav,,,) = oracle.getLatestRoundData(symbol);
        
        // Calculate BUIDL to mint (NAV is in 8 decimals, BUIDL is 18 decimals)
        uint256 buidlAmount = (usdcAmount * 1e20) / uint256(nav); // Converts to 18 decimals
        
        // Mint BUIDL to pool
        buidl.mint(msg.sender, buidlAmount);
    }
}