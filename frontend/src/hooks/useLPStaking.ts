import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { ADDRESSES, LIQUIDITY_MINING_ABI } from '@/config/contracts';

type StakeState = 'idle' | 'staking' | 'waitingStake' | 'success' | 'error';
type ClaimState = 'idle' | 'claiming' | 'waitingClaim' | 'success' | 'error';

// ─── Stake Hook ────────────────────────────────────────────────────
export function useLPStake(onSuccess?: () => void) {
    const [state, setState] = useState<StakeState>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

    const { writeContract } = useWriteContract();

    const { isSuccess: confirmed } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    useEffect(() => {
        if (confirmed && state === 'waitingStake') {
            setState('success');
            toast.success('LP tokens staked! 🎉', {
                description: 'You are now earning AVAX rewards.',
                action: txHash
                    ? {
                        label: 'View on SnowTrace',
                        onClick: () =>
                            window.open(`https://testnet.snowtrace.io/tx/${txHash}`, '_blank'),
                    }
                    : undefined,
            });
            onSuccess?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [confirmed]);

    function stake(lpPool: `0x${string}`, amount: bigint) {
        setErrorMessage('');
        setTxHash(undefined);
        setState('staking');

        writeContract(
            {
                address: ADDRESSES.LIQUIDITY_MINING,
                abi: LIQUIDITY_MINING_ABI,
                functionName: 'stake',
                args: [lpPool, amount],
            },
            {
                onSuccess: (hash) => {
                    setTxHash(hash);
                    setState('waitingStake');
                },
                onError: (err) => {
                    setState('error');
                    setErrorMessage(parseStakingError(err.message));
                },
            }
        );
    }

    function reset() {
        setState('idle');
        setErrorMessage('');
        setTxHash(undefined);
    }

    return { state, errorMessage, txHash, stake, reset };
}

// ─── Unstake Hook ──────────────────────────────────────────────────
export function useLPUnstake(onSuccess?: () => void) {
    const [state, setState] = useState<StakeState>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

    const { writeContract } = useWriteContract();

    const { isSuccess: confirmed } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    useEffect(() => {
        if (confirmed && state === 'waitingStake') {
            setState('success');
            toast.success('LP tokens unstaked', {
                description: 'Your LP tokens have been returned.',
                action: txHash
                    ? {
                        label: 'View on SnowTrace',
                        onClick: () =>
                            window.open(`https://testnet.snowtrace.io/tx/${txHash}`, '_blank'),
                    }
                    : undefined,
            });
            onSuccess?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [confirmed]);

    function unstake(lpPool: `0x${string}`, amount: bigint) {
        setErrorMessage('');
        setTxHash(undefined);
        setState('staking');

        writeContract(
            {
                address: ADDRESSES.LIQUIDITY_MINING,
                abi: LIQUIDITY_MINING_ABI,
                functionName: 'unstake',
                args: [lpPool, amount],
            },
            {
                onSuccess: (hash) => {
                    setTxHash(hash);
                    setState('waitingStake');
                },
                onError: (err) => {
                    setState('error');
                    setErrorMessage(parseStakingError(err.message));
                },
            }
        );
    }

    function reset() {
        setState('idle');
        setErrorMessage('');
        setTxHash(undefined);
    }

    return { state, errorMessage, txHash, unstake, reset };
}

// ─── Claim Rewards Hook ────────────────────────────────────────────
export function useLPClaim(onSuccess?: () => void) {
    const [state, setState] = useState<ClaimState>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

    const { writeContract } = useWriteContract();

    const { isSuccess: confirmed } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    useEffect(() => {
        if (confirmed && state === 'waitingClaim') {
            setState('success');
            toast.success('AVAX rewards claimed! 🎉', {
                description: 'AVAX has been sent to your wallet.',
                action: txHash
                    ? {
                        label: 'View on SnowTrace',
                        onClick: () =>
                            window.open(`https://testnet.snowtrace.io/tx/${txHash}`, '_blank'),
                    }
                    : undefined,
            });
            onSuccess?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [confirmed]);

    function claimRewards() {
        setErrorMessage('');
        setTxHash(undefined);
        setState('claiming');

        writeContract(
            {
                address: ADDRESSES.LIQUIDITY_MINING,
                abi: LIQUIDITY_MINING_ABI,
                functionName: 'claimRewards',
                args: [],
            },
            {
                onSuccess: (hash) => {
                    setTxHash(hash);
                    setState('waitingClaim');
                },
                onError: (err) => {
                    setState('error');
                    setErrorMessage(parseStakingError(err.message));
                },
            }
        );
    }

    function reset() {
        setState('idle');
        setErrorMessage('');
        setTxHash(undefined);
    }

    return { state, errorMessage, txHash, claimRewards, reset };
}

// ─── Error parser ──────────────────────────────────────────────────
function parseStakingError(msg: string): string {
    if (msg.includes('User rejected')) return 'Transaction rejected by user';
    if (msg.includes('KYC required')) return 'KYC verification required';
    if (msg.includes('Insufficient LP balance')) return 'Insufficient LP balance on AMM';
    if (msg.includes('Insufficient staked balance')) return 'Not enough staked LP tokens';
    if (msg.includes('Amount must be positive')) return 'Amount must be greater than 0';
    if (msg.includes('AVAX transfer failed')) return 'AVAX reward transfer failed — contract may be underfunded';
    return msg.slice(0, 150);
}
