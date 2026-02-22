'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, Info } from 'lucide-react';
import { useState } from 'react';
import ProgressBar from '@/components/ProgressBar';
import StatusBadge from '@/components/StatusBadge';

/* ------------------------------------------------------------------ */
/*  Hardcoded data                                                     */
/* ------------------------------------------------------------------ */
const POOL = {
    id: '0xpool1',
    asset: 'BUIDL',
    name: 'BlackRock BUIDL Pool #1',
    status: 'filling' as const,
    filled: 5000,
    threshold: 50000,
    participants: 4,
    minDeposit: 1000,
    apy: '4.50%',
    nav: '$1.0045',
    issuer: 'Securitize',
    myShares: 950,
    myValue: 1023,
    myDeposited: 1000,
};

const PARTICIPANTS = [
    { address: '0x1234...5678', deposited: 1000 },
    { address: '0xabcd...ef01', deposited: 2000 },
    { address: '0x9876...4321', deposited: 1000 },
    { address: 'You', deposited: 1000 },
];

export default function PoolDetailPage() {
    const [faqOpen, setFaqOpen] = useState(false);
    const totalDeposited = PARTICIPANTS.reduce((sum, p) => sum + p.deposited, 0);

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

                {/* Dark header card */}
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
                            <h1 className="text-2xl md:text-3xl font-bold text-white">{POOL.asset}</h1>
                            <StatusBadge status={POOL.status} />
                        </div>
                        <p className="text-white/50 text-sm mb-6">{POOL.name}</p>
                        <div className="flex flex-wrap gap-8">
                            {[
                                { label: 'NAV', value: POOL.nav },
                                { label: 'APY', value: POOL.apy, gradient: true },
                                { label: 'Issuer', value: POOL.issuer },
                                { label: 'Participants', value: String(POOL.participants) },
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

                {/* Progress card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-md mb-8"
                >
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Pool Progress</h2>
                    <p className="text-sm text-gray-500 mb-5">
                        When this pool hits ${POOL.threshold.toLocaleString()} it auto-purchases {POOL.asset} and distributes vault tokens.
                    </p>
                    <ProgressBar filled={POOL.filled} threshold={POOL.threshold} showLabel />
                    <p className="text-sm text-gray-400 mt-3">
                        ${POOL.filled.toLocaleString()} of ${POOL.threshold.toLocaleString()}
                    </p>
                </motion.div>

                {/* My Position card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.15 }}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-md mb-8"
                >
                    <h2 className="text-lg font-bold text-gray-900 mb-4">My Position</h2>
                    <div className="grid grid-cols-3 gap-6">
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Deposited</p>
                            <p className="text-xl font-bold text-gray-900">${POOL.myDeposited.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Value</p>
                            <p className="text-xl font-bold text-gray-900">${POOL.myValue.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Yield Earned</p>
                            <p
                                className="text-xl font-bold"
                                style={{
                                    background: 'linear-gradient(135deg, #FF5C16, #D075FF)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }}
                            >
                                +${(POOL.myValue - POOL.myDeposited).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Deposit card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-md mb-8"
                >
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Deposit</h2>

                    {/* KYC Warning */}
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

                    {/* Amount input */}
                    <div className="mb-4">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Amount (USDC)</label>
                        <input
                            type="text"
                            placeholder="1,000"
                            readOnly
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-lg text-gray-700 placeholder:text-gray-400 outline-none"
                        />
                    </div>

                    {/* Estimated shares */}
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-6">
                        <span>Estimated shares</span>
                        <span className="font-medium text-gray-700">~995.52 v{POOL.asset}</span>
                    </div>

                    {/* Faucet button */}
                    <button className="w-full mb-3 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors">
                        🚰 Get Testnet USDC from Faucet
                    </button>

                    {/* Deposit button (disabled) */}
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
                </motion.div>

                {/* Participants table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-md mb-8"
                >
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Participants</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Address</th>
                                    <th className="text-right py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Deposited</th>
                                    <th className="text-right py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">% of Pool</th>
                                </tr>
                            </thead>
                            <tbody>
                                {PARTICIPANTS.map((p) => (
                                    <tr
                                        key={p.address}
                                        className={`border-b border-gray-50 ${p.address === 'You' ? 'bg-brand-orange/5' : ''
                                            }`}
                                    >
                                        <td className="py-3">
                                            <span className={`font-mono text-sm ${p.address === 'You' ? 'font-bold text-brand-orange' : 'text-gray-700'}`}>
                                                {p.address}
                                            </span>
                                        </td>
                                        <td className="py-3 text-right font-medium text-gray-900">
                                            ${p.deposited.toLocaleString()}
                                        </td>
                                        <td className="py-3 text-right text-gray-500">
                                            {((p.deposited / totalDeposited) * 100).toFixed(1)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* FAQ Accordion */}
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
                                Fractional pools allow multiple users to deposit USDC until the pool reaches its funding threshold (e.g. $50,000). Once the threshold is met, the smart contract automatically purchases the underlying RWA (like BUIDL) and distributes proportional vault tokens to all participants.
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
