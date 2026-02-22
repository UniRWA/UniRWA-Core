'use client';

import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import ProgressBar from '@/components/ProgressBar';
import StatusBadge from '@/components/StatusBadge';

/* ------------------------------------------------------------------ */
/*  Hardcoded data                                                     */
/* ------------------------------------------------------------------ */
const POOLS = [
    { id: '0xpool1', asset: 'BUIDL', name: 'BlackRock BUIDL Pool #1', status: 'filling' as const, filled: 5000, threshold: 50000, participants: 4, minDeposit: 1000, apy: '4.50%', myPosition: null },
    { id: '0xpool2', asset: 'BENJI', name: 'Franklin BENJI Pool #1', status: 'filling' as const, filled: 30000, threshold: 50000, participants: 28, minDeposit: 1000, apy: '4.85%', myPosition: 1000 },
    { id: '0xpool3', asset: 'OUSG', name: 'Ondo OUSG Pool #1', status: 'funded' as const, filled: 50000, threshold: 50000, participants: 47, minDeposit: 1000, apy: '4.80%', myPosition: 2000 },
];

const STATUS_BAR_COLORS: Record<string, string> = {
    filling: '#F59E0B',
    funded: '#22C55E',
};

const FILTER_TABS = ['All', 'Filling', 'Funded', 'My Positions'];

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });
    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay }}
        >
            {children}
        </motion.div>
    );
}

export default function PoolsPage() {
    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
                {/* Header */}
                <Reveal>
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 mb-2">
                        Fractional Pools
                    </h1>
                    <p className="text-gray-500 mb-10">Pool together to access institutional-grade RWAs with lower minimums.</p>
                </Reveal>

                {/* Filter tabs */}
                <Reveal delay={0.1}>
                    <div className="flex gap-2 flex-wrap mb-10">
                        {FILTER_TABS.map((tab, i) => (
                            <button
                                key={tab}
                                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${i === 0
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </Reveal>

                {/* Pool cards */}
                <div className="space-y-6">
                    {POOLS.map((pool, i) => (
                        <Reveal key={pool.id} delay={i * 0.1}>
                            <div className="relative bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
                                {/* Left status bar */}
                                <div
                                    className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
                                    style={{ background: STATUS_BAR_COLORS[pool.status] }}
                                />

                                <div className="pl-6 pr-6 py-6 md:pl-8 md:pr-8">
                                    {/* Top row */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl font-bold text-gray-900">{pool.asset}</span>
                                            <span className="text-gray-500">·</span>
                                            <span className="text-sm text-gray-500">{pool.name}</span>
                                            <StatusBadge status={pool.status} />
                                        </div>
                                        {pool.status === 'funded' && pool.myPosition && (
                                            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-full px-4 py-1.5">
                                                ✅ Earning yield
                                            </div>
                                        )}
                                    </div>

                                    {/* Progress bar */}
                                    <div className="mb-4">
                                        <ProgressBar filled={pool.filled} threshold={pool.threshold} showLabel />
                                        <p className="text-sm text-gray-500 mt-2">
                                            ${pool.filled.toLocaleString()} of ${pool.threshold.toLocaleString()}
                                        </p>
                                    </div>

                                    {/* Stats row */}
                                    <div className="flex flex-wrap items-center gap-6 md:gap-10 mb-5">
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-wider">Participants</p>
                                            <p className="text-sm font-semibold text-gray-900">{pool.participants}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-wider">Min Deposit</p>
                                            <p className="text-sm font-semibold text-gray-900">${pool.minDeposit.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-wider">APY</p>
                                            <p
                                                className="text-sm font-bold"
                                                style={{
                                                    background: 'linear-gradient(135deg, #FF5C16, #D075FF)',
                                                    WebkitBackgroundClip: 'text',
                                                    WebkitTextFillColor: 'transparent',
                                                    backgroundClip: 'text',
                                                }}
                                            >
                                                {pool.apy}
                                            </p>
                                        </div>
                                        {pool.myPosition !== null && (
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase tracking-wider">My Position</p>
                                                <p className="text-sm font-semibold text-gray-900">${pool.myPosition.toLocaleString()}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Button row */}
                                    <div className="flex gap-3">
                                        <Link
                                            href={`/pools/${pool.id}`}
                                            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300"
                                            style={{
                                                background: 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                                            }}
                                        >
                                            View Pool
                                        </Link>
                                        <button className="px-6 py-2.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                                            Deposit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </div>
    );
}
