import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { ADDRESSES, ROUTER_ABI, ERC20_ABI, USDC_DECIMALS, RWA_DECIMALS } from '@/config/contracts';
import { parseRevertReason } from '@/lib/utils';

type SwapState = 'idle' | 'approving' | 'waitingApproval' | 'swapping' | 'waitingSwap' | 'success' | 'error';

export function useTradeSwap(onSuccess?: () => void) {
    const [state, setState] = useState<SwapState>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
    const [swapTxHash, setSwapTxHash] = useState<`0x${string}` | undefined>();

    const [swapParams, setSwapParams] = useState<{
        rwaToken: `0x${string}`;
        rawAmount: bigint;
        isSell: boolean;
        minOut: bigint;
    } | null>(null);

    const { writeContract: writeApprove } = useWriteContract();
    const { writeContract: writeSwap } = useWriteContract();

    const { isSuccess: approvalConfirmed } = useWaitForTransactionReceipt({
        hash: approveTxHash,
    });

    const { isSuccess: swapConfirmed } = useWaitForTransactionReceipt({
        hash: swapTxHash,
    });

    useEffect(() => {
        if (approvalConfirmed && swapParams && state === 'waitingApproval') {
            setState('swapping');
            executeSwap();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [approvalConfirmed]);

    useEffect(() => {
        if (swapConfirmed && state === 'waitingSwap') {
            setState('success');
            toast.success('Swap successful! 🎉', {
                description: 'Your trade has been executed.',
                action: swapTxHash
                    ? {
                        label: 'View on SnowTrace',
                        onClick: () =>
                            window.open(
                                `https://testnet.snowtrace.io/tx/${swapTxHash}`,
                                '_blank'
                            ),
                    }
                    : undefined,
            });
            onSuccess?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [swapConfirmed]);

    function startSwap(
        rwaToken: `0x${string}`,
        rawAmount: bigint,
        isSell: boolean,
        minOut: bigint,
        currentAllowance: bigint
    ) {
        setErrorMessage('');
        setSwapParams({ rwaToken, rawAmount, isSell, minOut });
        setApproveTxHash(undefined);
        setSwapTxHash(undefined);

        const inputToken = isSell ? rwaToken : ADDRESSES.USDC;

        if (currentAllowance >= rawAmount) {
            setState('swapping');
            writeSwap(
                {
                    address: ADDRESSES.ROUTER,
                    abi: ROUTER_ABI,
                    functionName: 'executeSwap',
                    args: [rwaToken, rawAmount, isSell, minOut],
                },
                {
                    onSuccess: (hash) => {
                        setSwapTxHash(hash);
                        setState('waitingSwap');
                    },
                    onError: (err) => {
                        setState('error');
                        setErrorMessage(parseRevertReason(err));
                    },
                }
            );
        } else {
            setState('approving');
            writeApprove(
                {
                    address: inputToken,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [ADDRESSES.ROUTER, rawAmount],
                },
                {
                    onSuccess: (hash) => {
                        setApproveTxHash(hash);
                        setState('waitingApproval');
                    },
                    onError: (err) => {
                        setState('error');
                        setErrorMessage(parseRevertReason(err));
                    },
                }
            );
        }
    }

    function executeSwap() {
        if (!swapParams) return;
        const { rwaToken, rawAmount, isSell, minOut } = swapParams;

        writeSwap(
            {
                address: ADDRESSES.ROUTER,
                abi: ROUTER_ABI,
                functionName: 'executeSwap',
                args: [rwaToken, rawAmount, isSell, minOut],
            },
            {
                onSuccess: (hash) => {
                    setSwapTxHash(hash);
                    setState('waitingSwap');
                },
                onError: (err) => {
                    setState('error');
                    setErrorMessage(parseRevertReason(err));
                },
            }
        );
    }

    function reset() {
        setState('idle');
        setErrorMessage('');
        setApproveTxHash(undefined);
        setSwapTxHash(undefined);
        setSwapParams(null);
    }

    return {
        state,
        errorMessage,
        approveTxHash,
        swapTxHash,
        startSwap,
        reset,
    };
}


