// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IComplianceNFT
 * @notice Interface for KYC compliance checking
 * @dev Used by FractionalPool to gate deposits
 */
interface IComplianceNFT {
    /**
     * @notice Check if an address has passed KYC
     * @param wallet Address to check
     * @return True if wallet holds a ComplianceNFT (is verified)
     */
    function isVerified(address wallet) external view returns (bool);
}