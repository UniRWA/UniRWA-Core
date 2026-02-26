import { useReadContracts, useAccount } from 'wagmi';
import { POOL_ABI, ERC20_ABI, COMPLIANCE_NFT_ABI, ADDRESSES, USDC_DECIMALS } from '@/config/contracts';

/**
 * Batch-reads all on-chain pool data + user-specific data in one multicall.
 * Returns typed values with a refetch() for post-transaction refreshes.
 */
export function usePoolChainData(poolAddress: `0x${string}`) {
    const { address: userAddress } = useAccount();

    const contracts = [
        // Pool reads (0-4)
        { address: poolAddress, abi: POOL_ABI, functionName: 'totalAssets' },
        { address: poolAddress, abi: POOL_ABI, functionName: 'threshold' },
        { address: poolAddress, abi: POOL_ABI, functionName: 'poolFunded' },
        { address: poolAddress, abi: POOL_ABI, functionName: 'totalDeposited' },
        { address: poolAddress, abi: POOL_ABI, functionName: 'minDeposit' },
        // User-specific reads (5-8) — only if wallet connected
        ...(userAddress
            ? [
                {
                    address: poolAddress,
                    abi: POOL_ABI,
                    functionName: 'balanceOf' as const,
                    args: [userAddress] as readonly [`0x${string}`],
                },
                {
                    address: ADDRESSES.USDC,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf' as const,
                    args: [userAddress] as readonly [`0x${string}`],
                },
                {
                    address: ADDRESSES.USDC,
                    abi: ERC20_ABI,
                    functionName: 'allowance' as const,
                    args: [userAddress, poolAddress] as readonly [`0x${string}`, `0x${string}`],
                },
                {
                    address: ADDRESSES.COMPLIANCE_NFT,
                    abi: COMPLIANCE_NFT_ABI,
                    functionName: 'isVerified' as const,
                    args: [userAddress] as readonly [`0x${string}`],
                },
            ]
            : []),
    ] as const;

    const { data, isLoading, error, refetch } = useReadContracts({
        // @ts-expect-error — dynamic contracts array with conditional user reads
        contracts,
        query: {
            enabled: !!poolAddress,
            refetchInterval: 30_000, // Refresh every 30s
        },
    });

    // Extract results safely (returns undefined if call failed or not present)
    const getResult = (index: number) => {
        const item = data?.[index];
        if (!item || item.status === 'failure') return undefined;
        return item.result;
    };

    // Pool data (always available)
    const totalAssetsRaw = getResult(0) as bigint | undefined;
    const thresholdRaw = getResult(1) as bigint | undefined;
    const poolFunded = getResult(2) as boolean | undefined;
    const totalDepositedRaw = getResult(3) as bigint | undefined;
    const minDepositRaw = getResult(4) as bigint | undefined;

    // User data (only when connected)
    const userSharesRaw = getResult(5) as bigint | undefined;
    const userUsdcBalanceRaw = getResult(6) as bigint | undefined;
    const usdcAllowanceRaw = getResult(7) as bigint | undefined;
    const isKycVerified = getResult(8) as boolean | undefined;

    // Convert from USDC 6 decimals to human-readable numbers
    const toUsdc = (raw: bigint | undefined) =>
        raw !== undefined ? Number(raw) / 10 ** USDC_DECIMALS : undefined;

    return {
        // Pool state
        totalAssets: toUsdc(totalAssetsRaw),
        threshold: toUsdc(thresholdRaw),
        poolFunded: poolFunded ?? false,
        totalDeposited: toUsdc(totalDepositedRaw),
        minDeposit: toUsdc(minDepositRaw),
        minDepositRaw,

        // User state
        userShares: userSharesRaw,
        userSharesFormatted: toUsdc(userSharesRaw),
        userUsdcBalance: toUsdc(userUsdcBalanceRaw),
        userUsdcBalanceRaw,
        usdcAllowance: usdcAllowanceRaw,
        isKycVerified: isKycVerified ?? false,

        // Meta
        isLoading,
        error,
        refetch,
        isConnected: !!userAddress,
    };
}
