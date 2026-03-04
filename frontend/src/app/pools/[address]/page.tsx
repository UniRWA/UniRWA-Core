'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, Info, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import ProgressBar from '@/components/ProgressBar';
import StatusBadge from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPool } from '@/lib/api';
import { usePoolChainData } from '@/hooks/usePoolChainData';
import { parseRevertReason } from '@/lib/utils';
import { usePoolDeposit } from '@/hooks/usePoolDeposit';
import { ERC20_ABI, ADDRESSES, USDC_DECIMALS } from '@/config/contracts';

// ─── Skeleton ──────────────────────────────────────────────────────
function PoolDetailSkeleton() {
    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
                <Skeleton className="h-4 w-28 mb-8" />
                <Skeleton className="h-48 w-full rounded-2xl mb-8" />
                <Skeleton className="h-40 w-full rounded-2xl mb-8" />
                <Skeleton className="h-48 w-full rounded-2xl mb-8" />
                <Skeleton className="h-64 w-full rounded-2xl mb-8" />
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function PoolDetailPage() {
    const params = useParams();
    const address = params.address as string;
    const poolAddress = address as `0x${string}`;

    const [faqOpen, setFaqOpen] = useState(false);
    const [depositInput, setDepositInput] = useState('');
    const { isConnected, address: userAddress } = useAccount();

    // API data (issuer name, APY, NAV — non-chain data)
    const {
        data: pool,
        isLoading: isApiLoading,
        error: apiError,
    } = useQuery({
        queryKey: ['pool', address],
        queryFn: () => fetchPool(address),
        staleTime: 60_000,
        enabled: !!address,
    });

    // On-chain data (live reads via multicall)
    const chain = usePoolChainData(poolAddress);

    // Two-step deposit flow
    const deposit = usePoolDeposit({
        poolAddress,
        onSuccess: useCallback(() => {
            chain.refetch();
            setDepositInput('');
        }, [chain]),
    });

    // ─── Faucet ────────────────────────────────────────────────────
    const {
        writeContract: writeFaucet,
        isPending: isFaucetPending,
        data: faucetTxHash,
    } = useWriteContract();

    const { isLoading: isFaucetConfirming, isSuccess: isFaucetSuccess } =
        useWaitForTransactionReceipt({ hash: faucetTxHash });

    if (isFaucetSuccess && faucetTxHash) {
        toast.success('USDC received! 🎉', {
            description: 'You received 10,000 test USDC.',
            action: {
                label: 'View on SnowTrace',
                onClick: () =>
                    window.open(
                        `https://testnet.snowtrace.io/tx/${faucetTxHash}`,
                        '_blank'
                    ),
            },
            id: `faucet-${faucetTxHash}`,
        });
    }

    const handleFaucet = () => {
        if (!ADDRESSES.USDC) {
            toast.error('MockUSDC address not configured');
            return;
        }
        writeFaucet(
            {
                address: ADDRESSES.USDC,
                abi: ERC20_ABI,
                functionName: 'faucet',
            },
            {
                onError: (err) => {
                    toast.error('Faucet failed', {
                        description: parseRevertReason(err),
                    });
                },
            }
        );
    };

    // ─── Derived values ────────────────────────────────────────────
    // Prefer chain data, fall back to API data
    const filled = chain.totalDeposited ?? pool?.filled ?? 0;
    const threshold = chain.threshold ?? pool?.threshold ?? 0;
    const isFunded = chain.poolFunded || pool?.status === 'funded';
    const minDeposit = chain.minDeposit ?? pool?.min_deposit ?? 1000;

    const depositAmountNum = parseFloat(depositInput) || 0;
    const depositAmountRaw = BigInt(Math.floor(depositAmountNum * 10 ** USDC_DECIMALS));
    const isAmountValid = depositAmountNum >= minDeposit;
    const hasEnoughUsdc =
        chain.userUsdcBalance !== undefined ? depositAmountNum <= chain.userUsdcBalance : true;
    const needsApproval =
        chain.usdcAllowance !== undefined ? chain.usdcAllowance < depositAmountRaw : true;

    // NAV as a number for position calculation (strip $ and parse)
    const navNum = pool?.nav ? parseFloat(pool.nav.replace('$', '')) : 1.0;
    const userSharesUsdc =
        chain.userSharesFormatted !== undefined
            ? chain.userSharesFormatted * navNum
            : 0;

    // ─── Loading / Error ───────────────────────────────────────────
    if (isApiLoading && chain.isLoading) return <PoolDetailSkeleton />;

    if (apiError || !pool) {
        return (
            <div className="min-h-screen bg-brand-cream flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Pool Not Found</h2>
                    <p className="text-gray-500 mb-4">
                        Could not load pool data for this address.
                    </p>
                    <Link href="/pools" className="text-brand-orange hover:underline">
                        ← Back to Pools
                    </Link>
                </div>
            </div>
        );
    }

    const faucetButtonText = isFaucetConfirming
        ? 'Confirming...'
        : isFaucetPending
            ? 'Waiting for wallet...'
            : '🚰 Get Testnet USDC from Faucet';

    // ─── Render ────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
                {/* Back link */}
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <Link
                        href="/pools"
                        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-8"
                    >
                        <ArrowLeft size={16} />
                        Back to Pools
                    </Link>
                </motion.div>

                {/* ─── Pool Header ──────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                    className="rounded-2xl p-8 mb-8 relative overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, #0A0A0E 0%, #24242E 100%)',
                    }}
                >
                    <div
                        className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none"
                        style={{
                            background:
                                'radial-gradient(circle, rgba(255,92,22,0.1) 0%, transparent 70%)',
                            filter: 'blur(40px)',
                        }}
                    />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <h1 className="text-2xl md:text-3xl font-bold text-white">
                                {pool.asset_symbol}
                            </h1>
                            {isFunded ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                                    <CheckCircle2 size={12} />
                                    Funded ✅
                                </span>
                            ) : (
                                <StatusBadge status={pool.status} />
                            )}
                        </div>
                        <p className="text-white/50 text-sm mb-6">{pool.asset_name}</p>
                        <div className="flex flex-wrap gap-8">
                            {[
                                { label: 'NAV', value: pool.nav },
                                { label: 'APY', value: pool.apy, gradient: true },
                                { label: 'Issuer', value: pool.issuer },
                                {
                                    label: 'Participants',
                                    value: String(pool.participants || '—'),
                                },
                            ].map((stat) => (
                                <div key={stat.label}>
                                    <p className="text-xs text-white/40 uppercase tracking-wider mb-1">
                                        {stat.label}
                                    </p>
                                    {stat.gradient ? (
                                        <p
                                            className="text-lg font-bold"
                                            style={{
                                                background:
                                                    'linear-gradient(135deg, #FF5C16, #D075FF)',
                                                WebkitBackgroundClip: 'text',
                                                WebkitTextFillColor: 'transparent',
                                                backgroundClip: 'text',
                                            }}
                                        >
                                            {stat.value}
                                        </p>
                                    ) : (
                                        <p className="text-lg font-semibold text-white">
                                            {stat.value}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* ─── Pool Progress / Funded Banner ────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-md mb-8"
                >
                    {isFunded ? (
                        <>
                            <div className="flex items-center gap-3 mb-3">
                                <CheckCircle2 size={24} className="text-green-500" />
                                <h2 className="text-lg font-bold text-gray-900">
                                    Pool Funded — Earning Yield
                                </h2>
                            </div>
                            <p className="text-sm text-gray-500 mb-4">
                                This pool reached its ${threshold.toLocaleString()} target and has
                                auto-purchased {pool.asset_symbol} tokens. Vault token holders are
                                now earning yield.
                            </p>
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-green-600 uppercase tracking-wider mb-1">
                                        Total Value Locked
                                    </p>
                                    <p className="text-xl font-bold text-green-700">
                                        ${(chain.totalAssets ?? filled).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-green-600 uppercase tracking-wider mb-1">
                                        Status
                                    </p>
                                    <p className="text-sm font-semibold text-green-700">
                                        ✅ Active & Earning
                                    </p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <h2 className="text-lg font-bold text-gray-900 mb-2">
                                Pool Progress
                            </h2>
                            <p className="text-sm text-gray-500 mb-5">
                                When this pool hits ${threshold.toLocaleString()} it
                                auto-purchases {pool.asset_symbol} and distributes vault tokens.
                            </p>
                            <ProgressBar filled={filled} threshold={threshold} showLabel />
                            <p className="text-sm text-gray-400 mt-3">
                                ${filled.toLocaleString()} of ${threshold.toLocaleString()}
                            </p>
                        </>
                    )}
                </motion.div>

                {/* ─── User Position Card ───────────────────────────── */}
                {isConnected && chain.userShares !== undefined && chain.userShares > BigInt(0) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        className="bg-white rounded-2xl p-6 md:p-8 shadow-md mb-8 border-l-4 border-brand-orange"
                    >
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Your Position</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-gray-50 rounded-xl p-4">
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                                    Shares Owned
                                </p>
                                <p className="text-xl font-bold text-gray-900">
                                    {chain.userSharesFormatted?.toLocaleString(undefined, {
                                        maximumFractionDigits: 2,
                                    }) ?? '0'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    v{pool.asset_symbol} tokens
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4">
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                                    Estimated Value
                                </p>
                                <p
                                    className="text-xl font-bold"
                                    style={{
                                        background:
                                            'linear-gradient(135deg, #FF5C16, #D075FF)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                    }}
                                >
                                    ~$
                                    {userSharesUsdc.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    at NAV {pool.nav}
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4">
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                                    Pool Share
                                </p>
                                <p className="text-xl font-bold text-gray-900">
                                    {threshold > 0
                                        ? (
                                            ((chain.userSharesFormatted ?? 0) /
                                                (threshold / navNum)) *
                                            100
                                        ).toFixed(1)
                                        : '0'}
                                    %
                                </p>
                                <p className="text-xs text-gray-400 mt-1">of total pool</p>
                            </div>
                        </div>

                        {/* ─── Withdraw Stub ────────────────────────── */}
                        {/* TODO: Wire actual withdraw() call on Day 9 after Router is deployed */}
                        {isFunded && (
                            <div className="mt-6 pt-6 border-t border-gray-100">
                                <Link
                                    href="/trade"
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5"
                                    style={{
                                        background:
                                            'linear-gradient(135deg, #FF5C16, #FF8A50)',
                                        boxShadow: '0 4px 16px rgba(255,92,22,0.3)',
                                    }}
                                >
                                    Exit via Secondary Market →
                                    <ExternalLink size={14} />
                                </Link>
                                <p className="text-xs text-gray-400 mt-2">
                                    Trade your vault tokens on the HybridAMM or orderbook
                                </p>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ─── Deposit Form ─────────────────────────────────── */}
                {!isFunded && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="bg-white rounded-2xl p-6 md:p-8 shadow-md mb-8"
                    >
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Deposit</h2>

                        {/* KYC Warning */}
                        {isConnected && !chain.isKycVerified && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <Info
                                        size={18}
                                        className="text-amber-600 mt-0.5 flex-shrink-0"
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-amber-800">
                                            KYC Required
                                        </p>
                                        <p className="text-sm text-amber-600 mt-1">
                                            You must complete identity verification before
                                            depositing.{' '}
                                            <Link
                                                href="/kyc"
                                                className="underline font-semibold"
                                            >
                                                Complete KYC →
                                            </Link>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!isConnected && (
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <Info
                                        size={18}
                                        className="text-gray-400 mt-0.5 flex-shrink-0"
                                    />
                                    <p className="text-sm text-gray-500">
                                        Connect your wallet to deposit into this pool.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Amount Input */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-700">
                                    Amount (USDC)
                                </label>
                                {isConnected && chain.userUsdcBalance !== undefined && (
                                    <button
                                        onClick={() =>
                                            setDepositInput(
                                                chain.userUsdcBalance?.toString() ?? ''
                                            )
                                        }
                                        className="text-xs text-brand-orange hover:underline"
                                    >
                                        Balance:{' '}
                                        {chain.userUsdcBalance.toLocaleString(undefined, {
                                            maximumFractionDigits: 2,
                                        })}{' '}
                                        USDC
                                    </button>
                                )}
                            </div>
                            <input
                                type="number"
                                value={depositInput}
                                onChange={(e) => setDepositInput(e.target.value)}
                                placeholder={`Min: $${minDeposit.toLocaleString()}`}
                                min={minDeposit}
                                step="100"
                                disabled={!isConnected || !chain.isKycVerified}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-lg text-gray-700 placeholder:text-gray-400 outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/30 transition-colors disabled:opacity-50"
                            />
                            {depositInput && !isAmountValid && (
                                <p className="text-xs text-red-500 mt-1">
                                    Minimum deposit is ${minDeposit.toLocaleString()}
                                </p>
                            )}
                            {depositInput && isAmountValid && !hasEnoughUsdc && (
                                <p className="text-xs text-red-500 mt-1">
                                    Insufficient USDC balance. Use the faucet below to get test
                                    tokens.
                                </p>
                            )}
                        </div>

                        {/* Estimated shares */}
                        {depositInput && isAmountValid && (
                            <div className="flex items-center justify-between text-sm text-gray-500 mb-6">
                                <span>Estimated shares</span>
                                <span className="font-medium text-gray-700">
                                    ~
                                    {(depositAmountNum / navNum).toLocaleString(undefined, {
                                        maximumFractionDigits: 2,
                                    })}{' '}
                                    v{pool.asset_symbol}
                                </span>
                            </div>
                        )}

                        {/* Deposit Progress Steps */}
                        {deposit.step !== 'idle' && deposit.step !== 'error' && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                                <div className="flex items-center gap-3">
                                    {deposit.step === 'success' ? (
                                        <CheckCircle2 size={18} className="text-green-500" />
                                    ) : (
                                        <Loader2
                                            size={18}
                                            className="text-blue-500 animate-spin"
                                        />
                                    )}
                                    <div>
                                        <p className="text-sm font-medium text-blue-800">
                                            {deposit.stepLabel}
                                        </p>
                                        {/* Step progress bar */}
                                        <div className="flex gap-2 mt-2">
                                            <div
                                                className={`h-1.5 flex-1 rounded-full transition-colors ${deposit.stepNumber >= 1
                                                    ? 'bg-blue-500'
                                                    : 'bg-blue-200'
                                                    }`}
                                            />
                                            <div
                                                className={`h-1.5 flex-1 rounded-full transition-colors ${deposit.stepNumber >= 2
                                                    ? 'bg-blue-500'
                                                    : 'bg-blue-200'
                                                    }`}
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* SnowTrace links for in-progress txns */}
                                {deposit.approveTxHash && (
                                    <a
                                        href={`https://testnet.snowtrace.io/tx/${deposit.approveTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline mt-2 inline-flex items-center gap-1"
                                    >
                                        Approve tx ↗
                                    </a>
                                )}
                                {deposit.depositTxHash && (
                                    <a
                                        href={`https://testnet.snowtrace.io/tx/${deposit.depositTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline mt-2 ml-4 inline-flex items-center gap-1"
                                    >
                                        Deposit tx ↗
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Success State — prominent SnowTrace link */}
                        {deposit.step === 'success' && deposit.depositTxHash && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <CheckCircle2 size={20} className="text-green-500" />
                                    <p className="text-sm font-semibold text-green-800">
                                        Deposit Confirmed!
                                    </p>
                                </div>
                                <a
                                    href={`https://testnet.snowtrace.io/tx/${deposit.depositTxHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-100 text-green-700 text-sm font-medium hover:bg-green-200 transition-colors"
                                >
                                    <ExternalLink size={14} />
                                    View on SnowTrace
                                </a>
                                <button
                                    onClick={deposit.reset}
                                    className="ml-3 text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Deposit again
                                </button>
                            </div>
                        )}

                        {/* Faucet Button */}
                        <button
                            onClick={handleFaucet}
                            disabled={isFaucetPending || isFaucetConfirming || !isConnected}
                            className="w-full mb-3 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {(isFaucetPending || isFaucetConfirming) && (
                                <Loader2 size={14} className="animate-spin" />
                            )}
                            {faucetButtonText}
                        </button>

                        {/* Deposit / Approve Button */}
                        {(() => {
                            // Not connected
                            if (!isConnected) {
                                return (
                                    <button
                                        disabled
                                        className="w-full py-3.5 rounded-xl font-semibold cursor-not-allowed"
                                        style={{
                                            background: '#0F0F1A',
                                            color: 'rgba(255,255,255,0.6)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                        }}
                                    >
                                        Connect wallet to deposit
                                    </button>
                                );
                            }

                            // Not KYC verified
                            if (!chain.isKycVerified) {
                                return (
                                    <button
                                        disabled
                                        className="w-full py-3.5 rounded-xl font-semibold cursor-not-allowed"
                                        style={{
                                            background: '#0F0F1A',
                                            color: 'rgba(255,255,255,0.6)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                        }}
                                    >
                                        Complete KYC to deposit
                                    </button>
                                );
                            }

                            // In progress
                            if (deposit.isLoading) {
                                return (
                                    <button
                                        disabled
                                        className="w-full py-3.5 rounded-xl font-semibold cursor-not-allowed flex items-center justify-center gap-2"
                                        style={{
                                            background: '#0F0F1A',
                                            color: 'rgba(255,255,255,0.6)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                        }}
                                    >
                                        <Loader2 size={16} className="animate-spin" />
                                        {deposit.stepLabel}
                                    </button>
                                );
                            }

                            // Deposit success — show "Deposit again" button
                            if (deposit.step === 'success') {
                                return null; // Success card shown above
                            }

                            // Ready to deposit — show appropriate button
                            const canDeposit =
                                isAmountValid && hasEnoughUsdc && depositInput;

                            return (
                                <button
                                    onClick={() => deposit.startDeposit(depositInput)}
                                    disabled={!canDeposit}
                                    className="w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
                                    style={{
                                        background: canDeposit
                                            ? 'linear-gradient(135deg, #FF5C16, #FF8A50)'
                                            : '#0F0F1A',
                                        color: canDeposit
                                            ? '#fff'
                                            : 'rgba(255,255,255,0.6)',
                                        border: canDeposit
                                            ? 'none'
                                            : '1px solid rgba(255,255,255,0.1)',
                                        boxShadow: canDeposit
                                            ? '0 4px 16px rgba(255,92,22,0.3)'
                                            : 'none',
                                    }}
                                >
                                    {needsApproval
                                        ? `Step 1: Approve ${depositInput ? `$${depositAmountNum.toLocaleString()}` : ''} USDC`
                                        : `Deposit ${depositInput ? `$${depositAmountNum.toLocaleString()}` : ''} USDC`}
                                </button>
                            );
                        })()}
                    </motion.div>
                )}

                {/* ─── Contract Info ─────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-md mb-8"
                >
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Contract Info</h2>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Pool Contract</span>
                            <a
                                href={`https://testnet.snowtrace.io/address/${pool.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-mono text-brand-orange hover:underline"
                            >
                                {pool.address.slice(0, 6)}...{pool.address.slice(-4)}
                            </a>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Min Deposit</span>
                            <span className="text-sm font-semibold text-gray-900">
                                ${minDeposit.toLocaleString()} USDC
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Status</span>
                            {isFunded ? (
                                <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-600">
                                    <CheckCircle2 size={14} />
                                    Funded
                                </span>
                            ) : (
                                <StatusBadge status={pool.status} />
                            )}
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Chain</span>
                            <span className="text-sm font-semibold text-gray-900">
                                Avalanche Fuji
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* ─── FAQ ──────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="bg-white rounded-2xl shadow-md overflow-hidden"
                >
                    <button
                        onClick={() => setFaqOpen(!faqOpen)}
                        className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                    >
                        <span className="font-bold text-gray-900">
                            How do fractional pools work?
                        </span>
                        <ChevronDown
                            size={20}
                            className={`text-gray-400 transition-transform duration-300 ${faqOpen ? 'rotate-180' : ''
                                }`}
                        />
                    </button>
                    {faqOpen && (
                        <div className="px-6 pb-6 text-sm text-gray-600 leading-relaxed space-y-3">
                            <p>
                                Fractional pools allow multiple users to deposit USDC until the
                                pool reaches its funding threshold (e.g. $
                                {threshold.toLocaleString()}). Once the threshold is met, the
                                smart contract automatically purchases the underlying RWA (like{' '}
                                {pool.asset_symbol}) and distributes proportional vault tokens
                                to all participants.
                            </p>
                            <p>
                                Your vault tokens represent your share of the pool. You earn
                                yield proportionally to your share and can exit anytime by
                                trading your vault tokens on the secondary market (AMM or
                                orderbook), without waiting for issuer redemptions.
                            </p>
                            <p>
                                If the pool hasn&apos;t reached its threshold yet, you can
                                withdraw your deposit at any time with no penalty.
                            </p>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
