// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/ComplianceNFT.sol";
import "../src/core/PoolFactory.sol";
import "../src/core/FractionalPool.sol";
import "../src/mocks/MockIssuer.sol";
import "../src/mocks/MockUSDC.sol";
import "../src/mocks/MockBUIDL.sol";
import "../src/mocks/MockBENJI.sol";
import "../src/mocks/MockOUSG.sol";
import "../src/mocks/MockOracle.sol";

/**
 * @title DeployCore
 * @notice Deploys full core contract stack to Fuji
 * @dev Run with: forge script script/DeployCore.s.sol --rpc-url fuji --broadcast --verify
 * 
 * Deployment order:
 * 1. ComplianceNFT
 * 2. PoolFactory
 * 3. MockIssuer
 * 4. Register assets in MockIssuer
 * 5. Create 3 pools via PoolFactory (BUIDL, BENJI, OUSG)
 * 6. Authorize pools in MockIssuer
 * 7. Whitelist pools on each mock RWA token
 * 8. Transfer mock token ownership to MockIssuer
 */
contract DeployCore is Script {
    // Existing deployed contracts (from Day 2)
    address public MOCK_USDC;
    address public MOCK_BUIDL;
    address public MOCK_BENJI;
    address public MOCK_OUSG;
    address public MOCK_ORACLE;
    
    // New contracts to deploy
    ComplianceNFT public complianceNFT;
    PoolFactory public poolFactory;
    MockIssuer public mockIssuer;
    
    // Pool addresses
    address public buidlPool;
    address public benjiPool;
    address public ousgPool;
    
    function run() external {
        // Load existing contract addresses from .env
        MOCK_USDC = vm.envAddress("MOCK_USDC_ADDRESS");
        MOCK_BUIDL = vm.envAddress("MOCK_BUIDL_ADDRESS");
        MOCK_BENJI = vm.envAddress("MOCK_BENJI_ADDRESS");
        MOCK_OUSG = vm.envAddress("MOCK_OUSG_ADDRESS");
        MOCK_ORACLE = vm.envAddress("MOCK_ORACLE_ADDRESS");
        
        // Load deployer private key
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("=== DEPLOYING CORE CONTRACTS TO FUJI ===");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("");
        
        // ====== STEP 1: Deploy ComplianceNFT ======
        console.log("1/7 Deploying ComplianceNFT...");
        complianceNFT = new ComplianceNFT();
        console.log("ComplianceNFT deployed at:", address(complianceNFT));
        console.log("");
        
        // ====== STEP 2: Deploy PoolFactory ======
        console.log("2/7 Deploying PoolFactory...");
        poolFactory = new PoolFactory();
        console.log("PoolFactory deployed at:", address(poolFactory));
        console.log("");
        
        // ====== STEP 3: Deploy MockIssuer ======
        console.log("3/7 Deploying MockIssuer...");
        mockIssuer = new MockIssuer(
            MOCK_USDC,
            MOCK_ORACLE,
            address(complianceNFT)
        );
        console.log("MockIssuer deployed at:", address(mockIssuer));
        console.log("");
        
        // ====== STEP 4: Register assets in MockIssuer ======
        console.log("4/7 Registering assets in MockIssuer...");
        mockIssuer.registerAsset("BUIDL", MOCK_BUIDL, 50_000e6);  // $50K min
        mockIssuer.registerAsset("BENJI", MOCK_BENJI, 100_000e6); // $100K min
        mockIssuer.registerAsset("OUSG", MOCK_OUSG, 25_000e6);    // $25K min
        console.log("Registered: BUIDL, BENJI, OUSG");
        console.log("");
        
        // ====== STEP 5: Create pools via PoolFactory ======
        console.log("5/7 Creating pools via PoolFactory...");
        
        // BUIDL Pool ($50K threshold, $1K min deposit)
        buidlPool = poolFactory.createPool(
            MOCK_USDC,
            "BUIDL",
            50_000e6,
            1_000e6,
            address(complianceNFT),
            address(mockIssuer)
        );
        console.log("BUIDL Pool created at:", buidlPool);
        
        // BENJI Pool ($100K threshold, $2K min deposit)
        benjiPool = poolFactory.createPool(
            MOCK_USDC,
            "BENJI",
            100_000e6,
            2_000e6,
            address(complianceNFT),
            address(mockIssuer)
        );
        console.log("BENJI Pool created at:", benjiPool);
        
        // OUSG Pool ($25K threshold, $500 min deposit)
        ousgPool = poolFactory.createPool(
            MOCK_USDC,
            "OUSG",
            25_000e6,
            500e6,
            address(complianceNFT),
            address(mockIssuer)
        );
        console.log("OUSG Pool created at:", ousgPool);
        console.log("");
        
        // ====== STEP 6: Authorize pools in MockIssuer ======
        console.log("6/7 Authorizing pools in MockIssuer...");
        mockIssuer.authorizePool(buidlPool);
        mockIssuer.authorizePool(benjiPool);
        mockIssuer.authorizePool(ousgPool);
        console.log("All 3 pools authorized");
        console.log("");
        
        // ====== STEP 7: Whitelist pools + Transfer ownership ======
        console.log("7/7 Whitelisting pools on mock tokens...");
        
        // Cast to MockBUIDL/BENJI/OUSG for whitelist function
        MockBUIDL(MOCK_BUIDL).whitelistAddress(buidlPool);
        console.log("Pool whitelisted on MockBUIDL");
        
        // Transfer mock token ownership to MockIssuer so it can mint
        MockBUIDL(MOCK_BUIDL).transferOwnership(address(mockIssuer));
        MockBENJI(MOCK_BENJI).transferOwnership(address(mockIssuer));
        MockOUSG(MOCK_OUSG).transferOwnership(address(mockIssuer));
        console.log("Mock token ownership transferred to MockIssuer");
        console.log("");
        
        vm.stopBroadcast();
        
        // ====== PRINT SUMMARY ======
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("");
        console.log("Copy these addresses to your .env file:");
        console.log("");
        console.log("COMPLIANCE_NFT_ADDRESS=", address(complianceNFT));
        console.log("POOL_FACTORY_ADDRESS=", address(poolFactory));
        console.log("MOCK_ISSUER_ADDRESS=", address(mockIssuer));
        console.log("BUIDL_POOL_ADDRESS=", buidlPool);
        console.log("BENJI_POOL_ADDRESS=", benjiPool);
        console.log("OUSG_POOL_ADDRESS=", ousgPool);
        console.log("");
        console.log("Verify contracts on Snowtrace:");
        console.log("https://testnet.snowtrace.io/address/", address(complianceNFT));
        console.log("https://testnet.snowtrace.io/address/", address(poolFactory));
        console.log("https://testnet.snowtrace.io/address/", address(mockIssuer));
        console.log("https://testnet.snowtrace.io/address/", buidlPool);
        console.log("https://testnet.snowtrace.io/address/", benjiPool);
        console.log("https://testnet.snowtrace.io/address/", ousgPool);
    }
}