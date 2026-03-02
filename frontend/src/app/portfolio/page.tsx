'use client';

import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { Loader2, CheckCircle2 } from 'lucide-react';
import ProgressBar from '@/components/ProgressBar';
import StatusBadge from '@/components/StatusBadge';
import TxLink from '@/components/TxLink';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ADDRESSES,
    LIQUIDITY_MINING_ABI,
    AMM_LP_ABI,
    RWA_TOKENS,
    RWA_DECIMALS,
} from '@/config/contracts';
import { useLPStake, useLPUnstake, useLPClaim } from '@/hooks/useLPStaking';

/* ------------------------------------------------------------------ */
/*  Hardcoded data (pools, holdings, history — not wired today)        */
/* ------------------------------------------------------------------ */
const POOLS_POS = [
    { pool: 'BUIDL Pool #1', asset: 'BUIDL', deposited: 1000, value: 1023, yield: 23, shares: 950, status: 'filling' as const, filled: 5000, threshold: 50000 },
    { pool: 'BENJI Pool #1', asset: 'BENJI', deposited: 2000, value: 2049, yield: 49, shares: 1910, status: 'funded' as const, filled: 50000, threshold: 50000 },
];

const HOLDINGS = [
    { asset: 'OUSG', amount: 500, nav: 1.0023, value: 501.15 },
    { asset: 'USDC', amount: 8765, nav: 1.0, value: 8765 },
];

const HISTORY = [
    { type: 'Deposit', asset: 'BUIDL Pool', amount: '+$1,000', date: 'Feb 22, 2026', tx: '0x1234abcd5678ef90' },
    { type: 'Deposit', asset: 'BENJI Pool', amount: '+$2,000', date: 'Feb 21, 2026', tx: '0xabcdef0123456789' },
    { type: 'Swap', asset: 'BUIDL → USDC', amount: '+$502', date: 'Feb 20, 2026', tx: '0x9876543210abcdef' },
    { type: 'KYC', asset: 'ComplianceNFT', amount: 'Minted', date: 'Feb 19, 2026', tx: '0xdeadbeef12345678' },
];

const TYPE_BADGE_STYLES: Record<string, string> = {
    Deposit: 'bg-blue-100 text-blue-700',
    Swap: 'bg-purple-100 text-purple-700',
    KYC: 'bg-green-100 text-green-700',
};

