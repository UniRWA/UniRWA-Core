// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/LiquidityMining.sol";

contract DeployLiquidityMining is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address hybridAMM = vm.envAddress("HYBRID_AMM_ADDRESS");
        address complianceNFT = vm.envAddress("COMPLIANCE_NFT_ADDRESS");

        console.log("=== Deploying LiquidityMining ===");
        console.log("HybridAMM:", hybridAMM);
        console.log("ComplianceNFT:", complianceNFT);

        vm.startBroadcast(deployerKey);

        LiquidityMining mining = new LiquidityMining(
            hybridAMM,
            complianceNFT,
            1e15
        );

        console.log("LiquidityMining deployed at:", address(mining));

        (bool success, ) = address(mining).call{value: 1 ether}("");
        require(success, "Failed to fund LiquidityMining with AVAX");
        console.log("Funded with 1 AVAX");

        console.log("avaxPerSecond:", mining.avaxPerSecond());
        console.log("Contract AVAX balance:", address(mining).balance);

        vm.stopBroadcast();

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("LIQUIDITY_MINING_ADDRESS=", address(mining));
    }
}
