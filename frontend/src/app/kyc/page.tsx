'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Wallet, UserCheck, BarChart3, ExternalLink } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Steps indicator                                                    */
/* ------------------------------------------------------------------ */
const STEPS = [
    { num: 1, label: 'Connect Wallet', icon: Wallet },
    { num: 2, label: 'Verify Identity', icon: UserCheck },
    { num: 3, label: 'Start Trading', icon: BarChart3 },
];

/* ------------------------------------------------------------------ */
/*  STATE: unverified (default)                                        */
/* ------------------------------------------------------------------ */
function UnverifiedState() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left — Explanation */}
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-md">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Why KYC?</h2>
                <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                    <p>
                        Tokenized real-world assets are regulated securities. To participate in pools and trade on the secondary market, we need to verify your identity once.
                    </p>
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-2">What you&apos;ll need</h3>
                        <ul className="space-y-1.5 list-disc list-inside text-gray-600">
                            <li>Government-issued photo ID (passport, drivers license)</li>
                            <li>Selfie for liveness check</li>
                            <li>Takes less than 2 minutes</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-2">One-time process</h3>
                        <p>
                            After verification, a soulbound ComplianceNFT is minted to your wallet. This credential is reusable across all UniRWA pools and trades.
                        </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
                        <UserCheck size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-500">
                            Identity verification is handled by{' '}
                            <span className="font-semibold text-gray-700">Persona</span>, a trusted third-party KYC provider. UniRWA never stores your personal documents.
                        </p>
                    </div>
                </div>
            </div>

            {/* Right — Verification widget */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-md">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Verification</h2>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                        ⚪ Not Verified
                    </span>
                </div>

                {/* Persona iframe placeholder */}
                <div className="bg-gray-100 rounded-2xl flex items-center justify-center h-64 mb-6 border-2 border-dashed border-gray-200">
                    <div className="text-center">
                        <UserCheck size={40} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-400">Persona KYC Flow</p>
                        <p className="text-xs text-gray-300 mt-1">Verification widget loads here</p>
                    </div>
                </div>

                {/* Begin button */}
                <button
                    className="w-full py-4 rounded-2xl text-white font-semibold text-base transition-all duration-300 hover:-translate-y-0.5"
                    style={{
                        background: 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                        boxShadow: '0 4px 24px rgba(255,92,22,0.4)',
                    }}
                >
                    Begin Verification
                </button>

                <p className="text-center text-xs text-gray-400 mt-3">
                    🧪 Sandbox mode — instant approval for demo
                </p>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  STATE: pending                                                     */
/* ------------------------------------------------------------------ */
function PendingState() {
    return (
        <div className="max-w-lg mx-auto bg-white rounded-3xl p-8 shadow-md text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⏳</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Pending</h2>
            <p className="text-sm text-gray-500 mb-6">
                Your identity is being reviewed. This usually takes less than 60 seconds in sandbox mode.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
                You&apos;ll receive your ComplianceNFT automatically once verification is complete.
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  STATE: verified                                                    */
/* ------------------------------------------------------------------ */
function VerifiedState() {
    return (
        <div className="max-w-lg mx-auto bg-white rounded-3xl p-8 shadow-md text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Identity Verified</h2>
            <p className="text-sm text-gray-500 mb-6">
                ComplianceNFT issued to your wallet. You&apos;re cleared to trade and join pools.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Wallet</span>
                    <span className="font-mono text-gray-700">0x1234...5678</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">NFT</span>
                    <a
                        href="https://testnet.snowtrace.io/tx/0xdeadbeef12345678"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-orange hover:underline flex items-center gap-1"
                    >
                        View on Snowtrace <ExternalLink size={12} />
                    </a>
                </div>
            </div>
            <Link
                href="/pools"
                className="inline-block px-8 py-3.5 rounded-full text-white font-semibold transition-all duration-300 hover:-translate-y-0.5"
                style={{
                    background: 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                    boxShadow: '0 4px 24px rgba(255,92,22,0.4)',
                }}
            >
                Start Trading
            </Link>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Main KYC page — shows unverified by default                        */
/* ------------------------------------------------------------------ */
export default function KYCPage() {
    // Hardcoded state = 'unverified'. Switch to 'pending' or 'verified' to preview.
    const state = 'unverified' as 'unverified' | 'pending' | 'verified';

    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-10"
                >
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 mb-8">
                        Identity Verification
                    </h1>

                    {/* Steps indicator */}
                    <div className="flex items-center gap-2 md:gap-4 mb-10">
                        {STEPS.map((step, i) => {
                            const Icon = step.icon;
                            const isActive = step.num === 2;
                            const isCompleted = step.num === 1;
                            return (
                                <div key={step.num} className="flex items-center gap-2 md:gap-4">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${isCompleted
                                                    ? 'bg-green-500 text-white'
                                                    : isActive
                                                        ? 'text-white'
                                                        : 'bg-gray-200 text-gray-400'
                                                }`}
                                            style={
                                                isActive
                                                    ? { background: 'linear-gradient(135deg, #FF5C16, #D075FF)' }
                                                    : undefined
                                            }
                                        >
                                            {isCompleted ? '✓' : <Icon size={16} />}
                                        </div>
                                        <span
                                            className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'
                                                }`}
                                        >
                                            {step.label}
                                        </span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className="w-8 md:w-16 h-0.5 bg-gray-200" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* State content */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    {state === 'unverified' && <UnverifiedState />}
                    {state === 'pending' && <PendingState />}
                    {state === 'verified' && <VerifiedState />}
                </motion.div>
            </div>
        </div>
    );
}
