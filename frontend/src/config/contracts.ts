// Central ABI + address definitions for all on-chain interactions
// ABIs are defined inline (minimal, only what frontend needs)

// ─── Addresses from .env ───────────────────────────────────────────
export const ADDRESSES = {
    USDC: process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS as `0x${string}`,
    COMPLIANCE_NFT: process.env.NEXT_PUBLIC_COMPLIANCE_NFT_ADDRESS as `0x${string}`,
    HYBRID_AMM: process.env.NEXT_PUBLIC_HYBRID_AMM_ADDRESS as `0x${string}`,
    ORACLE: process.env.NEXT_PUBLIC_MOCK_ORACLE_ADDRESS as `0x${string}`,
} as const;

// ─── Pool ABI (ERC-4626 FractionalPool) ────────────────────────────
export const POOL_ABI = [
    {
        name: 'deposit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'assets', type: 'uint256' },
            { name: 'receiver', type: 'address' },
        ],
        outputs: [{ name: 'shares', type: 'uint256' }],
    },
    {
        name: 'withdraw',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'assets', type: 'uint256' },
            { name: 'receiver', type: 'address' },
            { name: 'owner', type: 'address' },
        ],
        outputs: [{ name: 'shares', type: 'uint256' }],
    },
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'totalAssets',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'totalSupply',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'poolFunded',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'threshold',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'totalDeposited',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'minDeposit',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
] as const;

// ─── ERC-20 ABI (MockUSDC) ────────────────────────────────────────
export const ERC20_ABI = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'faucet',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [],
        outputs: [],
    },
] as const;

// ─── ComplianceNFT ABI ────────────────────────────────────────────
export const COMPLIANCE_NFT_ABI = [
    {
        name: 'isVerified',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'wallet', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }],
    },
] as const;

// ─── USDC decimals (6) ────────────────────────────────────────────
export const USDC_DECIMALS = 6;
