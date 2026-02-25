'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, Info, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import ProgressBar from '@/components/ProgressBar';
import StatusBadge from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPool } from '@/lib/api';

const FAUCET_ABI = [
    {
        name: 'faucet',
        type: 'function',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
] as const;

const MOCK_USDC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS as `0x${string}`;

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

export default function PoolDetailPage() {
    const params = useParams();
    const address = params.address as string;
    const [faqOpen, setFaqOpen] = useState(false);
    const { isConnected } = useAccount();

    const { data: pool, isLoading, error } = useQuery({
        queryKey: ['pool', address],
        queryFn: () => fetchPool(address),
        staleTime: 60_000,
        enabled: !!address,
    });

    const {
        writeContract: writeFaucet,
        isPending: isFaucetPending,
        data: faucetTxHash,
    } = useWriteContract();

    const { isLoading: isFaucetConfirming, isSuccess: isFaucetSuccess } =
        useWaitForTransactionReceipt({
            hash: faucetTxHash,
        });

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
        if (!MOCK_USDC_ADDRESS) {
            toast.error('MockUSDC address not configured');
            return;
        }

        writeFaucet(
            {
                address: MOCK_USDC_ADDRESS,
                abi: FAUCET_ABI,
                functionName: 'faucet',
            },
            {
                onError: (err) => {
                    if (err.message.includes('24h') || err.message.includes('cooldown')) {
                        toast.error('Faucet on cooldown', {
                            description: 'You can only claim once every 24 hours.',
                        });
                    } else {
                        toast.error('Faucet failed', {
                            description: err.message.slice(0, 120),
                        });
                    }
                },
            }
        );
    };

    if (isLoading) return <PoolDetailSkeleton />;

    if (error || !pool) {
        return (
            <div className="min-h-screen bg-brand-cream flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Pool Not Found</h2>
                    <p className="text-gray-500 mb-4">Could not load pool data for this address.</p>
                    <Link href="/pools" className="text-brand-orange hover:underline">← Back to Pools</Link>
                </div>
            </div>
        );
    }

    const faucetButtonText = isFaucetConfirming
        ? 'Confirming...'
        : isFaucetPending
            ? 'Waiting for wallet...'
            : '🚰 Get Testnet USDC from Faucet';

    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
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
                            background: 'radial-gradient(circle, rgba(255,92,22,0.1) 0%, transparent 70%)',
                            filter: 'blur(40px)',
                        }}
                    />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <h1 className="text-2xl md:text-3xl font-bold text-white">{pool.asset_symbol}</h1>
                            <StatusBadge status={pool.status} />
                        </div>
                        <p className="text-white/50 text-sm mb-6">{pool.asset_name}</p>
                        <div className="flex flex-wrap gap-8">
                            {[
                                { label: 'NAV', value: pool.nav },
                                { label: 'APY', value: pool.apy, gradient: true },
                                { label: 'Issuer', value: pool.issuer },
                                { label: 'Participants', value: String(pool.participants || '—') },
                            ].map((stat) => (
                                <div key={stat.label}>
                                    <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{stat.label}</p>
                                    {stat.gradient ? (
                                        <p
                                            className="text-lg font-bold"
                                            style={{
                                                background: 'linear-gradient(135deg, #FF5C16, #D075FF)',
                                                WebkitBackgroundClip: 'text',
                                                WebkitTextFillColor: 'transparent',
                                                backgroundClip: 'text',
                                            }}
                                        >
                                            {stat.value}
                                        </p>
                                    ) : (
                                        <p className="text-lg font-semibold text-white">{stat.value}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-md mb-8"
                >
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Pool Progress</h2>
                    <p className="text-sm text-gray-500 mb-5">
                        When this pool hits ${pool.threshold.toLocaleString()} it auto-purchases {pool.asset_symbol} and distributes vault tokens.
                    </p>
                    <ProgressBar filled={pool.filled} threshold={pool.threshold} showLabel />
                    <p className="text-sm text-gray-400 mt-3">
                        ${pool.filled.toLocaleString()} of ${pool.threshold.toLocaleString()}
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-md mb-8"
                >
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Deposit</h2>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <Info size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-amber-800">KYC Required</p>
                                <p className="text-sm text-amber-600 mt-1">
                                    You must complete identity verification before depositing.{' '}
                                    <Link href="/kyc" className="underline font-semibold">
                                        Complete KYC →
                                    </Link>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Amount (USDC)</label>
                        <input
                            type="text"
                            placeholder={`Min: $${pool.min_deposit.toLocaleString()}`}
                            readOnly
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-lg text-gray-700 placeholder:text-gray-400 outline-none"
                        />
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-500 mb-6">
                        <span>Estimated shares</span>
                        <span className="font-medium text-gray-700">~995.52 v{pool.asset_symbol}</span>
                    </div>

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

                    <button
                        disabled
                        className="w-full py-3.5 rounded-xl font-semibold cursor-not-allowed"
                        style={{
                            background: '#0F0F1A',
                            color: 'rgba(255,255,255,0.6)',
                            border: '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        {isConnected ? 'Complete KYC to deposit' : 'Connect wallet to deposit'}
                    </button>
                </motion.div>

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
                            <span className="text-sm font-semibold text-gray-900">${pool.min_deposit.toLocaleString()} USDC</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Status</span>
                            <StatusBadge status={pool.status} />
                        </div>
                    </div>
                </motion.div>

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
                        <span className="font-bold text-gray-900">How do fractional pools work?</span>
                        <ChevronDown
                            size={20}
                            className={`text-gray-400 transition-transform duration-300 ${faqOpen ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {faqOpen && (
                        <div className="px-6 pb-6 text-sm text-gray-600 leading-relaxed space-y-3">
                            <p>
                                Fractional pools allow multiple users to deposit USDC until the pool reaches its funding threshold (e.g. ${pool.threshold.toLocaleString()}). Once the threshold is met, the smart contract automatically purchases the underlying RWA (like {pool.asset_symbol}) and distributes proportional vault tokens to all participants.
                            </p>
                            <p>
                                Your vault tokens represent your share of the pool. You earn yield proportionally to your share and can exit anytime by trading your vault tokens on the secondary market (AMM or orderbook), without waiting for issuer redemptions.
                            </p>
                            <p>
                                If the pool hasn&apos;t reached its threshold yet, you can withdraw your deposit at any time with no penalty.
                            </p>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
