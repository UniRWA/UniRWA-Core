'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';
import ProgressBar from '@/components/ProgressBar';

/* ------------------------------------------------------------------ */
/*  Hardcoded data                                                     */
/* ------------------------------------------------------------------ */
const ASSET = {
    symbol: 'BUIDL',
    name: 'BlackRock USD Institutional Digital Liquidity Fund',
    issuer: 'Securitize / BlackRock',
    nav: 1.0045,
    apy: 4.5,
    tvl: '$217M',
    type: 'Treasury Money Market',
    description:
        'BUIDL is a tokenized money market fund investing in US Treasury bills, dollar cash, and repurchase agreements. Managed by BlackRock on Avalanche C-Chain.',
    riskRating: 'Very Low',
};

const PRICE_HISTORY = [
    { date: 'Feb 16', nav: 1.0039 },
    { date: 'Feb 17', nav: 1.004 },
    { date: 'Feb 18', nav: 1.0041 },
    { date: 'Feb 19', nav: 1.0042 },
    { date: 'Feb 20', nav: 1.0043 },
    { date: 'Feb 21', nav: 1.0044 },
    { date: 'Feb 22', nav: 1.0045 },
];

const CHART_TABS = ['7D', '30D', '90D'];

export default function AssetDetailPage() {
    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
                {/* Back link */}
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-8"
                    >
                        <ArrowLeft size={16} />
                        Markets
                    </Link>
                </motion.div>

                {/* Dark header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="rounded-2xl p-8 md:p-10 mb-8 relative overflow-hidden"
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
                        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                            <h1 className="text-3xl md:text-4xl font-black text-white">{ASSET.symbol}</h1>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-900/30 text-green-400 border border-green-800/30">
                                {ASSET.riskRating} Risk
                            </span>
                        </div>
                        <p className="text-white/50 text-sm mb-6">{ASSET.name}</p>
                        <p
                            className="text-4xl md:text-5xl font-black"
                            style={{
                                background: 'linear-gradient(135deg, #FF5C16, #FFA680, #D075FF)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            {ASSET.apy}% APY
                        </p>
                    </div>
                </motion.div>

                {/* NAV Chart Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.05 }}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-md mb-8"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-gray-900">NAV Price History</h2>
                        <div className="flex gap-1">
                            {CHART_TABS.map((tab, i) => (
                                <button
                                    key={tab}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${i === 0
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-500 hover:bg-gray-100'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-64 md:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={PRICE_HISTORY} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                                <YAxis
                                    domain={['dataMin - 0.0002', 'dataMax + 0.0002']}
                                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v: number) => `$${v.toFixed(4)}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: '#0A0A0E',
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: '#fff',
                                        fontSize: '13px',
                                    }}
                                    formatter={(value) => [`$${Number(value).toFixed(4)}`, 'NAV']}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="nav"
                                    stroke="#FF5C16"
                                    strokeWidth={3}
                                    dot={false}
                                    activeDot={{ r: 6, fill: '#FF5C16', strokeWidth: 0 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* 4 Metrics Cards */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
                >
                    {[
                        { label: 'Total Value Locked', value: ASSET.tvl },
                        { label: 'Min Investment', value: '$50,000' },
                        { label: 'Current NAV', value: `$${ASSET.nav.toFixed(4)}` },
                        { label: 'APY', value: `${ASSET.apy}%`, gradient: true },
                    ].map((metric) => (
                        <div key={metric.label} className="bg-white rounded-2xl p-5 shadow-md">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{metric.label}</p>
                            {metric.gradient ? (
                                <p
                                    className="text-2xl font-bold"
                                    style={{
                                        background: 'linear-gradient(135deg, #FF5C16, #D075FF)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                    }}
                                >
                                    {metric.value}
                                </p>
                            ) : (
                                <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                            )}
                        </div>
                    ))}
                </motion.div>

                {/* About section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.15 }}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-md mb-8"
                >
                    <h2 className="text-lg font-bold text-gray-900 mb-3">About {ASSET.symbol}</h2>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">{ASSET.description}</p>
                    <div className="flex flex-wrap gap-4 sm:gap-8 text-sm">
                        <div>
                            <span className="text-gray-400">Issuer: </span>
                            <span className="font-semibold text-gray-900">{ASSET.issuer}</span>
                        </div>
                        <div>
                            <span className="text-gray-400">Type: </span>
                            <span className="font-semibold text-gray-900">{ASSET.type}</span>
                        </div>
                    </div>
                </motion.div>

                {/* Access Options — two cards side by side */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
                >
                    {/* Join a Pool */}
                    <div className="bg-white rounded-2xl p-6 shadow-md">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Join a Pool</h3>
                        <p className="text-sm text-gray-500 mb-4">Pool together with others to meet the minimum investment.</p>
                        <div className="bg-gray-50 rounded-xl p-4 mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-gray-900">BUIDL Pool #1</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                    filling
                                </span>
                            </div>
                            <ProgressBar filled={5000} threshold={50000} showLabel />
                        </div>
                        <Link
                            href="/pools/0xpool1"
                            className="block text-center py-2.5 rounded-xl text-sm font-semibold text-white w-full transition-all duration-300"
                            style={{
                                background: 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                            }}
                        >
                            View Pool →
                        </Link>
                    </div>

                    {/* Primary Market */}
                    <div className="bg-white rounded-2xl p-6 shadow-md">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Primary Market</h3>
                        <p className="text-sm text-gray-500 mb-4">Purchase directly from the issuer (higher minimum).</p>
                        <div className="bg-gray-50 rounded-xl p-4 mb-4">
                            <p className="text-sm text-gray-700">
                                <span className="font-semibold">Minimum:</span> $50,000
                            </p>
                            <p className="text-sm text-gray-400 mt-1">Via {ASSET.issuer}</p>
                        </div>
                        <a
                            href="https://securitize.io"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-center py-2.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors w-full"
                        >
                            Visit Issuer →
                        </a>
                    </div>
                </motion.div>

                {/* Secondary Market Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                    className="bg-white rounded-2xl p-6 shadow-md"
                >
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Secondary Market</h3>
                    <div className="flex flex-col sm:flex-row gap-6">
                        <div className="flex-1">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Best Bid</p>
                            <p className="text-lg font-bold text-green-600">$1.0038</p>
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Best Ask</p>
                            <p className="text-lg font-bold text-red-500">$1.0042</p>
                        </div>
                        <div className="flex items-end gap-3">
                            <Link
                                href="/trade"
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                                style={{
                                    background: 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                                }}
                            >
                                Swap
                            </Link>
                            <Link
                                href="/trade/orderbook"
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Orderbook
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
