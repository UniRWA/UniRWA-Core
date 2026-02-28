// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/Orderbook.sol";

/**
 * @title DeployOrderbook
 * @notice Deploy Orderbook contract
 */
contract DeployOrderbook is Script {
    address public MOCK_USDC;
    address public COMPLIANCE_NFT;
    address public KEEPER_WALLET;
    
    Orderbook public orderbook;
    
    function run() external {
        // Load addresses
        MOCK_USDC = vm.envAddress("MOCK_USDC_ADDRESS");
        COMPLIANCE_NFT = vm.envAddress("COMPLIANCE_NFT_ADDRESS");
        KEEPER_WALLET = vm.envAddress("KEEPER_WALLET_ADDRESS");
        
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("=== DEPLOYING ORDERBOOK TO FUJI ===");
        console.log("Deployer:", deployer);
        console.log("USDC:", MOCK_USDC);
        console.log("ComplianceNFT:", COMPLIANCE_NFT);
        console.log("Keeper:", KEEPER_WALLET);
        console.log("");
        
        // Deploy Orderbook
        console.log("1/1 Deploying Orderbook...");
        orderbook = new Orderbook(
            MOCK_USDC,
            COMPLIANCE_NFT,
            KEEPER_WALLET
        );
        console.log("Orderbook deployed at:", address(orderbook));
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("");
        console.log("ORDERBOOK_ADDRESS=", address(orderbook));
        console.log("");
        console.log("Verify on Snowtrace:");
        console.log("https://testnet.snowtrace.io/address/", address(orderbook));
        console.log("");
        console.log(" SHARE THIS ADDRESS WITH DEV 1 FOR KEEPER BOT (DAY 8)");
    }
}