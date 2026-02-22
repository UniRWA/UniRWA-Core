// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IChainlinkOracle
 * @notice Interface matching Chainlink's AggregatorV3Interface
 * @dev KEEP THIS IDENTICAL to Chainlink's interface for mainnet compatibility
 * On mainnet, we swap MockOracle address for real Chainlink feed - zero code changes
 */
interface IChainlinkOracle {
    /**
     * @notice Get latest price data
     * @return roundId The round ID
     * @return answer The price (in 8 decimals for Chainlink compatibility)
     * @return startedAt Timestamp when the round started
     * @return updatedAt Timestamp when the round was updated
     * @return answeredInRound The round ID when the answer was computed
     */
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
    
    /**
     * @notice Get the number of decimals in the price feed
     * @return Decimals (typically 8 for Chainlink)
     */
    function decimals() external view returns (uint8);
    
    /**
     * @notice Get description of the price feed
     * @return Description string
     */
    function description() external view returns (string memory);
}