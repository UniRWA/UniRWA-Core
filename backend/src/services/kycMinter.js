const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { avalancheFuji } = require('viem/chains');

const COMPLIANCE_NFT_ABI = [
    {
        name: 'mint',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'kycRef', type: 'string' },
        ],
        outputs: [],
    },
    {
        name: 'isVerified',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'wallet', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
];

const account = privateKeyToAccount(process.env.BACKEND_HOT_WALLET_PRIVATE_KEY);

const walletClient = createWalletClient({
    account,
    chain: avalancheFuji,
    transport: http(process.env.FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc'),
});

const publicClient = createPublicClient({
    chain: avalancheFuji,
    transport: http(process.env.FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc'),
});

const complianceNFTAddress = process.env.COMPLIANCE_NFT_ADDRESS;

async function mintComplianceNFT(wallet, inquiryId) {
    if (!complianceNFTAddress) {
        console.error('[KYC Minter] COMPLIANCE_NFT_ADDRESS not set');
        return { success: false, error: 'COMPLIANCE_NFT_ADDRESS not configured' };
    }

    try {
        const isAlreadyVerified = await publicClient.readContract({
            address: complianceNFTAddress,
            abi: COMPLIANCE_NFT_ABI,
            functionName: 'isVerified',
            args: [wallet],
        });

        if (isAlreadyVerified) {
            console.log(`[KYC Minter] Wallet ${wallet} already has ComplianceNFT — skipping mint`);
            return { success: true, txHash: null, alreadyVerified: true };
        }

        console.log(`[KYC Minter] Minting ComplianceNFT to ${wallet} (ref: ${inquiryId})...`);

        const txHash = await walletClient.writeContract({
            address: complianceNFTAddress,
            abi: COMPLIANCE_NFT_ABI,
            functionName: 'mint',
            args: [wallet, inquiryId],
        });

        console.log(`[KYC Minter] Tx submitted: ${txHash}`);

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        if (receipt.status === 'success') {
            console.log(`[KYC Minter] ✅ ComplianceNFT minted to ${wallet} — tx: ${txHash}`);
            return { success: true, txHash };
        } else {
            console.error(`[KYC Minter] ❌ Tx reverted: ${txHash}`);
            return { success: false, txHash, error: 'Transaction reverted' };
        }
    } catch (err) {
        console.error(`[KYC Minter] ❌ Failed to mint:`, err.message);
        return { success: false, error: err.message };
    }
}

module.exports = { mintComplianceNFT };
