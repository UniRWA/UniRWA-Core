'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/StatusBadge';
import { API_BASE } from '@/config/api';
import { ADDRESSES, ERC20_ABI, RWA_TOKENS, USDC_DECIMALS, RWA_DECIMALS } from '@/config/contracts';
import { useOrderbookPlaceOrder, useOrderbookCancel } from '@/hooks/useOrderbook';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface OrderFromAPI {
    id: number;
    trader: string;
    rwaToken: string;
    isBuy: boolean;
    limitPrice: number;
    rawPrice: string;
    amount: number;
    rawAmount: string;
    filled: number;
    rawFilled: string;
    timestamp: number;
    active: boolean;
}

interface OrdersResponse {
    token: string;
    buys: OrderFromAPI[];
    sells: OrderFromAPI[];
    totalBuys: number;
    totalSells: number;
    pagination: { page: number; limit: number };
}

const ASSET_TABS = ['BUIDL', 'BENJI', 'OUSG'] as const;
type AssetTab = typeof ASSET_TABS[number];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function OrderbookPage() {
    const { isConnected, address } = useAccount();
    const queryClient = useQueryClient();

    // ─── State ───────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<AssetTab>('BUIDL');
    const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
    const [price, setPrice] = useState('1.0038');
    const [orderAmount, setOrderAmount] = useState('');

    // ─── Token lookup ────────────────────────────────────────────────
    const rwaToken = RWA_TOKENS.find(t => t.symbol === activeTab);
    const rwaTokenAddress = rwaToken?.address as `0x${string}`;

    // ─── Fetch live orderbook from backend (poll every 5s) ───────────
    const { data: orderbookData, isLoading: orderbookLoading } = useQuery<OrdersResponse>({
        queryKey: ['orderbook', activeTab],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/orders?token=${activeTab}`);
            if (!res.ok) throw new Error('Failed to fetch orderbook');
            return res.json();
        },
        refetchInterval: 5000,
    });

    const sells = useMemo(() => orderbookData?.sells || [], [orderbookData]);
    const buys = useMemo(() => orderbookData?.buys || [], [orderbookData]);

    // ─── Fetch user's orders from backend (poll every 5s) ────────────
    const { data: myOrdersData, isLoading: myOrdersLoading } = useQuery<OrdersResponse>({
        queryKey: ['myOrders', activeTab, address],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/orders?token=${activeTab}&wallet=${address}`);
            if (!res.ok) throw new Error('Failed to fetch my orders');
            return res.json();
        },
        enabled: !!address,
        refetchInterval: 5000,
    });

    const myOrders = useMemo(() => {
        if (!myOrdersData) return [];
        return [...(myOrdersData.buys || []), ...(myOrdersData.sells || [])].sort(
            (a, b) => b.timestamp - a.timestamp
        );
    }, [myOrdersData]);

    // ─── Read token balances & allowances ────────────────────────────
    const inputToken = orderSide === 'buy' ? ADDRESSES.USDC : rwaTokenAddress;
    const inputDecimals = orderSide === 'buy' ? USDC_DECIMALS : RWA_DECIMALS;

    const { data: balancesData, refetch: refetchBalances } = useReadContracts({
        contracts: [
            {
                address: inputToken,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: address ? [address] : undefined,
            },
            {
                address: inputToken,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: address ? [address, ADDRESSES.ORDERBOOK] : undefined,
            },
        ],
        query: { enabled: !!address },
    });

    const inputBalance = useMemo(() => {
        const raw = balancesData?.[0]?.result as bigint | undefined;
        if (!raw) return 0;
        return Number(raw) / 10 ** inputDecimals;
    }, [balancesData, inputDecimals]);

    const currentAllowance = useMemo(() => {
        const raw = balancesData?.[1]?.result as bigint | undefined;
        return raw ?? BigInt(0);
    }, [balancesData]);

    // ─── Hooks ───────────────────────────────────────────────────────
    const refreshAll = () => {
        queryClient.invalidateQueries({ queryKey: ['orderbook', activeTab] });
        queryClient.invalidateQueries({ queryKey: ['myOrders', activeTab, address] });
        refetchBalances();
    };

    const placeOrder = useOrderbookPlaceOrder(refreshAll);
    const cancelOrderHook = useOrderbookCancel(refreshAll);

    // ─── Computed values ─────────────────────────────────────────────
    const numericPrice = parseFloat(price) || 0;
    const numericAmount = parseFloat(orderAmount) || 0;

    // For buy orders: amount is USDC to spend. "This order will lock X USDC"
    // For sell orders: amount is RWA to sell. "This order will lock X BUIDL"
    const lockAmount = numericAmount;
    const lockToken = orderSide === 'buy' ? 'USDC' : activeTab;
    const total = orderSide === 'buy' ? numericAmount : numericPrice * numericAmount;

    const maxSell = sells.length > 0 ? Math.max(...sells.map(s => s.amount - s.filled)) : 1;
    const maxBuy = buys.length > 0 ? Math.max(...buys.map(b => b.amount - b.filled)) : 1;
    const spread = sells.length > 0 && buys.length > 0
        ? sells[0].limitPrice - buys[0].limitPrice
        : 0;

    const insufficientBalance = numericAmount > inputBalance;

    // ─── Handlers ────────────────────────────────────────────────────
    const handlePlaceOrder = () => {
        if (!rwaTokenAddress || numericAmount <= 0 || numericPrice <= 0) return;

        const isBuy = orderSide === 'buy';
        const rawPrice = BigInt(Math.round(numericPrice * 1e6)); // 6 decimals
        const rawAmount = isBuy
            ? BigInt(Math.round(numericAmount * 10 ** USDC_DECIMALS))
            : BigInt(Math.round(numericAmount * 10 ** RWA_DECIMALS));

        placeOrder.startPlaceOrder(rwaTokenAddress, rawPrice, rawAmount, isBuy, currentAllowance);
    };

    const handleCancelOrder = (orderId: number) => {
        cancelOrderHook.cancelOrder(BigInt(orderId));
    };

    // ─── Button config ───────────────────────────────────────────────
    const getButtonConfig = () => {
        if (!isConnected) return { text: 'Connect wallet to trade', disabled: true };
        if (numericAmount <= 0) return { text: 'Enter an amount', disabled: true };
        if (numericPrice <= 0) return { text: 'Enter a price', disabled: true };
        if (insufficientBalance)
            return { text: `Insufficient ${lockToken} balance`, disabled: true };
        if (placeOrder.state === 'approving' || placeOrder.state === 'waitingApproval')
            return { text: `Approving ${lockToken}... (1/2)`, disabled: true, loading: true };
        if (placeOrder.state === 'placing' || placeOrder.state === 'waitingPlace')
            return { text: 'Placing order... (2/2)', disabled: true, loading: true };

        const needsApproval = currentAllowance < BigInt(Math.round(numericAmount * 10 ** inputDecimals));
        if (needsApproval) {
            return { text: `Step 1: Approve ${lockToken}`, disabled: false };
        }

        return {
            text: `Place ${orderSide === 'buy' ? 'Buy' : 'Sell'} Order`,
            disabled: false,
        };
    };

    const btnConfig = getButtonConfig();

    // ─── Time ago helper ─────────────────────────────────────────────
    const timeAgo = (ts: number) => {
        const now = Math.floor(Date.now() / 1000);
        const diff = now - ts;
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

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
                        {ASSET_TABS.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => {
                                    setActiveTab(tab);
                                    placeOrder.reset();
                                }}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === tab
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
                        <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Order Book — {activeTab}/USDC</h3>

                        {/* Header */}
                        <div className="flex justify-between text-xs text-gray-400 uppercase tracking-wider mb-2 px-1">
                            <span>Price</span>
                            <span>Amount</span>
                        </div>

                        {orderbookLoading ? (
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
                        ) : sells.length === 0 && buys.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-sm text-gray-400">
                                <p>No orders yet</p>
                                <p className="text-xs mt-1">Place the first order to start the orderbook</p>
                            </div>
                        ) : (
                            <>
                                {/* Sell orders (asks) — sorted ascending by price */}
                                <div className="space-y-0.5 mb-3">
                                    {sells.length === 0 ? (
                                        <div className="text-center text-xs text-gray-300 py-4">No sell orders</div>
                                    ) : (
                                        [...sells].reverse().map((order) => {
                                            const remaining = order.amount - order.filled;
                                            return (
                                                <div key={order.id} className="relative flex justify-between items-center py-1.5 px-2 rounded text-sm">
                                                    <div
                                                        className="absolute inset-0 rounded opacity-20"
                                                        style={{
                                                            background: '#EF4444',
                                                            width: `${(remaining / maxSell) * 100}%`,
                                                            right: 0,
                                                            left: 'auto',
                                                        }}
                                                    />
                                                    <span className="relative text-red-500 font-mono font-medium">{order.limitPrice.toFixed(4)}</span>
                                                    <span className="relative text-gray-700 font-mono">{remaining.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Spread */}
                                <div className="flex items-center justify-center gap-2 py-2 border-y border-gray-100 mb-3">
                                    <span className="text-xs text-gray-400">Spread</span>
                                    <span className="text-sm font-bold text-gray-900">
                                        {spread > 0 ? `$${spread.toFixed(4)}` : '—'}
                                    </span>
                                </div>

                                {/* Buy orders (bids) — sorted descending by price */}
                                <div className="space-y-0.5">
                                    {buys.length === 0 ? (
                                        <div className="text-center text-xs text-gray-300 py-4">No buy orders</div>
                                    ) : (
                                        buys.map((order) => {
                                            const remaining = order.amount - order.filled;
                                            return (
                                                <div key={order.id} className="relative flex justify-between items-center py-1.5 px-2 rounded text-sm">
                                                    <div
                                                        className="absolute inset-0 rounded opacity-20"
                                                        style={{
                                                            background: '#22C55E',
                                                            width: `${(remaining / maxBuy) * 100}%`,
                                                            right: 0,
                                                            left: 'auto',
                                                        }}
                                                    />
                                                    <span className="relative text-green-600 font-mono font-medium">{order.limitPrice.toFixed(4)}</span>
                                                    <span className="relative text-gray-700 font-mono">{remaining.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                                </div>
                                            );
                                        })
                                    )}
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
                                    onClick={() => {
                                        setOrderSide(side);
                                        placeOrder.reset();
                                    }}
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

                        {/* Price input */}
                        <div className="mb-4">
                            <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2 block">Price (USDC)</label>
                            <input
                                type="text"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 font-mono outline-none focus:ring-2 focus:ring-brand-orange/30"
                            />
                        </div>

                        {/* Amount input */}
                        <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                                    Amount ({orderSide === 'buy' ? 'USDC' : activeTab})
                                </label>
                                {isConnected && (
                                    <span className="text-xs text-gray-400">
                                        Balance: {inputBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                )}
                            </div>
                            <input
                                type="text"
                                value={orderAmount}
                                onChange={(e) => {
                                    setOrderAmount(e.target.value);
                                    placeOrder.reset();
                                }}
                                placeholder="0"
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 font-mono outline-none focus:ring-2 focus:ring-brand-orange/30"
                            />
                        </div>

                        {/* Lock warning */}
                        {numericAmount > 0 && numericPrice > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4"
                            >
                                <div className="flex items-start gap-2">
                                    <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-amber-700">
                                        This order will lock <span className="font-bold">{lockAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {lockToken}</span> until filled or cancelled.
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* Total */}
                        <div className="flex items-center justify-between text-sm mb-4 px-1">
                            <span className="text-gray-500">
                                {orderSide === 'buy' ? 'Total USDC' : 'Est. Total USDC'}
                            </span>
                            <span className="font-semibold text-gray-900">{total > 0 ? `$${total.toFixed(2)}` : '$0.00'}</span>
                        </div>

                        {/* Progress state */}
                        {(placeOrder.state === 'approving' || placeOrder.state === 'waitingApproval' ||
                            placeOrder.state === 'placing' || placeOrder.state === 'waitingPlace') && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <Loader2 size={14} className="text-blue-500 animate-spin" />
                                        <p className="text-xs font-medium text-blue-700">
                                            {placeOrder.state === 'approving' || placeOrder.state === 'waitingApproval'
                                                ? `Approving ${lockToken}... (Step 1 of 2)`
                                                : 'Placing order... (Step 2 of 2)'}
                                        </p>
                                    </div>
                                    {placeOrder.approveTxHash && (
                                        <a
                                            href={`https://testnet.snowtrace.io/tx/${placeOrder.approveTxHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 mt-1"
                                        >
                                            Approval tx <ExternalLink size={10} />
                                        </a>
                                    )}
                                </div>
                            )}

                        {/* Success state */}
                        {placeOrder.state === 'success' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <CheckCircle2 size={14} className="text-green-500" />
                                    <p className="text-xs font-medium text-green-700">Order placed!</p>
                                </div>
                                {placeOrder.placeTxHash && (
                                    <a
                                        href={`https://testnet.snowtrace.io/tx/${placeOrder.placeTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200 transition-colors"
                                    >
                                        View on SnowTrace <ExternalLink size={10} />
                                    </a>
                                )}
                            </motion.div>
                        )}

                        {/* Error state */}
                        {placeOrder.state === 'error' && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                                <p className="text-xs text-red-700">{placeOrder.errorMessage}</p>
                                <button onClick={placeOrder.reset} className="text-xs text-red-500 hover:text-red-600 mt-1 underline">
                                    Try again
                                </button>
                            </div>
                        )}

                        {/* Submit button */}
                        <button
                            onClick={handlePlaceOrder}
                            disabled={btnConfig.disabled}
                            className="w-full py-3.5 rounded-xl font-semibold transition-all duration-300"
                            style={{
                                background: btnConfig.disabled
                                    ? '#0F0F1A'
                                    : orderSide === 'buy'
                                        ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                                        : 'linear-gradient(135deg, #EF4444, #DC2626)',
                                color: btnConfig.disabled ? 'rgba(255,255,255,0.6)' : '#fff',
                                border: btnConfig.disabled ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                boxShadow: btnConfig.disabled
                                    ? 'none'
                                    : orderSide === 'buy'
                                        ? '0 4px 24px rgba(34,197,94,0.3)'
                                        : '0 4px 24px rgba(239,68,68,0.3)',
                                cursor: btnConfig.disabled ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {(btnConfig as { loading?: boolean }).loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 size={16} className="animate-spin" />
                                    {btnConfig.text}
                                </span>
                            ) : (
                                btnConfig.text
                            )}
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

                            {!isConnected ? (
                                <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                                    Connect wallet to view orders
                                </div>
                            ) : myOrdersLoading ? (
                                <div className="space-y-3">
                                    {[1, 2].map(n => (
                                        <div key={n} className="flex justify-between items-center py-2">
                                            <Skeleton className="h-5 w-12" />
                                            <Skeleton className="h-4 w-14" />
                                            <Skeleton className="h-4 w-14" />
                                            <Skeleton className="h-4 w-14" />
                                        </div>
                                    ))}
                                </div>
                            ) : myOrders.length === 0 ? (
                                <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                                    No open orders
                                </div>
                            ) : (
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
                                            {myOrders.map((order) => (
                                                <tr key={order.id} className="border-b border-gray-50">
                                                    <td className="py-3">
                                                        <StatusBadge status={order.isBuy ? 'buy' : 'sell'} />
                                                    </td>
                                                    <td className="py-3 text-right font-mono text-gray-700">{order.limitPrice.toFixed(4)}</td>
                                                    <td className="py-3 text-right text-gray-700">
                                                        {(order.amount - order.filled).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-3 text-right text-gray-400">{timeAgo(order.timestamp)}</td>
                                                    <td className="py-3 text-right">
                                                        <button
                                                            onClick={() => handleCancelOrder(order.id)}
                                                            disabled={cancelOrderHook.state === 'cancelling' || cancelOrderHook.state === 'waitingCancel'}
                                                            className="text-xs text-red-500 font-medium hover:underline disabled:opacity-50"
                                                        >
                                                            {cancelOrderHook.state === 'cancelling' || cancelOrderHook.state === 'waitingCancel'
                                                                ? 'Cancelling...'
                                                                : 'Cancel'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Cancel error */}
                            {cancelOrderHook.state === 'error' && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-3">
                                    <p className="text-xs text-red-700">{cancelOrderHook.errorMessage}</p>
                                    <button onClick={cancelOrderHook.reset} className="text-xs text-red-500 underline mt-1">
                                        Dismiss
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Trade History */}
                        <div className="bg-white rounded-2xl shadow-md p-5">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Trade History</h3>
                            <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                                {isConnected ? 'No filled trades yet' : 'Connect wallet to view history'}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