const totalValue = POOLS_POS.reduce((s, p) => s + p.value, 0) + HOLDINGS.reduce((s, h) => s + h.value, 0);
const totalDeposited = POOLS_POS.reduce((s, p) => s + p.deposited, 0) + HOLDINGS.reduce((s, h) => s + h.amount * h.nav, 0);
const totalYield = totalValue - totalDeposited;
const yieldPct = ((totalYield / totalDeposited) * 100).toFixed(2);

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
    const [loading, setLoading] = useState(true);

    // Stake/unstake amount inputs per pool
    const [stakeAmounts, setStakeAmounts] = useState<Record<string, string>>({});
    const [unstakeAmounts, setUnstakeAmounts] = useState<Record<string, string>>({});
    const [activeStakePool, setActiveStakePool] = useState<string | null>(null);

    // Simulate initial loading for non-chain data
    useState(() => {
        const timer = setTimeout(() => setLoading(false), 1500);
        return () => clearTimeout(timer);
    });

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
            refetchInterval: 30000, // refresh every 30s for pending rewards
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
            // getUserInfo result: [staked, totalUserStake, pending, lastTime]
            const userInfoResult = stakingData[i]?.result as readonly [bigint, bigint, bigint, bigint] | undefined;
            const staked = userInfoResult ? Number(userInfoResult[0]) / 1e18 : 0;
            const totalUserStake = userInfoResult ? Number(userInfoResult[1]) / 1e18 : 0;
            const pending = userInfoResult ? Number(userInfoResult[2]) / 1e18 : 0;

            // LP balance from AMM
            const lpBalResult = stakingData[poolCount + 1 + i]?.result as bigint | undefined;
            const lpBalance = lpBalResult ? Number(lpBalResult) / 1e18 : 0;

            return {
                ...pool,
                staked,
                totalUserStake,
                pending,
                lpBalance,
            };
        });
    }, [stakingData, address]);

    // Global pending rewards
    const globalPending = useMemo(() => {
        if (!stakingData || !address) return 0;
        const poolCount = LP_POOLS.length;
        const pendingResult = stakingData[poolCount]?.result as bigint | undefined;
        return pendingResult ? Number(pendingResult) / 1e18 : 0;
    }, [stakingData, address]);

    const totalStaked = stakingInfo.reduce((s, p) => s + p.staked, 0);
    const hasAnyStake = totalStaked > 0;

    // ─── Staking hooks ───────────────────────────────────────────────
    const stakeHook = useLPStake(() => {
        refetchStaking();
        setStakeAmounts({});
        setActiveStakePool(null);
    });
    const unstakeHook = useLPUnstake(() => {
        refetchStaking();
        setUnstakeAmounts({});
        setActiveStakePool(null);
    });
    const claimHook = useLPClaim(() => {
        refetchStaking();
    });

    // ─── Handlers ────────────────────────────────────────────────────
    const handleStake = (pool: typeof LP_POOLS[0]) => {
        const amt = parseFloat(stakeAmounts[pool.symbol] || '0');
        if (amt <= 0) return;
        const rawAmount = BigInt(Math.round(amt * 10 ** RWA_DECIMALS));
        stakeHook.stake(pool.address, rawAmount);
    };

    const handleUnstake = (pool: typeof LP_POOLS[0]) => {
        const amt = parseFloat(unstakeAmounts[pool.symbol] || '0');
        if (amt <= 0) return;
        const rawAmount = BigInt(Math.round(amt * 10 ** RWA_DECIMALS));
        unstakeHook.unstake(pool.address, rawAmount);
    };

    const handleClaim = () => {
        claimHook.claimRewards();
    };

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
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                        ✅ KYC Verified
                    </span>
                </motion.div>

                {/* Total Value Hero Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.05 }}
                    className="rounded-2xl p-8 md:p-10 mb-10 relative overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, #0A0A0E 0%, #24242E 100%)',
                    }}
                >
                    <div
                        className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none"
                        style={{
                            background: 'radial-gradient(circle, rgba(255,92,22,0.1) 0%, transparent 70%)',
                            filter: 'blur(40px)',
                        }}
                    />
                    <div className="relative z-10">
                        {loading ? (
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
                                    ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                </p>
                                <p className="text-white/50 text-sm">
                                    Deposited ${totalDeposited.toLocaleString('en-US', { minimumFractionDigits: 0 })} · Yield{' '}
                                    <span className="text-green-400">+${totalYield.toFixed(0)} (+{yieldPct}%)</span>
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
                        ) : (
                            POOLS_POS.map((pos) => (
                                <div key={pos.pool} className="bg-white rounded-2xl p-6 shadow-md">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="font-bold text-gray-900">{pos.pool}</h3>
                                            <p className="text-sm text-gray-400">{pos.shares.toLocaleString()} shares</p>
                                        </div>
                                        <StatusBadge status={pos.status} />
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-wider">Deposited</p>
                                            <p className="text-sm font-semibold text-gray-900">${pos.deposited.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-wider">Current</p>
                                            <p className="text-sm font-semibold text-gray-900">${pos.value.toLocaleString()}</p>
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
                                                +${pos.yield}
                                            </p>
                                        </div>
                                    </div>

                                    {pos.status === 'filling' && (
                                        <div className="mb-4">
                                            <ProgressBar filled={pos.filled} threshold={pos.threshold} showLabel />
                                        </div>
                                    )}

                                    {pos.status === 'funded' && (
                                        <button
                                            className="w-full py-2.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            Withdraw
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
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
                                {loading ? (
                                    [1, 2].map((n) => (
                                        <tr key={n} className="border-b border-gray-50">
                                            <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                                            <td className="px-6 py-4 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                                            <td className="px-6 py-4 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                                            <td className="px-6 py-4 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : (
                                    HOLDINGS.map((h) => (
                                        <tr key={h.asset} className="border-b border-gray-50">
                                            <td className="px-6 py-4 font-semibold text-gray-900">{h.asset}</td>
                                            <td className="px-6 py-4 text-right text-gray-700">{h.amount.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right text-gray-500">${h.nav.toFixed(4)}</td>
                                            <td className="px-6 py-4 text-right font-semibold text-gray-900">${h.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
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
                                    style={{
                                        background: 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                                    }}
                                >
                                    {claimHook.state === 'claiming' || claimHook.state === 'waitingClaim' ? (
                                        <span className="flex items-center gap-1">
                                            <Loader2 size={14} className="animate-spin" />
                                            Claiming...
                                        </span>
                                    ) : claimHook.state === 'success' ? (
                                        <span className="flex items-center gap-1">
                                            <CheckCircle2 size={14} />
                                            Claimed!
                                        </span>
                                    ) : (
                                        'Claim AVAX'
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Claim error */}
                    {claimHook.state === 'error' && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                            <p className="text-xs text-red-700">{claimHook.errorMessage}</p>
                            <button onClick={claimHook.reset} className="text-xs text-red-500 underline mt-1">
                                Dismiss
                            </button>
                        </div>
                    )}

                    {!isConnected ? (
                        <div className="bg-white rounded-2xl p-6 shadow-md">
                            <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                                Connect wallet to view LP staking
                            </div>
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
                                                    <span className="font-semibold text-gray-900">
                                                        {pool.staked > 0 ? pool.staked.toFixed(4) : '0'} LP
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">Available: </span>
                                                    <span className="font-semibold text-gray-900">
                                                        {pool.lpBalance > 0 ? pool.lpBalance.toFixed(4) : '0'} LP
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">Pending: </span>
                                                    <span
                                                        className="font-bold"
                                                        style={{
                                                            background: 'linear-gradient(135deg, #FF5C16, #D075FF)',
                                                            WebkitBackgroundClip: 'text',
                                                            WebkitTextFillColor: 'transparent',
                                                            backgroundClip: 'text',
                                                        }}
                                                    >
                                                        {pool.pending > 0 ? pool.pending.toFixed(6) : '0'} AVAX
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setActiveStakePool(
                                                    activeStakePool === `stake-${pool.symbol}` ? null : `stake-${pool.symbol}`
                                                )}
                                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                                                style={{
                                                    background: 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                                                }}
                                            >
                                                Stake
                                            </button>
                                            {pool.staked > 0 && (
                                                <button
                                                    onClick={() => setActiveStakePool(
                                                        activeStakePool === `unstake-${pool.symbol}` ? null : `unstake-${pool.symbol}`
                                                    )}
                                                    className="px-4 py-2 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                                                >
                                                    Unstake
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stake form */}
                                    {activeStakePool === `stake-${pool.symbol}` && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="mt-4 pt-4 border-t border-gray-100"
                                        >
                                            <div className="flex items-end gap-3">
                                                <div className="flex-1">
                                                    <div className="flex justify-between mb-1">
                                                        <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                                                            Amount to Stake
                                                        </label>
                                                        <button
                                                            onClick={() => setStakeAmounts(prev => ({
                                                                ...prev,
                                                                [pool.symbol]: String(pool.lpBalance)
                                                            }))}
                                                            className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                                                        >
                                                            MAX ({pool.lpBalance.toFixed(2)})
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={stakeAmounts[pool.symbol] || ''}
                                                        onChange={(e) => setStakeAmounts(prev => ({
                                                            ...prev,
                                                            [pool.symbol]: e.target.value
                                                        }))}
                                                        placeholder="0"
                                                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 font-mono outline-none focus:ring-2 focus:ring-brand-orange/30"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleStake(pool)}
                                                    disabled={
                                                        stakeHook.state === 'staking' ||
                                                        stakeHook.state === 'waitingStake' ||
                                                        !stakeAmounts[pool.symbol] ||
                                                        parseFloat(stakeAmounts[pool.symbol] || '0') <= 0
                                                    }
                                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                                                    style={{
                                                        background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                                                    }}
                                                >
                                                    {stakeHook.state === 'staking' || stakeHook.state === 'waitingStake' ? (
                                                        <span className="flex items-center gap-1">
                                                            <Loader2 size={14} className="animate-spin" />
                                                            Staking...
                                                        </span>
                                                    ) : (
                                                        'Confirm Stake'
                                                    )}
                                                </button>
                                            </div>
                                            {stakeHook.state === 'error' && (
                                                <p className="text-xs text-red-500 mt-2">{stakeHook.errorMessage}</p>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* Unstake form */}
                                    {activeStakePool === `unstake-${pool.symbol}` && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="mt-4 pt-4 border-t border-gray-100"
                                        >
                                            <div className="flex items-end gap-3">
                                                <div className="flex-1">
                                                    <div className="flex justify-between mb-1">
                                                        <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                                                            Amount to Unstake
                                                        </label>
                                                        <button
                                                            onClick={() => setUnstakeAmounts(prev => ({
                                                                ...prev,
                                                                [pool.symbol]: String(pool.staked)
                                                            }))}
                                                            className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                                                        >
                                                            MAX ({pool.staked.toFixed(2)})
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={unstakeAmounts[pool.symbol] || ''}
                                                        onChange={(e) => setUnstakeAmounts(prev => ({
                                                            ...prev,
                                                            [pool.symbol]: e.target.value
                                                        }))}
                                                        placeholder="0"
                                                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 font-mono outline-none focus:ring-2 focus:ring-brand-orange/30"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleUnstake(pool)}
                                                    disabled={
                                                        unstakeHook.state === 'staking' ||
                                                        unstakeHook.state === 'waitingStake' ||
                                                        !unstakeAmounts[pool.symbol] ||
                                                        parseFloat(unstakeAmounts[pool.symbol] || '0') <= 0
                                                    }
                                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold border-2 border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                                                >
                                                    {unstakeHook.state === 'staking' || unstakeHook.state === 'waitingStake' ? (
                                                        <span className="flex items-center gap-1">
                                                            <Loader2 size={14} className="animate-spin" />
                                                            Unstaking...
                                                        </span>
                                                    ) : (
                                                        'Confirm Unstake'
                                                    )}
                                                </button>
                                            </div>
                                            {unstakeHook.state === 'error' && (
                                                <p className="text-xs text-red-500 mt-2">{unstakeHook.errorMessage}</p>
                                            )}
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
                                    <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Asset</th>
                                    <th className="text-right px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Amount</th>
                                    <th className="text-right px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Date</th>
                                    <th className="text-right px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Tx</th>
                                </tr>
                            </thead>
                            <tbody>
                                {HISTORY.map((h, i) => (
                                    <tr key={i} className="border-b border-gray-50">
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_BADGE_STYLES[h.type] || 'bg-gray-100 text-gray-700'}`}>
                                                {h.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-700">{h.asset}</td>
                                        <td className="px-6 py-4 text-right font-semibold text-gray-900">{h.amount}</td>
                                        <td className="px-6 py-4 text-right text-gray-400">{h.date}</td>
                                        <td className="px-6 py-4 text-right">
                                            <TxLink txHash={h.tx} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
