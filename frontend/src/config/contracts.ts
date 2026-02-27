// Central ABI + address definitions for all on-chain interactions
// ABIs are defined inline (minimal, only what frontend needs)

// ─── Addresses from .env ───────────────────────────────────────────
export const ADDRESSES = {
    USDC: process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS as `0x${string}`,
    BUIDL: process.env.NEXT_PUBLIC_MOCK_BUIDL_ADDRESS as `0x${string}`,
    BENJI: process.env.NEXT_PUBLIC_MOCK_BENJI_ADDRESS as `0x${string}`,
    OUSG: process.env.NEXT_PUBLIC_MOCK_OUSG_ADDRESS as `0x${string}`,
    COMPLIANCE_NFT: process.env.NEXT_PUBLIC_COMPLIANCE_NFT_ADDRESS as `0x${string}`,
    HYBRID_AMM: process.env.NEXT_PUBLIC_HYBRID_AMM_ADDRESS as `0x${string}`,
    ROUTER: process.env.NEXT_PUBLIC_ROUTER_ADDRESS as `0x${string}`,
    ORACLE: process.env.NEXT_PUBLIC_MOCK_ORACLE_ADDRESS as `0x${string}`,
} as const;


export const RWA_TOKENS = [
    { symbol: 'BUIDL', name: 'BlackRock BUIDL', address: ADDRESSES.BUIDL, decimals: 18 },
    { symbol: 'BENJI', name: 'Franklin BENJI', address: ADDRESSES.BENJI, decimals: 18 },
    { symbol: 'OUSG', name: 'Ondo OUSG', address: ADDRESSES.OUSG, decimals: 18 },
] as const;

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

// ─── ERC-20 ABI (MockUSDC + RWA tokens) ──────────────────────────
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


export const ROUTER_ABI = [
    {
        name: 'getBestRoute',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'rwaToken', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'isSell', type: 'bool' },
        ],
        outputs: [
            { name: 'route', type: 'uint8' },
            { name: 'expectedOut', type: 'uint256' },
        ],
    },
    {
        name: 'executeSwap',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'rwaToken', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'isSell', type: 'bool' },
            { name: 'minOut', type: 'uint256' },
        ],
        outputs: [{ name: 'actualOut', type: 'uint256' }],
    },
    {
        name: 'getRouterInfo',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            { name: 'ammAddress', type: 'address' },
            { name: 'orderbookAddress', type: 'address' },
            { name: 'largeTradeThreshold', type: 'uint256' },
        ],
    },
] as const;


export const HYBRID_AMM_ABI = [
    {
        name: 'getAmountOut',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'rwaToken', type: 'address' },
            { name: 'amountIn', type: 'uint256' },
            { name: 'isSell', type: 'bool' },
        ],
        outputs: [{ name: 'amountOut', type: 'uint256' }],
    },
    {
        name: 'getPoolInfo',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'rwaToken', type: 'address' }],
        outputs: [
            { name: 'reserveRWA', type: 'uint256' },
            { name: 'reserveUSDC', type: 'uint256' },
            { name: 'totalLP', type: 'uint256' },
            { name: 'treasuryFeesRWA', type: 'uint256' },
            { name: 'treasuryFeesUSDC', type: 'uint256' },
        ],
    },
] as const;

// ─── Constants ────────────────────────────────────────────────────
export const USDC_DECIMALS = 6;
export const RWA_DECIMALS = 18;

