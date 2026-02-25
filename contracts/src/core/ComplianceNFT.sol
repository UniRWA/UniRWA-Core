// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ComplianceNFT
 * @notice Soulbound NFT for KYC verification
 * @dev Non-transferable token proving user has completed KYC
 * 
 * CRITICAL: This is soulbound - transfers are blocked after mint
 * OZ 5.x uses _update() instead of _beforeTokenTransfer()
 */
contract ComplianceNFT is ERC721, Ownable {
    // Auto-incrementing token ID
    uint256 private _tokenIdCounter;
    
    // Store KYC reference (e.g., Persona inquiry ID)
    mapping(address => string) private _kycRefs;
    
    /**
     * @notice Initialize ComplianceNFT
     */
    constructor() 
        ERC721("UniRWA Compliance", "UKYC") 
        Ownable(msg.sender) 
    {}
    
    /**
     * @notice Mint ComplianceNFT to user (only backend hot wallet)
     * @param to User wallet address
     * @param kycRef KYC reference ID (e.g., Persona inquiry ID)
     * @dev Prevents double-minting to same address
     */
    function mint(address to, string calldata kycRef) external onlyOwner {
        require(balanceOf(to) == 0, "Already verified");
        require(bytes(kycRef).length > 0, "KYC reference required");
        
        _kycRefs[to] = kycRef;
        _mint(to, _tokenIdCounter);
        _tokenIdCounter++;
    }
    
    /**
     * @notice Check if wallet is KYC verified
     * @param wallet Address to check
     * @return True if wallet holds ComplianceNFT
     */
    function isVerified(address wallet) external view returns (bool) {
        return balanceOf(wallet) > 0;
    }
    
    /**
     * @notice Get KYC reference for wallet
     * @param wallet Address to check
     * @return KYC reference string
     */
    function getKYCRef(address wallet) external view returns (string memory) {
        require(balanceOf(wallet) > 0, "Not verified");
        return _kycRefs[wallet];
    }
    
    /**
     * @notice Override _update to make token soulbound
     * @dev Blocks all transfers except minting
     * 
     * CRITICAL: OZ 5.x changed from _beforeTokenTransfer() to _update()
     * This is the most common OZ 5.x upgrade mistake!
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Allow minting (from == address(0))
        // Block all other transfers
        require(from == address(0), "Soulbound: non-transferable");
        
        return super._update(to, tokenId, auth);
    }
}