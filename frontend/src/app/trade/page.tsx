'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowDownUp, Info } from 'lucide-react';
import { useState } from 'react';
import StatusBadge from '@/components/StatusBadge';

/* ------------------------------------------------------------------ */
/*  Hardcoded data                                                     */
/* ------------------------------------------------------------------ */
const ASSETS = [
    { symbol: 'BUIDL', nav: 1.0045, balance: 1000 },
    { symbol: 'BENJI', nav: 1.0081, balance: 0 },
    { symbol: 'OUSG', nav: 1.0023, balance: 500 },
    { symbol: 'USDC', nav: 1.0, balance: 8977 },
];

const RECENT = [
    { asset: 'BUIDL', dir: 'Sell', amount: '500', rate: '$1.0032', time: '2 min ago' },
    { asset: 'OUSG', dir: 'Buy', amount: '1,000', rate: '$1.0020', time: '7 min ago' },
    { asset: 'BUIDL', dir: 'Buy', amount: '2,500', rate: '$1.0044', time: '15 min ago' },
];

export default function TradePage() {
    const [payIdx, setPayIdx] = useState(3); // USDC
    const [receiveIdx, setReceiveIdx] = useState(0); // BUIDL
    const [amount, setAmount] = useState('1000');

    const payAsset = ASSETS[payIdx];
    const receiveAsset = ASSETS[receiveIdx];

    const numericAmount = parseFloat(amount.replace(/,/g, '')) || 0;
    const feeRate = 0.003;
    const output = numericAmount > 0 ? numericAmount * (payAsset.nav / receiveAsset.nav) * (1 - feeRate) : 0;
    const rate = payAsset.nav / receiveAsset.nav;
    const fee = numericAmount * feeRate;
    const minReceived = output * 0.995;

    return (
        <div className="min-h-screen bg-brand-cream">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-10"
                >
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 mb-2">
                        Secondary Market
                    </h1>
                    <div className="flex gap-2 mt-4">
                        <span className="px-5 py-2.5 rounded-full text-sm font-medium bg-gray-900 text-white">
                            Swap
                        </span>
                        <Link
                            href="/trade/orderbook"
                            className="px-5 py-2.5 rounded-full text-sm font-medium bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
                        >
                            Orderbook
                        </Link>
                    </div>
                </motion.div>

                {/* Swap card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="max-w-lg mx-auto bg-white rounded-3xl shadow-lg p-4 sm:p-6 md:p-8 mb-12"
                >
                    {/* You Pay */}
                    <div className="mb-2">
                        <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2 block">You Pay</label>
                        <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4">
                            <select
                                value={payIdx}
                                onChange={(e) => setPayIdx(Number(e.target.value))}
                                className="bg-transparent text-lg font-bold text-gray-900 outline-none cursor-pointer"
                            >
                                {ASSETS.map((a, i) => (
                                    <option key={a.symbol} value={i}>{a.symbol}</option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="flex-1 text-right text-xl sm:text-2xl font-bold text-gray-900 bg-transparent outline-none min-w-0"
                                placeholder="0"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5 text-right">
                            Balance: {payAsset.balance.toLocaleString()} {payAsset.symbol}
                        </p>
                    </div>

                    {/* Flip button */}
                    <div className="flex justify-center -my-2 relative z-10">
                        <button
                            onClick={() => {
                                setPayIdx(receiveIdx);
                                setReceiveIdx(payIdx);
                            }}
                            className="w-10 h-10 rounded-full bg-white border-4 border-gray-50 shadow-md flex items-center justify-center hover:rotate-180 transition-transform duration-300"
                        >
                            <ArrowDownUp size={16} className="text-gray-400" />
                        </button>
                    </div>

                    {/* You Receive */}
                    <div className="mb-4">
                        <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2 block">You Receive</label>
                        <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4">
                            <select
                                value={receiveIdx}
                                onChange={(e) => setReceiveIdx(Number(e.target.value))}
                                className="bg-transparent text-lg font-bold text-gray-900 outline-none cursor-pointer"
                            >
                                {ASSETS.map((a, i) => (
                                    <option key={a.symbol} value={i}>{a.symbol}</option>
                                ))}
                            </select>
                            <div className="flex-1 text-right text-xl sm:text-2xl font-bold text-gray-900 min-w-0 truncate">
                                {output > 0 ? output.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'}
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5 text-right">
                            Balance: {receiveAsset.balance.toLocaleString()} {receiveAsset.symbol}
                        </p>
                    </div>

                    {/* Quote info box */}
                    {numericAmount > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2"
                        >
                            {[
                                { label: 'Route', value: `${payAsset.symbol} → ${receiveAsset.symbol}` },
                                { label: 'Rate', value: `1 ${payAsset.symbol} = ${rate.toFixed(4)} ${receiveAsset.symbol}` },
                                { label: 'Fee (0.3%)', value: `${fee.toFixed(2)} ${payAsset.symbol}` },
                                { label: 'Price Impact', value: '< 0.01%' },
                                { label: 'Min Received', value: `${minReceived.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${receiveAsset.symbol}` },
                            ].map((item) => (
                                <div key={item.label} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500 flex items-center gap-1">
                                        {item.label}
                                        <Info size={12} className="text-gray-300" />
                                    </span>
                                    <span className="text-gray-700 font-medium">{item.value}</span>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {/* Swap button (disabled) */}
                    <button
                        disabled
                        className="w-full py-4 rounded-2xl font-semibold text-base cursor-not-allowed"
                        style={{
                            background: '#0F0F1A',
                            color: 'rgba(255,255,255,0.6)',
                            border: '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        Connect wallet to swap
                    </button>
                </motion.div>

                {/* Recent Trades */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="max-w-3xl mx-auto"
                >
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Trades</h2>
                    <div className="bg-white rounded-2xl shadow-md overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Asset</th>
                                    <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Direction</th>
                                    <th className="text-right px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Amount</th>
                                    <th className="text-right px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Rate</th>
                                    <th className="text-right px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {RECENT.map((trade, i) => (
                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-gray-900">{trade.asset}</td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={trade.dir === 'Buy' ? 'buy' : 'sell'} />
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-900">{trade.amount}</td>
                                        <td className="px-6 py-4 text-right text-gray-500">{trade.rate}</td>
                                        <td className="px-6 py-4 text-right text-gray-400">{trade.time}</td>
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
