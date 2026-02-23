'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/StatusBadge';

/* ------------------------------------------------------------------ */
/*  Hardcoded data                                                     */
/* ------------------------------------------------------------------ */
const SELLS = [
    { price: 1.006, amount: 5000 },
    { price: 1.0055, amount: 800 },
    { price: 1.005, amount: 2000 },
    { price: 1.0045, amount: 1500 },
    { price: 1.0042, amount: 400 },
];

const BUYS = [
    { price: 1.0038, amount: 500 },
    { price: 1.0035, amount: 1000 },
    { price: 1.0032, amount: 2500 },
    { price: 1.0028, amount: 750 },
    { price: 1.002, amount: 3000 },
];

const MY_ORDERS = [
    { id: 1, type: 'buy' as const, price: 1.0028, amount: 750, status: 'open' as const, placed: '10 min ago' },
];

const ASSET_TABS = ['BUIDL', 'BENJI', 'OUSG'];

export default function OrderbookPage() {
    const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
    const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
    const [price, setPrice] = useState('1.0038');
    const [orderAmount, setOrderAmount] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 1500);
        return () => clearTimeout(timer);
    }, []);

    const numericPrice = parseFloat(price) || 0;
    const numericAmount = parseFloat(orderAmount) || 0;
    const total = numericPrice * numericAmount;

    const maxSell = Math.max(...SELLS.map((s) => s.amount));
    const maxBuy = Math.max(...BUYS.map((b) => b.amount));
    const spread = SELLS[SELLS.length - 1].price - BUYS[0].price;

    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-8"
                >
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 mb-2">
                        Orderbook
                    </h1>
                    <div className="flex gap-2 mt-4 mb-6">
                        <Link
                            href="/trade"
                            className="px-5 py-2.5 rounded-full text-sm font-medium bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
                        >
                            Swap
                        </Link>
                        <span className="px-5 py-2.5 rounded-full text-sm font-medium bg-gray-900 text-white">
                            Orderbook
                        </span>
                    </div>

                    {/* Asset tabs */}
                    <div className="flex gap-2">
                        {ASSET_TABS.map((tab, i) => (
                            <button
                                key={tab}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${i === 0
                                    ? 'bg-white shadow-sm text-gray-900 font-semibold'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* 3-column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* LEFT — Order book depth */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="bg-white rounded-2xl shadow-md p-5 overflow-hidden"
                    >
                        <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Order Book — BUIDL/USDC</h3>

                        {/* Header */}
                        <div className="flex justify-between text-xs text-gray-400 uppercase tracking-wider mb-2 px-1">
                            <span>Price</span>
                            <span>Amount</span>
                        </div>

                        {loading ? (
                            <>
                                <div className="space-y-1 mb-3">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <div key={n} className="flex justify-between items-center py-1.5 px-2">
                                            <Skeleton className="h-4 w-16" />
                                            <Skeleton className="h-4 w-14" />
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-center gap-2 py-2 border-y border-gray-100 mb-3">
                                    <Skeleton className="h-4 w-24" />
                                </div>
                                <div className="space-y-1">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <div key={n} className="flex justify-between items-center py-1.5 px-2">
                                            <Skeleton className="h-4 w-16" />
                                            <Skeleton className="h-4 w-14" />
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Sell orders (asks) */}
                                <div className="space-y-0.5 mb-3">
                                    {SELLS.map((order, i) => (
                                        <div key={i} className="relative flex justify-between items-center py-1.5 px-2 rounded text-sm">
                                            <div
                                                className="absolute inset-0 rounded opacity-20"
                                                style={{
                                                    background: '#EF4444',
                                                    width: `${(order.amount / maxSell) * 100}%`,
                                                    right: 0,
                                                    left: 'auto',
                                                }}
                                            />
                                            <span className="relative text-red-500 font-mono font-medium">{order.price.toFixed(4)}</span>
                                            <span className="relative text-gray-700 font-mono">{order.amount.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Spread */}
                                <div className="flex items-center justify-center gap-2 py-2 border-y border-gray-100 mb-3">
                                    <span className="text-xs text-gray-400">Spread</span>
                                    <span className="text-sm font-bold text-gray-900">${spread.toFixed(4)}</span>
                                </div>

                                {/* Buy orders (bids) */}
                                <div className="space-y-0.5">
                                    {BUYS.map((order, i) => (
                                        <div key={i} className="relative flex justify-between items-center py-1.5 px-2 rounded text-sm">
                                            <div
                                                className="absolute inset-0 rounded opacity-20"
                                                style={{
                                                    background: '#22C55E',
                                                    width: `${(order.amount / maxBuy) * 100}%`,
                                                    right: 0,
                                                    left: 'auto',
                                                }}
                                            />
                                            <span className="relative text-green-600 font-mono font-medium">{order.price.toFixed(4)}</span>
                                            <span className="relative text-gray-700 font-mono">{order.amount.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </motion.div>

                    {/* MIDDLE — Place order form */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        className="bg-white rounded-2xl shadow-md p-6"
                    >
                        <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Place Order</h3>

                        {/* Buy/Sell tabs */}
                        <div className="flex mb-5 bg-gray-100 rounded-xl p-1">
                            {(['buy', 'sell'] as const).map((side) => (
                                <button
                                    key={side}
                                    onClick={() => setOrderSide(side)}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold capitalize transition-all duration-200 ${orderSide === side
                                        ? side === 'buy'
                                            ? 'bg-green-500 text-white'
                                            : 'bg-red-500 text-white'
                                        : 'text-gray-500'
                                        }`}
                                >
                                    {side}
                                </button>
                            ))}
                        </div>

                        {/* Limit / Market toggle */}
                        <div className="flex gap-2 mb-5">
                            {(['limit', 'market'] as const).map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setOrderType(type)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${orderType === type
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        {/* Price input */}
                        {orderType === 'limit' && (
                            <div className="mb-4">
                                <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2 block">Price (USDC)</label>
                                <input
                                    type="text"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 font-mono outline-none focus:ring-2 focus:ring-brand-orange/30"
                                />
                            </div>
                        )}

                        {/* Amount input */}
                        <div className="mb-4">
                            <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2 block">Amount (BUIDL)</label>
                            <input
                                type="text"
                                value={orderAmount}
                                onChange={(e) => setOrderAmount(e.target.value)}
                                placeholder="0"
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 font-mono outline-none focus:ring-2 focus:ring-brand-orange/30"
                            />
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between text-sm mb-6 px-1">
                            <span className="text-gray-500">Total</span>
                            <span className="font-semibold text-gray-900">{total > 0 ? `$${total.toFixed(2)}` : '$0.00'}</span>
                        </div>

                        {/* Submit button (disabled) */}
                        <button
                            disabled
                            className="w-full py-3.5 rounded-xl font-semibold cursor-not-allowed"
                            style={{
                                background: '#0F0F1A',
                                color: 'rgba(255,255,255,0.6)',
                                border: '1px solid rgba(255,255,255,0.1)',
                            }}
                        >
                            Connect wallet to trade
                        </button>
                    </motion.div>

                    {/* RIGHT — My Orders */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="space-y-6"
                    >
                        {/* My Open Orders */}
                        <div className="bg-white rounded-2xl shadow-md p-5">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">My Open Orders</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="text-left py-2 text-xs text-gray-400 uppercase tracking-wider font-medium">Type</th>
                                            <th className="text-right py-2 text-xs text-gray-400 uppercase tracking-wider font-medium">Price</th>
                                            <th className="text-right py-2 text-xs text-gray-400 uppercase tracking-wider font-medium">Amt</th>
                                            <th className="text-right py-2 text-xs text-gray-400 uppercase tracking-wider font-medium">When</th>
                                            <th className="text-right py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {MY_ORDERS.map((order) => (
                                            <tr key={order.id} className="border-b border-gray-50">
                                                <td className="py-3">
                                                    <StatusBadge status={order.type as 'buy' | 'sell'} />
                                                </td>
                                                <td className="py-3 text-right font-mono text-gray-700">{order.price.toFixed(4)}</td>
                                                <td className="py-3 text-right text-gray-700">{order.amount.toLocaleString()}</td>
                                                <td className="py-3 text-right text-gray-400">{order.placed}</td>
                                                <td className="py-3 text-right">
                                                    <button className="text-xs text-red-500 font-medium hover:underline">
                                                        Cancel
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Trade History */}
                        <div className="bg-white rounded-2xl shadow-md p-5">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Trade History</h3>
                            <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                                Connect wallet to view history
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
