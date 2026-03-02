import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { ADDRESSES, ORDERBOOK_ABI, ERC20_ABI, USDC_DECIMALS, RWA_DECIMALS } from '@/config/contracts';

type OrderState = 'idle' | 'approving' | 'waitingApproval' | 'placing' | 'waitingPlace' | 'success' | 'error';

// ─── Place Order Hook ──────────────────────────────────────────────
export function useOrderbookPlaceOrder(onSuccess?: () => void) {
    const [state, setState] = useState<OrderState>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
    const [placeTxHash, setPlaceTxHash] = useState<`0x${string}` | undefined>();

    const [orderParams, setOrderParams] = useState<{
        rwaToken: `0x${string}`;
        limitPrice: bigint;
        amount: bigint;
        isBuy: boolean;
    } | null>(null);

    const { writeContract: writeApprove } = useWriteContract();
    const { writeContract: writePlace } = useWriteContract();

    const { isSuccess: approvalConfirmed } = useWaitForTransactionReceipt({
        hash: approveTxHash,
    });

    const { isSuccess: placeConfirmed } = useWaitForTransactionReceipt({
        hash: placeTxHash,
    });

    useEffect(() => {
        if (approvalConfirmed && orderParams && state === 'waitingApproval') {
            setState('placing');
            executePlaceOrder();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [approvalConfirmed]);

    useEffect(() => {
        if (placeConfirmed && state === 'waitingPlace') {
            setState('success');
            toast.success('Order placed! 🎉', {
                description: orderParams?.isBuy
                    ? 'Your buy order is now live on the orderbook.'
                    : 'Your sell order is now live on the orderbook.',
                action: placeTxHash
                    ? {
                        label: 'View on SnowTrace',
                        onClick: () =>
                            window.open(
                                `https://testnet.snowtrace.io/tx/${placeTxHash}`,
                                '_blank'
                            ),
                    }
                    : undefined,
            });
            onSuccess?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [placeConfirmed]);

    function startPlaceOrder(
        rwaToken: `0x${string}`,
        limitPrice: bigint,
        amount: bigint,
        isBuy: boolean,
        currentAllowance: bigint
    ) {
        setErrorMessage('');
        setOrderParams({ rwaToken, limitPrice, amount, isBuy });
        setApproveTxHash(undefined);
        setPlaceTxHash(undefined);

        // Determine which token needs approval
        const inputToken = isBuy ? ADDRESSES.USDC : rwaToken;

        if (currentAllowance >= amount) {
            // Already approved, place directly
            setState('placing');
            executePlaceOrderDirect(rwaToken, limitPrice, amount, isBuy);
        } else {
            // Need approval first
            setState('approving');
            writeApprove(
                {
                    address: inputToken,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [ADDRESSES.ORDERBOOK, amount],
                },
                {
                    onSuccess: (hash) => {
                        setApproveTxHash(hash);
                        setState('waitingApproval');
                    },
                    onError: (err) => {
                        setState('error');
                        setErrorMessage(parseError(err.message));
                    },
                }
            );
        }
    }

    function executePlaceOrderDirect(
        rwaToken: `0x${string}`,
        limitPrice: bigint,
        amount: bigint,
        isBuy: boolean
    ) {
        const functionName = isBuy ? 'placeBuyOrder' : 'placeSellOrder';
        const args: [`0x${string}`, bigint, bigint] = [rwaToken, limitPrice, amount];

        writePlace(
            {
                address: ADDRESSES.ORDERBOOK,
                abi: ORDERBOOK_ABI,
                functionName,
                args,
            },
            {
                onSuccess: (hash) => {
                    setPlaceTxHash(hash);
                    setState('waitingPlace');
                },
                onError: (err) => {
                    setState('error');
                    setErrorMessage(parseError(err.message));
                },
            }
        );
    }

    function executePlaceOrder() {
        if (!orderParams) return;
        executePlaceOrderDirect(
            orderParams.rwaToken,
            orderParams.limitPrice,
            orderParams.amount,
            orderParams.isBuy
        );
    }

    function reset() {
        setState('idle');
        setErrorMessage('');
        setApproveTxHash(undefined);
        setPlaceTxHash(undefined);
        setOrderParams(null);
    }

    return {
        state,
        errorMessage,
        approveTxHash,
        placeTxHash,
        startPlaceOrder,
        reset,
    };
}

// ─── Cancel Order Hook ─────────────────────────────────────────────
type CancelState = 'idle' | 'cancelling' | 'waitingCancel' | 'success' | 'error';

export function useOrderbookCancel(onSuccess?: () => void) {
    const [state, setState] = useState<CancelState>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [cancelTxHash, setCancelTxHash] = useState<`0x${string}` | undefined>();

    const { writeContract: writeCancel } = useWriteContract();

    const { isSuccess: cancelConfirmed } = useWaitForTransactionReceipt({
        hash: cancelTxHash,
    });

    useEffect(() => {
        if (cancelConfirmed && state === 'waitingCancel') {
            setState('success');
            toast.success('Order cancelled', {
                description: 'Tokens returned to your wallet.',
                action: cancelTxHash
                    ? {
                        label: 'View on SnowTrace',
                        onClick: () =>
                            window.open(
                                `https://testnet.snowtrace.io/tx/${cancelTxHash}`,
                                '_blank'
                            ),
                    }
                    : undefined,
            });
            onSuccess?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cancelConfirmed]);

    function cancelOrder(orderId: bigint) {
        setErrorMessage('');
        setCancelTxHash(undefined);
        setState('cancelling');

        writeCancel(
            {
                address: ADDRESSES.ORDERBOOK,
                abi: ORDERBOOK_ABI,
                functionName: 'cancelOrder',
                args: [orderId],
            },
            {
                onSuccess: (hash) => {
                    setCancelTxHash(hash);
                    setState('waitingCancel');
                },
                onError: (err) => {
                    setState('error');
                    setErrorMessage(parseError(err.message));
                },
            }
        );
    }

    function reset() {
        setState('idle');
        setErrorMessage('');
        setCancelTxHash(undefined);
    }

    return {
        state,
        errorMessage,
        cancelTxHash,
        cancelOrder,
        reset,
    };
}

// ─── Error parser ──────────────────────────────────────────────────
function parseError(msg: string): string {
    if (msg.includes('User rejected')) return 'Transaction rejected by user';
    if (msg.includes('KYC required')) return 'KYC verification required';
    if (msg.includes('Amount must be positive')) return 'Amount must be greater than 0';
    if (msg.includes('Not order owner')) return 'You can only cancel your own orders';
    if (msg.includes('Order not active')) return 'This order is no longer active';
    if (msg.includes('insufficient allowance')) return 'Token approval required — please try again';
    return msg.slice(0, 150);
}
