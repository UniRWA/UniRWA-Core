'use client';

import { motion } from 'framer-motion';
import ProgressBar from '@/components/ProgressBar';
import StatusBadge from '@/components/StatusBadge';
import TxLink from '@/components/TxLink';

/* ------------------------------------------------------------------ */
/*  Hardcoded data                                                     */
/* ------------------------------------------------------------------ */
const POOLS_POS = [
    { pool: 'BUIDL Pool #1', asset: 'BUIDL', deposited: 1000, value: 1023, yield: 23, shares: 950, status: 'filling' as const, filled: 5000, threshold: 50000 },
    { pool: 'BENJI Pool #1', asset: 'BENJI', deposited: 2000, value: 2049, yield: 49, shares: 1910, status: 'funded' as const, filled: 50000, threshold: 50000 },
];

const HOLDINGS = [
    { asset: 'OUSG', amount: 500, nav: 1.0023, value: 501.15 },
    { asset: 'USDC', amount: 8765, nav: 1.0, value: 8765 },
];

const LP = { pool: 'BUIDL/USDC AMM', lpTokens: 100, value: 1000, pendingAVAX: 0.047 };

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

const totalValue = POOLS_POS.reduce((s, p) => s + p.value, 0) + HOLDINGS.reduce((s, h) => s + h.value, 0) + LP.value;
const totalDeposited = POOLS_POS.reduce((s, p) => s + p.deposited, 0) + HOLDINGS.reduce((s, h) => s + h.amount * h.nav, 0) + LP.value;
const totalYield = totalValue - totalDeposited;
const yieldPct = ((totalYield / totalDeposited) * 100).toFixed(2);

export default function PortfolioPage() {
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
                        {POOLS_POS.map((pos) => (
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
                        ))}
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
                    <div className="bg-white rounded-2xl shadow-md overflow-hidden">
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
                                {HOLDINGS.map((h) => (
                                    <tr key={h.asset} className="border-b border-gray-50">
                                        <td className="px-6 py-4 font-semibold text-gray-900">{h.asset}</td>
                                        <td className="px-6 py-4 text-right text-gray-700">{h.amount.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right text-gray-500">${h.nav.toFixed(4)}</td>
                                        <td className="px-6 py-4 text-right font-semibold text-gray-900">${h.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* LP Staking */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mb-8"
                >
                    <h2 className="text-xl font-bold text-gray-900 mb-4">LP Staking</h2>
                    <div className="bg-white rounded-2xl p-6 shadow-md">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h3 className="font-bold text-gray-900 mb-1">{LP.pool}</h3>
                                <div className="flex gap-6 text-sm">
                                    <div>
                                        <span className="text-gray-400">LP Tokens: </span>
                                        <span className="font-semibold text-gray-900">{LP.lpTokens}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Value: </span>
                                        <span className="font-semibold text-gray-900">${LP.value.toLocaleString()}</span>
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
                                            {LP.pendingAVAX} AVAX
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                                    style={{
                                        background: 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                                    }}
                                >
                                    Claim Rewards
                                </button>
                                <button className="px-5 py-2.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                                    Unstake
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Transaction History */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                >
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Transaction History</h2>
                    <div className="bg-white rounded-2xl shadow-md overflow-hidden">
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
