// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/Router.sol";

/**
 * @title DeployRouter
 * @notice Deploy Router contract
 */
contract DeployRouter is Script {
    address public HYBRID_AMM;
    
    Router public router;
    
    function run() external {
        // Load AMM address
        HYBRID_AMM = vm.envAddress("HYBRID_AMM_ADDRESS");
        
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("=== DEPLOYING ROUTER TO FUJI ===");
        console.log("Deployer:", deployer);
        console.log("HybridAMM:", HYBRID_AMM);
        console.log("");
        
        // Deploy Router
        console.log("1/1 Deploying Router...");
        router = new Router(HYBRID_AMM);
        console.log("Router deployed at:", address(router));
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("");
        console.log("ROUTER_ADDRESS=", address(router));
        console.log("");
        console.log("Verify on Snowtrace:");
        console.log("https://testnet.snowtrace.io/address/", address(router));
        console.log("");
        console.log("Share this address with Dev 2 immediately!");
    }
}