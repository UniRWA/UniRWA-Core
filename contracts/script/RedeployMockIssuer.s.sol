// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/mocks/MockIssuer.sol";
import "../src/mocks/MockBUIDL.sol";
import "../src/mocks/MockBENJI.sol";
import "../src/mocks/MockOUSG.sol";
import "../src/core/PoolFactory.sol";

/**
 * @title RedeployMockIssuer
 * @notice Redeploy MockIssuer with new admin proxy functions
 * @dev CRITICAL: Must transfer ownership FROM old MockIssuer first!
 */
contract RedeployMockIssuer is Script {
    // Existing contracts
    address public MOCK_USDC;
    address public MOCK_BUIDL;
    address public MOCK_BENJI;
    address public MOCK_OUSG;
    address public MOCK_ORACLE;
    address public COMPLIANCE_NFT;
    address public OLD_MOCK_ISSUER;
    address public BUIDL_POOL;
    address public BENJI_POOL;
    address public OUSG_POOL;
    
    // New MockIssuer
    MockIssuer public mockIssuer;
    
    function run() external {
        // Load addresses
        MOCK_USDC = vm.envAddress("MOCK_USDC_ADDRESS");
        MOCK_BUIDL = vm.envAddress("MOCK_BUIDL_ADDRESS");
        MOCK_BENJI = vm.envAddress("MOCK_BENJI_ADDRESS");
        MOCK_OUSG = vm.envAddress("MOCK_OUSG_ADDRESS");
        MOCK_ORACLE = vm.envAddress("MOCK_ORACLE_ADDRESS");
        COMPLIANCE_NFT = vm.envAddress("COMPLIANCE_NFT_ADDRESS");
        OLD_MOCK_ISSUER = vm.envAddress("MOCK_ISSUER_ADDRESS");
        BUIDL_POOL = vm.envAddress("BUIDL_POOL_ADDRESS");
        BENJI_POOL = vm.envAddress("BENJI_POOL_ADDRESS");
        OUSG_POOL = vm.envAddress("OUSG_POOL_ADDRESS");
        
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("=== REDEPLOYING MOCKISSUER WITH NEW FUNCTIONS ===");
        console.log("Deployer:", deployer);
        console.log("Old MockIssuer:", OLD_MOCK_ISSUER);
        console.log("");
        
        // ===== STEP 1: Deploy new MockIssuer =====
        console.log("1/7 Deploying new MockIssuer...");
        mockIssuer = new MockIssuer(
            MOCK_USDC,
            MOCK_ORACLE,
            COMPLIANCE_NFT
        );
        console.log("New MockIssuer deployed at:", address(mockIssuer));
        console.log("");
        
        // ===== STEP 2: Transfer ownership FROM old MockIssuer TO deployer =====
        console.log("2/7 Reclaiming token ownership from old MockIssuer...");
        
        // Call old MockIssuer to transfer ownership back to deployer
        MockIssuer oldIssuer = MockIssuer(OLD_MOCK_ISSUER);
        
        // Transfer BUIDL ownership: oldIssuer → deployer
        (bool success1,) = MOCK_BUIDL.call(
            abi.encodeWithSignature("transferOwnership(address)", deployer)
        );
        require(success1, "BUIDL ownership transfer failed");
        
        // Transfer BENJI ownership: oldIssuer → deployer  
        (bool success2,) = MOCK_BENJI.call(
            abi.encodeWithSignature("transferOwnership(address)", deployer)
        );
        require(success2, "BENJI ownership transfer failed");
        
        // Transfer OUSG ownership: oldIssuer → deployer
        (bool success3,) = MOCK_OUSG.call(
            abi.encodeWithSignature("transferOwnership(address)", deployer)
        );
        require(success3, "OUSG ownership transfer failed");
        
        console.log(" Token ownership reclaimed by deployer");
        console.log("");
        
        // ===== STEP 3: Register assets in new MockIssuer =====
        console.log("3/7 Registering assets in new MockIssuer...");
        mockIssuer.registerAsset("BUIDL", MOCK_BUIDL, 50_000e6);
        mockIssuer.registerAsset("BENJI", MOCK_BENJI, 100_000e6);
        mockIssuer.registerAsset("OUSG", MOCK_OUSG, 25_000e6);
        console.log("Assets registered");
        console.log("");
        
        // ===== STEP 4: Authorize pools in new MockIssuer =====
        console.log("4/7 Authorizing pools in new MockIssuer...");
        mockIssuer.authorizePool(BUIDL_POOL);
        mockIssuer.authorizePool(BENJI_POOL);
        mockIssuer.authorizePool(OUSG_POOL);
        console.log("Pools authorized");
        console.log("");
        
        // ===== STEP 5: Transfer token ownership TO new MockIssuer =====
        console.log("5/7 Transferring token ownership to new MockIssuer...");
        MockBUIDL(MOCK_BUIDL).transferOwnership(address(mockIssuer));
        MockBENJI(MOCK_BENJI).transferOwnership(address(mockIssuer));
        MockOUSG(MOCK_OUSG).transferOwnership(address(mockIssuer));
        console.log(" Ownership transferred to new MockIssuer");
        console.log("");
        
        // ===== STEP 6: Whitelist pools (now that new MockIssuer owns tokens) =====
        console.log("6/7 Whitelisting pools on MockBUIDL...");
        mockIssuer.whitelistOnToken(MOCK_BUIDL, BUIDL_POOL);
        console.log(" BUIDL pool whitelisted");
        console.log("");
        
        // ===== STEP 7: Whitelist deployer on MockBUIDL (for AMM seeding) =====
        console.log("7/7 Whitelisting deployer on MockBUIDL...");
        mockIssuer.whitelistOnToken(MOCK_BUIDL, deployer);
        console.log(" Deployer whitelisted");
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("=== REDEPLOY COMPLETE ===");
        console.log("");
        console.log("NEW_MOCK_ISSUER_ADDRESS=", address(mockIssuer));
        console.log("");
        console.log("  UPDATE YOUR .env WITH:");
        console.log("MOCK_ISSUER_ADDRESS=", address(mockIssuer));
    }
}