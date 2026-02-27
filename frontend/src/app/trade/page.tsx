'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowDownUp, Info, Settings, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { ADDRESSES, ERC20_ABI, RWA_TOKENS, USDC_DECIMALS, RWA_DECIMALS } from '@/config/contracts';
import { useTradeQuote } from '@/hooks/useTradeQuote';
import { useTradeSwap } from '@/hooks/useTradeSwap';

/* ------------------------------------------------------------------ */
/*  Token list (USDC + RWA tokens)                                     */
/* ------------------------------------------------------------------ */
const ALL_TOKENS = [
    { symbol: 'USDC', name: 'USD Coin', address: ADDRESSES.USDC, decimals: USDC_DECIMALS },
    ...RWA_TOKENS.map((t) => ({ ...t })),
] as const;

/* ------------------------------------------------------------------ */
/*  Main Trade Page                                                    */
/* ------------------------------------------------------------------ */
export default function TradePage() {
    const { isConnected, address } = useAccount();

    // Token selection (default: USDC → BUIDL)
    const [payIdx, setPayIdx] = useState(0);   // USDC
    const [recvIdx, setRecvIdx] = useState(1);  // BUIDL
    const [amount, setAmount] = useState('');
    const [slippage, setSlippage] = useState('0.5');
    const [showSettings, setShowSettings] = useState(false);

    const payToken = ALL_TOKENS[payIdx];
    const recvToken = ALL_TOKENS[recvIdx];

    // Determine swap direction
    // isSell = user is selling RWA for USDC
    // !isSell = user is buying RWA with USDC
    const isSell = payToken.symbol !== 'USDC';
    const rwaToken = isSell ? payToken.address : recvToken.address;

    // ─── Read token balances ────────────────────────────────────────
    const balanceContracts = ALL_TOKENS.map((token) => ({
        address: token.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf' as const,
        args: address ? [address] : undefined,
    }));

    // Read allowance of input token → Router
    const allowanceContract = {
        address: payToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance' as const,
        args: address ? [address, ADDRESSES.ROUTER] : undefined,
    };

    const { data: balancesData, refetch: refetchBalances } = useReadContracts({
        contracts: [...balanceContracts, allowanceContract],
        query: { enabled: !!address },
    });

    // Parse balances
    const balances = useMemo(() => {
        if (!balancesData) return ALL_TOKENS.map(() => 0);
        return ALL_TOKENS.map((token, i) => {
            const raw = balancesData[i]?.result as bigint | undefined;
            if (!raw) return 0;
            return Number(raw) / 10 ** token.decimals;
        });
    }, [balancesData]);

    // Parse allowance
    const currentAllowance = useMemo(() => {
        if (!balancesData) return BigInt(0);
        const raw = balancesData[ALL_TOKENS.length]?.result as bigint | undefined;
        return raw ?? BigInt(0);
    }, [balancesData]);

    // ─── Trade quote from Router ────────────────────────────────────
    const payIsUSDC = payToken.symbol === 'USDC';
    const recvIsUSDC = recvToken.symbol === 'USDC';
    const sameToken = payIdx === recvIdx;
    const bothUSDC = payIsUSDC && recvIsUSDC;
    const neitherUSDC = !payIsUSDC && !recvIsUSDC;

    // Only quote when one side is USDC and other is RWA
    const canQuote = !sameToken && !bothUSDC && !neitherUSDC;

    const quote = useTradeQuote(
        canQuote ? (rwaToken as `0x${string}`) : undefined,
        canQuote ? amount : '',
        isSell
    );

    // ─── Swap execution ─────────────────────────────────────────────
    const swap = useTradeSwap(() => {
        refetchBalances();
    });

    // ─── Computed values ────────────────────────────────────────────
    const numericAmount = parseFloat(amount) || 0;
    const payBalance = balances[payIdx];
    const recvBalance = balances[recvIdx];
    const insufficientBalance = numericAmount > payBalance;
    const slippageNum = parseFloat(slippage) || 0.5;
    const minReceived = quote.expectedOut * (1 - slippageNum / 100);

    // Rate calculation
    const rate = numericAmount > 0 && quote.expectedOut > 0
        ? quote.expectedOut / numericAmount
        : 0;

    // ─── Swap button logic ──────────────────────────────────────────
    const handleSwap = () => {
        if (!canQuote || !quote.rawAmount) return;

        const minOutRaw = BigInt(
            Math.floor(minReceived * 10 ** (isSell ? USDC_DECIMALS : RWA_DECIMALS))
        );

        swap.startSwap(
            rwaToken as `0x${string}`,
            quote.rawAmount,
            isSell,
            minOutRaw,
            currentAllowance
        );
    };

    // Flip tokens
    const flipTokens = () => {
        setPayIdx(recvIdx);
        setRecvIdx(payIdx);
        setAmount('');
        swap.reset();
    };

    // Button state
    const getButtonConfig = () => {
        if (!isConnected) return { text: 'Connect wallet to swap', disabled: true };
        if (sameToken) return { text: 'Select different tokens', disabled: true };
        if (bothUSDC || neitherUSDC) return { text: 'Select a RWA token', disabled: true };
        if (!amount || numericAmount <= 0) return { text: 'Enter an amount', disabled: true };
        if (insufficientBalance) return { text: `Insufficient ${payToken.symbol} balance`, disabled: true };
        if (quote.isLoading) return { text: 'Fetching quote...', disabled: true };
        if (quote.error) return { text: 'Quote unavailable', disabled: true };
        if (swap.state === 'approving' || swap.state === 'waitingApproval')
            return { text: `Approving ${payToken.symbol}... (1/2)`, disabled: true, loading: true };
        if (swap.state === 'swapping' || swap.state === 'waitingSwap')
            return { text: 'Swapping... (2/2)', disabled: true, loading: true };

        // Check if we need approval
        const needsApproval = currentAllowance < quote.rawAmount;
        if (needsApproval) {
            return { text: `Step 1: Approve ${payToken.symbol}`, disabled: false };
        }
        return { text: `Swap ${payToken.symbol} → ${recvToken.symbol}`, disabled: false };
    };

    const btnConfig = getButtonConfig();

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

                {/* ────────── Swap Card ────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="max-w-lg mx-auto bg-white rounded-3xl shadow-lg p-4 sm:p-6 md:p-8 mb-12"
                >
                    {/* Settings gear */}
                    <div className="flex justify-end mb-2">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <Settings size={18} />
                        </button>
                    </div>

                    {/* Slippage settings popover */}
                    {showSettings && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-gray-50 rounded-xl p-4 mb-4"
                        >
                            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">
                                Slippage Tolerance
                            </p>
                            <div className="flex gap-2">
                                {['0.1', '0.5', '1.0'].map((val) => (
                                    <button
                                        key={val}
                                        onClick={() => setSlippage(val)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${slippage === val
                                            ? 'bg-gray-900 text-white'
                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                            }`}
                                    >
                                        {val}%
                                    </button>
                                ))}
                                <input
                                    type="text"
                                    value={slippage}
                                    onChange={(e) => setSlippage(e.target.value)}
                                    placeholder="Custom"
                                    className="w-20 px-3 py-1.5 rounded-lg text-sm text-right border border-gray-200 outline-none focus:ring-2 focus:ring-orange-200"
                                />
                                <span className="text-sm text-gray-400 self-center">%</span>
                            </div>
                        </motion.div>
                    )}

                    {/* ── You Pay ── */}
                    <div className="mb-2">
                        <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2 block">
                            You Pay
                        </label>
                        <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4">
                            <select
                                value={payIdx}
                                onChange={(e) => {
                                    setPayIdx(Number(e.target.value));
                                    swap.reset();
                                }}
                                className="bg-transparent text-lg font-bold text-gray-900 outline-none cursor-pointer"
                            >
                                {ALL_TOKENS.map((a, i) => (
                                    <option key={a.symbol} value={i}>
                                        {a.symbol}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={amount}
                                onChange={(e) => {
                                    setAmount(e.target.value);
                                    swap.reset();
                                }}
                                className="flex-1 text-right text-xl sm:text-2xl font-bold text-gray-900 bg-transparent outline-none min-w-0"
                                placeholder="0"
                            />
                        </div>
                        <div className="flex justify-between mt-1.5 px-1">
                            <p className="text-xs text-gray-400">
                                Balance: {isConnected ? payBalance.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'} {payToken.symbol}
                            </p>
                            {isConnected && payBalance > 0 && (
                                <button
                                    onClick={() => setAmount(String(Math.floor(payBalance * 100) / 100))}
                                    className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                                >
                                    MAX
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Flip button ── */}
                    <div className="flex justify-center -my-2 relative z-10">
                        <button
                            onClick={flipTokens}
                            className="w-10 h-10 rounded-full bg-white border-4 border-gray-50 shadow-md flex items-center justify-center hover:rotate-180 transition-transform duration-300"
                        >
                            <ArrowDownUp size={16} className="text-gray-400" />
                        </button>
                    </div>

                    {/* ── You Receive ── */}
                    <div className="mb-4">
                        <label className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2 block">
                            You Receive
                        </label>
                        <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4">
                            <select
                                value={recvIdx}
                                onChange={(e) => {
                                    setRecvIdx(Number(e.target.value));
                                    swap.reset();
                                }}
                                className="bg-transparent text-lg font-bold text-gray-900 outline-none cursor-pointer"
                            >
                                {ALL_TOKENS.map((a, i) => (
                                    <option key={a.symbol} value={i}>
                                        {a.symbol}
                                    </option>
                                ))}
                            </select>
                            <div className="flex-1 text-right text-xl sm:text-2xl font-bold text-gray-900 min-w-0 truncate">
                                {quote.isLoading ? (
                                    <Loader2 size={20} className="inline animate-spin text-gray-400" />
                                ) : quote.expectedOut > 0 ? (
                                    quote.expectedOut.toLocaleString('en-US', { maximumFractionDigits: 4 })
                                ) : (
                                    '0'
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5 text-right px-1">
                            Balance: {isConnected ? recvBalance.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'} {recvToken.symbol}
                        </p>
                    </div>

                    {/* ── Quote info box ── */}
                    {canQuote && numericAmount > 0 && quote.expectedOut > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2"
                        >
                            {[
                                { label: 'Route', value: quote.route },
                                {
                                    label: 'Rate',
                                    value: `1 ${payToken.symbol} = ${rate.toFixed(4)} ${recvToken.symbol}`,
                                },
                                {
                                    label: 'Fee (0.3%)',
                                    value: `${quote.fee.toFixed(2)} ${payToken.symbol}`,
                                },
                                {
                                    label: 'Price Impact',
                                    value: quote.priceImpact < 0.01 ? '< 0.01%' : `${quote.priceImpact.toFixed(2)}%`,
                                },
                                {
                                    label: `Min Received (${slippage}% slippage)`,
                                    value: `${minReceived.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${recvToken.symbol}`,
                                },
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

                    {/* ── Swap progress ── */}
                    {(swap.state === 'approving' || swap.state === 'waitingApproval' ||
                        swap.state === 'swapping' || swap.state === 'waitingSwap') && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Loader2 size={16} className="text-blue-500 animate-spin" />
                                    <p className="text-sm font-medium text-blue-700">
                                        {swap.state === 'approving' || swap.state === 'waitingApproval'
                                            ? `Approving ${payToken.symbol}... (Step 1 of 2)`
                                            : 'Executing swap... (Step 2 of 2)'}
                                    </p>
                                </div>
                                {swap.approveTxHash && (
                                    <a
                                        href={`https://testnet.snowtrace.io/tx/${swap.approveTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                                    >
                                        Approval tx <ExternalLink size={10} />
                                    </a>
                                )}
                            </div>
                        )}

                    {/* ── Success state ── */}
                    {swap.state === 'success' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 size={18} className="text-green-500" />
                                <p className="text-sm font-medium text-green-700">Swap successful!</p>
                            </div>
                            {swap.swapTxHash && (
                                <a
                                    href={`https://testnet.snowtrace.io/tx/${swap.swapTxHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 transition-colors"
                                >
                                    View on SnowTrace <ExternalLink size={10} />
                                </a>
                            )}
                        </motion.div>
                    )}

                    {/* ── Error state ── */}
                    {swap.state === 'error' && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                            <p className="text-sm text-red-700">{swap.errorMessage}</p>
                            <button
                                onClick={swap.reset}
                                className="text-xs text-red-500 hover:text-red-600 mt-1 underline"
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {/* ── Swap button ── */}
                    <button
                        onClick={handleSwap}
                        disabled={btnConfig.disabled}
                        className="w-full py-4 rounded-2xl font-semibold text-base transition-all duration-300"
                        style={{
                            background: btnConfig.disabled
                                ? '#0F0F1A'
                                : 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                            color: btnConfig.disabled ? 'rgba(255,255,255,0.6)' : '#fff',
                            border: btnConfig.disabled ? '1px solid rgba(255,255,255,0.1)' : 'none',
                            boxShadow: btnConfig.disabled ? 'none' : '0 4px 24px rgba(255,92,22,0.3)',
                            cursor: btnConfig.disabled ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {(btnConfig as { loading?: boolean }).loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 size={18} className="animate-spin" />
                                {btnConfig.text}
                            </span>
                        ) : (
                            btnConfig.text
                        )}
                    </button>
                </motion.div>

                {/* ────────── Recent Trades (placeholder) ────────── */}
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
                                    <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">
                                        Asset
                                    </th>
                                    <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">
                                        Direction
                                    </th>
                                    <th className="text-right px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">
                                        Amount
                                    </th>
                                    <th className="text-right px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">
                                        Rate
                                    </th>
                                    <th className="text-right px-6 py-3 text-xs text-gray-400 uppercase tracking-wider font-medium">
                                        Time
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">
                                        Trade history will appear after swaps are executed on-chain.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
