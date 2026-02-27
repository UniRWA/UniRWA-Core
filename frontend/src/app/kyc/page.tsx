'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Wallet, UserCheck, BarChart3, ExternalLink, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const STEPS = [
    { num: 1, label: 'Connect Wallet', icon: Wallet },
    { num: 2, label: 'Verify Identity', icon: UserCheck },
    { num: 3, label: 'Start Trading', icon: BarChart3 },
];

type KycStatus = 'none' | 'pending' | 'approved' | 'mint_failed';

/* ------------------------------------------------------------------ */
/*  Step Progress Bar                                                  */
/* ------------------------------------------------------------------ */
function StepProgress({ current }: { current: number }) {
    return (
        <div className="flex items-center justify-center gap-0 mb-12">
            {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isActive = step.num <= current;
                const isDone = step.num < current;
                return (
                    <div key={step.num} className="flex items-center">
                        <div className="flex flex-col items-center">
                            <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${isActive
                                    ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-200'
                                    : 'bg-gray-100 text-gray-400'
                                    }`}
                            >
                                {isDone ? <ShieldCheck size={20} /> : <Icon size={20} />}
                            </div>
                            <p className={`text-xs mt-2 font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                                {step.label}
                            </p>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div
                                className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 transition-colors ${step.num < current ? 'bg-orange-400' : 'bg-gray-200'
                                    }`}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  STATE: not connected                                               */
/* ------------------------------------------------------------------ */
function NotConnected() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-lg mx-auto"
        >
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
                <Wallet size={28} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Connect Your Wallet</h2>
            <p className="text-gray-500 mb-6">
                Connect your wallet using the button in the navbar to begin the KYC verification process.
            </p>
            <div className="text-sm text-gray-400">
                Verification is one-time. Once verified, your wallet receives a soulbound ComplianceNFT.
            </div>
        </motion.div>
    );
}

/* ------------------------------------------------------------------ */
/*  STATE: unverified (none) — show mock verify button                 */
/* ------------------------------------------------------------------ */
function UnverifiedState({ onVerify, isVerifying }: { onVerify: () => void; isVerifying: boolean }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-8 max-w-lg mx-auto"
        >
            <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
                    <UserCheck size={28} className="text-orange-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Identity Verification</h2>
                <p className="text-gray-500 text-sm">
                    Complete a one-time KYC check to access all UniRWA features. Your wallet will receive
                    a soulbound ComplianceNFT — no transfers, no expiry.
                </p>
            </div>

            {/* What you'll need */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">What you&apos;ll need</p>
                {['Valid government-issued ID', 'A brief selfie for liveness check', '~2 minutes of your time'].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                        {item}
                    </div>
                ))}
            </div>

            {/* Info banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                    <strong>Testnet Mode:</strong> This is a sandbox environment. Verification is instant
                    and no real documents are processed. In production, this uses{' '}
                    <a href="https://withpersona.com" target="_blank" rel="noopener noreferrer" className="underline">
                        Persona
                    </a>{' '}
                    for enterprise-grade identity verification.
                </p>
            </div>

            {/* Verify button */}
            <button
                onClick={onVerify}
                disabled={isVerifying}
                className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                style={{
                    background: isVerifying ? '#9CA3AF' : 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                    boxShadow: isVerifying ? 'none' : '0 4px 24px rgba(255,92,22,0.3)',
                }}
            >
                {isVerifying ? (
                    <span className="flex items-center justify-center gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        Verifying...
                    </span>
                ) : (
                    'Begin Verification'
                )}
            </button>

            <p className="text-xs text-gray-400 text-center mt-3">
                Powered by Persona · SOC 2 Type II Certified
            </p>
        </motion.div>
    );
}

/* ------------------------------------------------------------------ */
/*  STATE: pending — waiting for on-chain mint                         */
/* ------------------------------------------------------------------ */
function PendingState() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-lg mx-auto"
        >
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
                <Loader2 size={28} className="text-blue-500 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verification in Progress</h2>
            <p className="text-gray-500 mb-4">
                Your identity has been verified. We&apos;re minting your ComplianceNFT on Avalanche Fuji...
            </p>
            <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-600">
                    This usually takes 10–30 seconds. The page will update automatically.
                </p>
            </div>
        </motion.div>
    );
}

/* ------------------------------------------------------------------ */
/*  STATE: verified — show success + links                             */
/* ------------------------------------------------------------------ */
function VerifiedState() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="bg-white rounded-2xl shadow-lg p-8 max-w-lg mx-auto"
        >
            <div className="text-center mb-8">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4"
                >
                    <ShieldCheck size={36} className="text-green-500" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Identity Verified ✅</h2>
                <p className="text-gray-500">
                    Your wallet holds a soulbound ComplianceNFT. You have full access to UniRWA.
                </p>
            </div>

            {/* NFT Details */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Token</span>
                    <span className="text-gray-900 font-medium">UniRWA Compliance (UKYC)</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Type</span>
                    <span className="text-gray-900 font-medium">Soulbound (non-transferable)</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Status</span>
                    <span className="text-green-600 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Active
                    </span>
                </div>
            </div>

            {/* CTA Links */}
            <div className="grid grid-cols-2 gap-3">
                <Link
                    href="/pools"
                    className="text-center py-3 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5"
                    style={{
                        background: 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                        boxShadow: '0 4px 16px rgba(255,92,22,0.3)',
                    }}
                >
                    Invest in Pools
                </Link>
                <Link
                    href="/trade"
                    className="text-center py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                    Trade Assets
                </Link>
            </div>
        </motion.div>
    );
}

/* ------------------------------------------------------------------ */
/*  STATE: mint failed                                                 */
/* ------------------------------------------------------------------ */
function MintFailedState({ onRetry }: { onRetry: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-lg mx-auto"
        >
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={28} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verification Issue</h2>
            <p className="text-gray-500 mb-6">
                Your identity was verified but the ComplianceNFT mint failed on-chain. This can happen
                due to network congestion on the testnet.
            </p>
            <button
                onClick={onRetry}
                className="px-8 py-3 rounded-xl font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #FF5C16, #FF8A50)' }}
            >
                Retry Verification
            </button>
        </motion.div>
    );
}

/* ------------------------------------------------------------------ */
/*  Main KYC Page                                                      */
/* ------------------------------------------------------------------ */
export default function KYCPage() {
    const { isConnected, address } = useAccount();
    const [kycStatus, setKycStatus] = useState<KycStatus>('none');
    const [isLoading, setIsLoading] = useState(true);
    const [isVerifying, setIsVerifying] = useState(false);

    // Fetch KYC status from backend
    const fetchStatus = useCallback(async () => {
        if (!address) return;
        try {
            const res = await fetch(`${API_BASE}/kyc/status?wallet=${address}`);
            const data = await res.json();
            setKycStatus(data.status as KycStatus);
        } catch (err) {
            console.error('[KYC] Failed to fetch status:', err);
        } finally {
            setIsLoading(false);
        }
    }, [address]);

    // Fetch on mount and when address changes
    useEffect(() => {
        if (isConnected && address) {
            setIsLoading(true);
            fetchStatus();
        } else {
            setIsLoading(false);
            setKycStatus('none');
        }
    }, [isConnected, address, fetchStatus]);

    // Poll while pending
    useEffect(() => {
        if (kycStatus !== 'pending') return;

        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, [kycStatus, fetchStatus]);

    // Mock verify: calls /api/kyc/mock-approve
    const handleVerify = async () => {
        if (!address) return;

        setIsVerifying(true);

        try {
            const res = await fetch(`${API_BASE}/kyc/mock-approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: address }),
            });

            const data = await res.json();

            if (res.ok) {
                setKycStatus('pending');
                toast.success('Verification initiated! Minting ComplianceNFT...');
            } else {
                toast.error(data.error || 'Verification failed');
            }
        } catch (err) {
            console.error('[KYC] Verify error:', err);
            toast.error('Failed to connect to verification service');
        } finally {
            setIsVerifying(false);
        }
    };

    // Determine which step we're on
    const currentStep = !isConnected ? 1 : kycStatus === 'approved' ? 3 : 2;

    // Render state
    const renderState = () => {
        if (!isConnected) return <NotConnected />;
        if (isLoading) {
            return (
                <div className="flex justify-center py-16">
                    <Loader2 size={32} className="text-orange-500 animate-spin" />
                </div>
            );
        }

        switch (kycStatus) {
            case 'none':
                return <UnverifiedState onVerify={handleVerify} isVerifying={isVerifying} />;
            case 'pending':
                return <PendingState />;
            case 'approved':
                return <VerifiedState />;
            case 'mint_failed':
                return <MintFailedState onRetry={handleVerify} />;
            default:
                return <UnverifiedState onVerify={handleVerify} isVerifying={isVerifying} />;
        }
    };

    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-10"
                >
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 mb-2">
                        KYC Verification
                    </h1>
                    <p className="text-gray-500">Verify once, access everything.</p>
                </motion.div>

                {/* Step Progress */}
                <StepProgress current={currentStep} />

                {/* Dynamic State */}
                {renderState()}

                {/* Info footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-center mt-12"
                >
                    <p className="text-xs text-gray-400">
                        ComplianceNFT contract:{' '}
                        <a
                            href={`https://testnet.snowtrace.io/address/${process.env.NEXT_PUBLIC_COMPLIANCE_NFT_ADDRESS}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-500 hover:text-orange-600 inline-flex items-center gap-0.5"
                        >
                            {process.env.NEXT_PUBLIC_COMPLIANCE_NFT_ADDRESS?.slice(0, 6)}...
                            {process.env.NEXT_PUBLIC_COMPLIANCE_NFT_ADDRESS?.slice(-4)}
                            <ExternalLink size={10} />
                        </a>
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
