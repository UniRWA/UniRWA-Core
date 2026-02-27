// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/HybridAMM.sol";
import "../src/mocks/MockIssuer.sol";
import "../src/mocks/MockUSDC.sol";

/**
 * @title DeployAMM
 * @notice Deploy HybridAMM and seed with initial liquidity
 * @dev Uses EXISTING MockIssuer (no need to redeploy)
 */
contract DeployAMM is Script {
    // Existing contracts
    address public MOCK_USDC;
    address public MOCK_BUIDL;
    address public MOCK_BENJI;
    address public MOCK_OUSG;
    address public MOCK_ORACLE;
    address public MOCK_ISSUER;
    
    // New contract
    HybridAMM public amm;
    
    function run() external {
        // Load addresses
        MOCK_USDC = vm.envAddress("MOCK_USDC_ADDRESS");
        MOCK_BUIDL = vm.envAddress("MOCK_BUIDL_ADDRESS");
        MOCK_BENJI = vm.envAddress("MOCK_BENJI_ADDRESS");
        MOCK_OUSG = vm.envAddress("MOCK_OUSG_ADDRESS");
        MOCK_ORACLE = vm.envAddress("MOCK_ORACLE_ADDRESS");
        MOCK_ISSUER = vm.envAddress("MOCK_ISSUER_ADDRESS");
        
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("=== DEPLOYING HYBRIDAMM TO FUJI ===");
        console.log("Deployer:", deployer);
        console.log("Using MockIssuer:", MOCK_ISSUER);
        console.log("");
        
        // Get MockIssuer instance
        MockIssuer issuer = MockIssuer(MOCK_ISSUER);
        
        // ===== STEP 1: Deploy HybridAMM =====
        console.log("1/5 Deploying HybridAMM...");
        amm = new HybridAMM(MOCK_USDC, MOCK_ORACLE);
        console.log("HybridAMM deployed at:", address(amm));
        console.log("");
        
        // ===== STEP 2: Whitelist AMM and deployer on MockBUIDL =====
        console.log("2/5 Whitelisting AMM + deployer on MockBUIDL...");
        issuer.whitelistOnToken(MOCK_BUIDL, address(amm));
        issuer.whitelistOnToken(MOCK_BUIDL, deployer);
        console.log(" Whitelisted");
        console.log("");
        
        // ===== STEP 3: Mint tokens for liquidity seeding =====
        console.log("3/5 Minting tokens for liquidity...");
        
        // Mint USDC (deployer still owns this)
        MockUSDC(MOCK_USDC).mint(deployer, 150_000e6);
        
        // Mint RWA tokens via MockIssuer (it owns them)
        issuer.mintToken(MOCK_BUIDL, deployer, 50_000e18);
        issuer.mintToken(MOCK_BENJI, deployer, 50_000e18);
        issuer.mintToken(MOCK_OUSG, deployer, 50_000e18);
        
        console.log(" Tokens minted");
        console.log("");
        
        // ===== STEP 4: Seed liquidity =====
        console.log("4/5 Seeding liquidity...");
        
        // BUIDL Pool
        MockUSDC(MOCK_USDC).approve(address(amm), 50_000e6);
        IERC20(MOCK_BUIDL).approve(address(amm), 50_000e18);
        amm.addLiquidity(MOCK_BUIDL, 50_000e6, 50_000e18);
        console.log(" BUIDL pool: 50K USDC + 50K BUIDL");
        
        // BENJI Pool
        MockUSDC(MOCK_USDC).approve(address(amm), 50_000e6);
        IERC20(MOCK_BENJI).approve(address(amm), 50_000e18);
        amm.addLiquidity(MOCK_BENJI, 50_000e6, 50_000e18);
        console.log(" BENJI pool: 50K USDC + 50K BENJI");
        
        // OUSG Pool
        MockUSDC(MOCK_USDC).approve(address(amm), 50_000e6);
        IERC20(MOCK_OUSG).approve(address(amm), 50_000e18);
        amm.addLiquidity(MOCK_OUSG, 50_000e6, 50_000e18);
        console.log("OUSG pool: 50K USDC + 50K OUSG");
        console.log("");
        
        // ===== STEP 5: Summary =====
        console.log("5/5 Deployment complete!");
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("=== DEPLOYMENT SUMMARY ===");
        console.log("");
        console.log("HYBRID_AMM_ADDRESS=", address(amm));
        console.log("");
        console.log("Liquidity seeded:");
        console.log("- BUIDL: 50K USDC + 50K BUIDL");
        console.log("- BENJI: 50K USDC + 50K BENJI");
        console.log("- OUSG: 50K USDC + 50K OUSG");
        console.log("");
        console.log("Verify on Snowtrace:");
        console.log("https://testnet.snowtrace.io/address/", address(amm));
    }
}