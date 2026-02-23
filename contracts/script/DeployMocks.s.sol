// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/mocks/MockUSDC.sol";
import "../src/mocks/MockBUIDL.sol";
import "../src/mocks/MockBENJI.sol";
import "../src/mocks/MockOUSG.sol";
import "../src/mocks/MockOracle.sol";

/**
 * @title DeployMocks
 * @notice Deploys all mock contracts to Fuji testnet in correct order
 * @dev Run with: forge script script/DeployMocks.s.sol --rpc-url fuji --broadcast --verify
 */
contract DeployMocks is Script {
    function run() external {
        // Load deployer private key from .env
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("=== DEPLOYING MOCK ECOSYSTEM TO FUJI ===");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("");
        
        // 1. Deploy MockUSDC
        console.log("1/5 Deploying MockUSDC...");
        MockUSDC mockUSDC = new MockUSDC();
        console.log("MockUSDC deployed at:", address(mockUSDC));
        console.log("");
        
        // 2. Deploy MockOracle
        console.log("2/5 Deploying MockOracle...");
        MockOracle mockOracle = new MockOracle();
        console.log("MockOracle deployed at:", address(mockOracle));
        console.log("");
        
        // 3. Set initial NAV values in Oracle
        console.log("Setting initial NAV values...");
        mockOracle.setPrice("BUIDL", 100000000, 450);  // $1.00, 4.50% APY (8 decimals)
        mockOracle.setPrice("BENJI", 100500000, 475);  // $1.005, 4.75% APY
        mockOracle.setPrice("OUSG", 100230000, 485);   // $1.0023, 4.85% APY
        console.log("NAV values set for BUIDL, BENJI, OUSG");
        console.log("");
        
        // 4. Deploy MockBUIDL
        console.log("3/5 Deploying MockBUIDL...");
        MockBUIDL mockBUIDL = new MockBUIDL();
        console.log("MockBUIDL deployed at:", address(mockBUIDL));
        console.log("");
        
        // 5. Deploy MockBENJI
        console.log("4/5 Deploying MockBENJI...");
        MockBENJI mockBENJI = new MockBENJI();
        console.log("MockBENJI deployed at:", address(mockBENJI));
        console.log("");
        
        // 6. Deploy MockOUSG
        console.log("5/5 Deploying MockOUSG...");
        MockOUSG mockOUSG = new MockOUSG();
        console.log("MockOUSG deployed at:", address(mockOUSG));
        console.log("");
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        // Print summary
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("");
        console.log("Copy these addresses to your .env file:");
        console.log("");
        console.log("MOCK_USDC_ADDRESS=", address(mockUSDC));
        console.log("MOCK_BUIDL_ADDRESS=", address(mockBUIDL));
        console.log("MOCK_BENJI_ADDRESS=", address(mockBENJI));
        console.log("MOCK_OUSG_ADDRESS=", address(mockOUSG));
        console.log("MOCK_ORACLE_ADDRESS=", address(mockOracle));
        console.log("");
        console.log("Verify contracts on Snowtrace:");
        console.log("https://testnet.snowtrace.io/address/", address(mockUSDC));
        console.log("https://testnet.snowtrace.io/address/", address(mockBUIDL));
        console.log("https://testnet.snowtrace.io/address/", address(mockBENJI));
        console.log("https://testnet.snowtrace.io/address/", address(mockOUSG));
        console.log("https://testnet.snowtrace.io/address/", address(mockOracle));
    }
}