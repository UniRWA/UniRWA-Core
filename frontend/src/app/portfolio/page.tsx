'use client';

import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import ProgressBar from '@/components/ProgressBar';
import StatusBadge from '@/components/StatusBadge';
import TxLink from '@/components/TxLink';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { API_BASE } from '@/config/api';
import {
    ADDRESSES,
    LIQUIDITY_MINING_ABI,
    AMM_LP_ABI,
    RWA_TOKENS,
    RWA_DECIMALS,
    ERC20_ABI,
} from '@/config/contracts';
import { useLPStake, useLPUnstake, useLPClaim } from '@/hooks/useLPStaking';
import { parseRevertReason } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types from API                                                     */
/* ------------------------------------------------------------------ */
interface PoolPosition {
    poolAddress: string;
    assetSymbol: string;
    shares: number;
    usdcValue: number;
    depositedValue: number;
    yieldEarned: number;
    status: 'filling' | 'funded';
}

interface DirectHolding {
    symbol: string;
    balance: number;
    nav: number;
    usdcValue: number;
}

interface PortfolioResponse {
    wallet: string;
    totalPortfolioValue: number;
    pools: PoolPosition[];
    directHoldings: DirectHolding[];
    stakedLP: Record<string, number>;
    pendingAVAX: number;
    openOrders: number;
}

interface HistoryEvent {
    id: number;
    type: string;
    contract: string;
    eventName: string;
    txHash: string | null;
    txLink: string | null;
    wallet: string;
    data: Record<string, unknown>;
    blockNumber: number;
    timestamp: string;
}

interface HistoryResponse {
    wallet: string;
    events: HistoryEvent[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

interface KYCStatus {
    status: string;
    nftTokenId: string | null;
    approvedAt: string | null;
}

const TYPE_BADGE_STYLES: Record<string, string> = {
    Deposit: 'bg-blue-100 text-blue-700',
    Withdraw: 'bg-amber-100 text-amber-700',
    Swap: 'bg-purple-100 text-purple-700',
    KYC: 'bg-green-100 text-green-700',
    Order: 'bg-blue-100 text-blue-700',
    Cancel: 'bg-red-100 text-red-700',
    Trade: 'bg-green-100 text-green-700',
    Stake: 'bg-indigo-100 text-indigo-700',
    Unstake: 'bg-orange-100 text-orange-700',
    Claim: 'bg-emerald-100 text-emerald-700',
    'Pool Funded': 'bg-green-100 text-green-700',
};

/* ------------------------------------------------------------------ */
/*  FractionalPool ABI (withdraw)                                      */
/* ------------------------------------------------------------------ */
const POOL_WITHDRAW_ABI = [
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
] as const;

/* ------------------------------------------------------------------ */
/*  LP Pool config for staking reads                                   */
/* ------------------------------------------------------------------ */
const LP_POOLS = RWA_TOKENS.map(t => ({
    symbol: t.symbol,
    name: `${t.symbol}/USDC AMM`,
    address: t.address as `0x${string}`,
}));

export default function PortfolioPage() {
    const { isConnected, address } = useAccount();
    const queryClient = useQueryClient();

    // Stake/unstake amount inputs per pool
    const [stakeAmounts, setStakeAmounts] = useState<Record<string, string>>({});
    const [unstakeAmounts, setUnstakeAmounts] = useState<Record<string, string>>({});
    const [activeStakePool, setActiveStakePool] = useState<string | null>(null);

    // Withdraw state
    const [withdrawingPool, setWithdrawingPool] = useState<string | null>(null);
    const [withdrawTxHash, setWithdrawTxHash] = useState<`0x${string}` | undefined>();
    const { writeContract: writeWithdraw } = useWriteContract();
    const { isSuccess: withdrawConfirmed } = useWaitForTransactionReceipt({ hash: withdrawTxHash });

    // ─── Fetch portfolio from backend API (30s polling) ──────────────
    const { data: portfolio, isLoading: portfolioLoading } = useQuery<PortfolioResponse>({
        queryKey: ['portfolio', address],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/portfolio?wallet=${address}`);
            if (!res.ok) throw new Error('Failed to fetch portfolio');
            return res.json();
        },
        enabled: !!address,
        refetchInterval: 30000,
    });

    // ─── Fetch history from backend API ──────────────────────────────
    const { data: historyData, isLoading: historyLoading } = useQuery<HistoryResponse>({
        queryKey: ['portfolio-history', address],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/portfolio/history?wallet=${address}&limit=20`);
            if (!res.ok) throw new Error('Failed to fetch history');
            return res.json();
        },
        enabled: !!address,
        refetchInterval: 30000,
    });

    // ─── Fetch KYC status from backend API ───────────────────────────
    const { data: kycData } = useQuery<KYCStatus>({
        queryKey: ['kyc-status', address],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/kyc/status?wallet=${address}`);
            if (!res.ok) throw new Error('Failed to fetch KYC status');
            return res.json();
        },
        enabled: !!address,
        staleTime: 60000,
    });

    const isKYCApproved = kycData?.status === 'approved';

    // Computed
    const pools = portfolio?.pools || [];
    const holdings = portfolio?.directHoldings || [];
    const history = historyData?.events || [];
    const totalValue = portfolio?.totalPortfolioValue || 0;
    const totalDeposited = pools.reduce((s, p) => s + p.depositedValue, 0);
    const totalYield = pools.reduce((s, p) => s + p.yieldEarned, 0);
    const yieldPct = totalDeposited > 0 ? ((totalYield / totalDeposited) * 100).toFixed(2) : '0.00';

    // Handle withdraw confirmed
    if (withdrawConfirmed && withdrawingPool) {
        toast.success('Withdrawal complete! 🎉', { description: 'USDC returned to your wallet.' });
        setWithdrawingPool(null);
        setWithdrawTxHash(undefined);
        queryClient.invalidateQueries({ queryKey: ['portfolio', address] });
    }

    // ─── Read staking data from chain ────────────────────────────────
    const stakingContracts = useMemo(() => {
        if (!address) return [];

        const contracts: Array<{
            address: `0x${string}`;
            abi: typeof LIQUIDITY_MINING_ABI | typeof AMM_LP_ABI;
            functionName: string;
            args: readonly unknown[];
        }> = [];

        // For each LP pool, read getUserInfo
        for (const pool of LP_POOLS) {
            contracts.push({
                address: ADDRESSES.LIQUIDITY_MINING,
                abi: LIQUIDITY_MINING_ABI,
                functionName: 'getUserInfo',
                args: [address, pool.address] as const,
            });
        }

        // Read pendingRewards (global)
        contracts.push({
            address: ADDRESSES.LIQUIDITY_MINING,
            abi: LIQUIDITY_MINING_ABI,
            functionName: 'pendingRewards',
            args: [address] as const,
        });

        // For each LP pool, read LP balance from AMM
        for (const pool of LP_POOLS) {
            contracts.push({
                address: ADDRESSES.HYBRID_AMM,
                abi: AMM_LP_ABI,
                functionName: 'lpBalances',
                args: [address, pool.address] as const,
            });
        }

        return contracts;
    }, [address]);

    const { data: stakingData, refetch: refetchStaking } = useReadContracts({
        contracts: stakingContracts as any, // eslint-disable-line
        query: {
            enabled: !!address && stakingContracts.length > 0,
            refetchInterval: 30000,
        },
    });

    // Parse staking data
    const stakingInfo = useMemo(() => {
        if (!stakingData || !address) {
            return LP_POOLS.map(pool => ({
                ...pool,
                staked: 0,
                totalUserStake: 0,
                pending: 0,
                lpBalance: 0,
            }));
        }

        const poolCount = LP_POOLS.length;

        return LP_POOLS.map((pool, i) => {
            const userInfoResult = stakingData[i]?.result as readonly [bigint, bigint, bigint, bigint] | undefined;
            const staked = userInfoResult ? Number(userInfoResult[0]) / 1e18 : 0;
            const totalUserStake = userInfoResult ? Number(userInfoResult[1]) / 1e18 : 0;
            const pending = userInfoResult ? Number(userInfoResult[2]) / 1e18 : 0;

            const lpBalResult = stakingData[poolCount + 1 + i]?.result as bigint | undefined;
            const lpBalance = lpBalResult ? Number(lpBalResult) / 1e18 : 0;

            return { ...pool, staked, totalUserStake, pending, lpBalance };
        });
    }, [stakingData, address]);

    // Global pending rewards
    const globalPending = useMemo(() => {
        if (!stakingData || !address) return 0;
        const poolCount = LP_POOLS.length;
        const pendingResult = stakingData[poolCount]?.result as bigint | undefined;
        return pendingResult ? Number(pendingResult) / 1e18 : 0;
    }, [stakingData, address]);

    // ─── Staking hooks ───────────────────────────────────────────────
    const stakeHook = useLPStake(() => { refetchStaking(); setStakeAmounts({}); setActiveStakePool(null); });
    const unstakeHook = useLPUnstake(() => { refetchStaking(); setUnstakeAmounts({}); setActiveStakePool(null); });
    const claimHook = useLPClaim(() => { refetchStaking(); });

    const handleStake = (pool: typeof LP_POOLS[0]) => {
        const amt = parseFloat(stakeAmounts[pool.symbol] || '0');
        if (amt <= 0) return;
        stakeHook.stake(pool.address, BigInt(Math.round(amt * 10 ** RWA_DECIMALS)));
    };

    const handleUnstake = (pool: typeof LP_POOLS[0]) => {
        const amt = parseFloat(unstakeAmounts[pool.symbol] || '0');
        if (amt <= 0) return;
        unstakeHook.unstake(pool.address, BigInt(Math.round(amt * 10 ** RWA_DECIMALS)));
    };

    const handleClaim = () => { claimHook.claimRewards(); };

    // ─── Withdraw handler ────────────────────────────────────────────
    const handleWithdraw = (poolAddress: string, usdcValue: number) => {
        if (!address) return;
        setWithdrawingPool(poolAddress);
        const rawAssets = BigInt(Math.round(usdcValue * 1e6)); // USDC 6 decimals

        writeWithdraw(
            {
                address: poolAddress as `0x${string}`,
                abi: POOL_WITHDRAW_ABI,
                functionName: 'withdraw',
                args: [rawAssets, address, address],
            },
            {
                onSuccess: (hash) => { setWithdrawTxHash(hash); },
                onError: (err) => {
                    setWithdrawingPool(null);
                    toast.error('Withdraw failed', { description: parseRevertReason(err) });
                },
            }
        );
    };

    // ─── Date formatter ──────────────────────────────────────────────
    const formatDate = (ts: string) => {
        try {
            return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch { return ts; }
    };

    const loading = portfolioLoading && !portfolio;

    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex items-center gap-3 mb-8"
                >
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900">Portfolio</h1>
                    {isConnected && (
                        isKYCApproved ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                                ✅ KYC Verified
                            </span>
                        ) : (
                            <Link
                                href="/kyc"
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                            >
                                ⚠️ Verify Now →
                            </Link>
                        )
                    )}
                </motion.div>

                {/* Total Value Hero Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.05 }}
                    className="rounded-2xl p-8 md:p-10 mb-10 relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, #0A0A0E 0%, #24242E 100%)' }}
                >
                    <div
                        className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none"
                        style={{ background: 'radial-gradient(circle, rgba(255,92,22,0.1) 0%, transparent 70%)', filter: 'blur(40px)' }}
                    />
                    <div className="relative z-10">
                        {!isConnected ? (
                            <p className="text-white/40 text-sm">Connect wallet to view your portfolio</p>
                        ) : loading ? (
                            <>
                                <Skeleton className="h-4 w-36 bg-white/10 mb-3" />
                                <Skeleton className="h-14 w-48 bg-white/10 mb-3" />
                                <Skeleton className="h-4 w-64 bg-white/10" />
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-white/40 uppercase tracking-wider mb-2">Total Portfolio Value</p>
                                <p
                                    className="text-4xl md:text-6xl font-black mb-2"
                                    style={{
                                        background: 'linear-gradient(135deg, #FF5C16, #FFA680, #D075FF)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                    }}
                                >
                                    ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-white/50 text-sm">
                                    {totalDeposited > 0 && (
                                        <>
                                            Deposited ${totalDeposited.toLocaleString('en-US', { minimumFractionDigits: 0 })} · Yield{' '}
                                            <span className="text-green-400">+${totalYield.toFixed(0)} (+{yieldPct}%)</span>
                                        </>
                                    )}
                                    {portfolio?.openOrders ? ` · ${portfolio.openOrders} open orders` : ''}
                                </p>
                            </>
                        )}
                    </div>
                </motion.div>

                {/* Pool Positions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="mb-8"
                >
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Pool Positions</h2>
                    {!isConnected ? (
                        <div className="bg-white rounded-2xl p-6 shadow-md text-center text-gray-400 text-sm">
                            Connect wallet to view pool positions
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {loading ? (
                                [1, 2].map((n) => (
                                    <div key={n} className="bg-white rounded-2xl p-6 shadow-md">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <Skeleton className="h-5 w-32 mb-1" />
                                                <Skeleton className="h-3 w-20" />
                                            </div>
                                            <Skeleton className="h-5 w-16 rounded-full" />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            {[1, 2, 3].map((m) => (
                                                <div key={m}>
                                                    <Skeleton className="h-3 w-14 mb-1" />
                                                    <Skeleton className="h-4 w-16" />
                                                </div>
                                            ))}
                                        </div>
                                        <Skeleton className="h-3 w-full rounded-full" />
                                    </div>
                                ))
                            ) : pools.length === 0 ? (
                                <div className="col-span-2 bg-white rounded-2xl p-6 shadow-md text-center text-gray-400 text-sm">
                                    No pool positions yet
                                </div>
                            ) : (
                                pools.map((pos) => (
                                    <div key={pos.poolAddress} className="bg-white rounded-2xl p-6 shadow-md">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="font-bold text-gray-900">{pos.assetSymbol} Pool #1</h3>
                                                <p className="text-sm text-gray-400">{pos.shares.toLocaleString()} shares</p>
                                            </div>
                                            <StatusBadge status={pos.status} />
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase tracking-wider">Deposited</p>
                                                <p className="text-sm font-semibold text-gray-900">${pos.depositedValue.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase tracking-wider">Current</p>
                                                <p className="text-sm font-semibold text-gray-900">${pos.usdcValue.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase tracking-wider">Yield</p>
                                                <p
                                                    className="text-sm font-bold"
                                                    style={{
                                                        background: 'linear-gradient(135deg, #FF5C16, #D075FF)',
                                                        WebkitBackgroundClip: 'text',
                                                        WebkitTextFillColor: 'transparent',
                                                        backgroundClip: 'text',
                                                    }}
                                                >
                                                    +${pos.yieldEarned}
                                                </p>
                                            </div>
                                        </div>

                                        {pos.status === 'filling' && pos.usdcValue > 0 && (
                                            <div className="mb-4">
                                                <ProgressBar filled={pos.usdcValue} threshold={pos.usdcValue * 10} showLabel />
                                            </div>
                                        )}

                                        {pos.status === 'funded' && pos.usdcValue > 0 && (
                                            <button
                                                onClick={() => handleWithdraw(pos.poolAddress, pos.usdcValue)}
                                                disabled={withdrawingPool === pos.poolAddress}
                                                className="w-full py-2.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                            >
                                                {withdrawingPool === pos.poolAddress ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <Loader2 size={14} className="animate-spin" />
                                                        Withdrawing...
                                                    </span>
                                                ) : (
                                                    'Withdraw'
                                                )}
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </motion.div>

                {/* Direct Holdings */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.15 }}
                    className="mb-8"
                >
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Direct Holdings</h2>
                    <div className="bg-white rounded-2xl shadow-md overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Asset</th>
                                    <th className="text-right px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Amount</th>
                                    <th className="text-right px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">NAV</th>
                                    <th className="text-right px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!isConnected ? (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">Connect wallet</td></tr>
                                ) : loading ? (
                                    [1, 2].map((n) => (
                                        <tr key={n} className="border-b border-gray-50">
                                            <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                                            <td className="px-6 py-4 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                                            <td className="px-6 py-4 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                                            <td className="px-6 py-4 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : holdings.length === 0 ? (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No holdings</td></tr>
                                ) : (
                                    holdings.map((h) => (
                                        <tr key={h.symbol} className="border-b border-gray-50">
                                            <td className="px-6 py-4 font-semibold text-gray-900">{h.symbol}</td>
                                            <td className="px-6 py-4 text-right text-gray-700">{h.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                                            <td className="px-6 py-4 text-right text-gray-500">${h.nav.toFixed(4)}</td>
                                            <td className="px-6 py-4 text-right font-semibold text-gray-900">${h.usdcValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* LP Staking — WIRED WITH ON-CHAIN DATA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mb-8"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900">LP Staking</h2>
                        {isConnected && globalPending > 0 && (
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-500">
                                    Pending:{' '}
                                    <span
                                        className="font-bold"
                                        style={{
                                            background: 'linear-gradient(135deg, #FF5C16, #D075FF)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            backgroundClip: 'text',
                                        }}
                                    >
                                        {globalPending.toFixed(6)} AVAX
                                    </span>
                                </span>
                                <button
                                    onClick={handleClaim}
                                    disabled={claimHook.state === 'claiming' || claimHook.state === 'waitingClaim'}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                                    style={{ background: 'linear-gradient(135deg, #FF5C16, #FF8A50)' }}
                                >
                                    {claimHook.state === 'claiming' || claimHook.state === 'waitingClaim' ? (
                                        <span className="flex items-center gap-1"><Loader2 size={14} className="animate-spin" />Claiming...</span>
                                    ) : claimHook.state === 'success' ? (
                                        <span className="flex items-center gap-1"><CheckCircle2 size={14} />Claimed!</span>
                                    ) : 'Claim AVAX'}
                                </button>
                            </div>
                        )}
                    </div>

                    {claimHook.state === 'error' && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                            <p className="text-xs text-red-700">{claimHook.errorMessage}</p>
                            <button onClick={claimHook.reset} className="text-xs text-red-500 underline mt-1">Dismiss</button>
                        </div>
                    )}

                    {!isConnected ? (
                        <div className="bg-white rounded-2xl p-6 shadow-md text-center text-sm text-gray-400">
                            Connect wallet to view LP staking
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {stakingInfo.map((pool) => (
                                <div key={pool.symbol} className="bg-white rounded-2xl p-6 shadow-md">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h3 className="font-bold text-gray-900 mb-1">{pool.name}</h3>
                                            <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
                                                <div>
                                                    <span className="text-gray-400">Staked: </span>
                                                    <span className="font-semibold text-gray-900">{pool.staked > 0 ? pool.staked.toFixed(4) : '0'} LP</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">Available: </span>
                                                    <span className="font-semibold text-gray-900">{pool.lpBalance > 0 ? pool.lpBalance.toFixed(4) : '0'} LP</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">Pending: </span>
                                                    <span className="font-bold" style={{
                                                        background: 'linear-gradient(135deg, #FF5C16, #D075FF)',
                                                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                                                    }}>
                                                        {pool.pending > 0 ? pool.pending.toFixed(6) : '0'} AVAX
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setActiveStakePool(activeStakePool === `stake-${pool.symbol}` ? null : `stake-${pool.symbol}`)}
                                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                                                style={{ background: 'linear-gradient(135deg, #FF5C16, #FF8A50)' }}
                                            >Stake</button>
                                            {pool.staked > 0 && (
                                                <button
                                                    onClick={() => setActiveStakePool(activeStakePool === `unstake-${pool.symbol}` ? null : `unstake-${pool.symbol}`)}
                                                    className="px-4 py-2 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                                                >Unstake</button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stake form */}
                                    {activeStakePool === `stake-${pool.symbol}` && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t border-gray-100">
                                            <div className="flex items-end gap-3">
                                                <div className="flex-1">
                                                    <div className="flex justify-between mb-1">
                                                        <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">Amount to Stake</label>
                                                        <button onClick={() => setStakeAmounts(prev => ({ ...prev, [pool.symbol]: String(pool.lpBalance) }))} className="text-xs text-orange-500 hover:text-orange-600 font-medium">MAX ({pool.lpBalance.toFixed(2)})</button>
                                                    </div>
                                                    <input type="text" value={stakeAmounts[pool.symbol] || ''} onChange={(e) => setStakeAmounts(prev => ({ ...prev, [pool.symbol]: e.target.value }))} placeholder="0" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 font-mono outline-none focus:ring-2 focus:ring-brand-orange/30" />
                                                </div>
                                                <button onClick={() => handleStake(pool)} disabled={stakeHook.state === 'staking' || stakeHook.state === 'waitingStake' || !stakeAmounts[pool.symbol] || parseFloat(stakeAmounts[pool.symbol] || '0') <= 0} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all" style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}>
                                                    {stakeHook.state === 'staking' || stakeHook.state === 'waitingStake' ? (<span className="flex items-center gap-1"><Loader2 size={14} className="animate-spin" />Staking...</span>) : 'Confirm Stake'}
                                                </button>
                                            </div>
                                            {stakeHook.state === 'error' && <p className="text-xs text-red-500 mt-2">{stakeHook.errorMessage}</p>}
                                        </motion.div>
                                    )}

                                    {/* Unstake form */}
                                    {activeStakePool === `unstake-${pool.symbol}` && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t border-gray-100">
                                            <div className="flex items-end gap-3">
                                                <div className="flex-1">
                                                    <div className="flex justify-between mb-1">
                                                        <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">Amount to Unstake</label>
                                                        <button onClick={() => setUnstakeAmounts(prev => ({ ...prev, [pool.symbol]: String(pool.staked) }))} className="text-xs text-orange-500 hover:text-orange-600 font-medium">MAX ({pool.staked.toFixed(2)})</button>
                                                    </div>
                                                    <input type="text" value={unstakeAmounts[pool.symbol] || ''} onChange={(e) => setUnstakeAmounts(prev => ({ ...prev, [pool.symbol]: e.target.value }))} placeholder="0" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 font-mono outline-none focus:ring-2 focus:ring-brand-orange/30" />
                                                </div>
                                                <button onClick={() => handleUnstake(pool)} disabled={unstakeHook.state === 'staking' || unstakeHook.state === 'waitingStake' || !unstakeAmounts[pool.symbol] || parseFloat(unstakeAmounts[pool.symbol] || '0') <= 0} className="px-5 py-2.5 rounded-xl text-sm font-semibold border-2 border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
                                                    {unstakeHook.state === 'staking' || unstakeHook.state === 'waitingStake' ? (<span className="flex items-center gap-1"><Loader2 size={14} className="animate-spin" />Unstaking...</span>) : 'Confirm Unstake'}
                                                </button>
                                            </div>
                                            {unstakeHook.state === 'error' && <p className="text-xs text-red-500 mt-2">{unstakeHook.errorMessage}</p>}
                                        </motion.div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Transaction History */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                >
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Transaction History</h2>
                    <div className="bg-white rounded-2xl shadow-md overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Type</th>
                                    <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Contract</th>
                                    <th className="text-right px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Date</th>
                                    <th className="text-right px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Tx</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!isConnected ? (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">Connect wallet to view history</td></tr>
                                ) : historyLoading ? (
                                    [1, 2, 3].map(n => (
                                        <tr key={n} className="border-b border-gray-50">
                                            <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                                            <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                                            <td className="px-6 py-4 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                                            <td className="px-6 py-4 text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : history.length === 0 ? (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No transactions yet</td></tr>
                                ) : (
                                    history.map((h) => (
                                        <tr key={h.id} className="border-b border-gray-50">
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_BADGE_STYLES[h.type] || 'bg-gray-100 text-gray-700'}`}>
                                                    {h.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 font-mono text-xs">
                                                {h.contract || '—'}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-400">{formatDate(h.timestamp)}</td>
                                            <td className="px-6 py-4 text-right">
                                                {h.txHash ? (
                                                    <TxLink txHash={h.txHash} label={`${h.txHash.slice(0, 8)}…`} />
                                                ) : (
                                                    <span className="text-xs text-gray-300">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
