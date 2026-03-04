import { useState, useEffect, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { toast } from 'sonner';
import { POOL_ABI, ERC20_ABI, ADDRESSES, USDC_DECIMALS } from '@/config/contracts';
import { parseRevertReason } from '@/lib/utils';

export type DepositStep = 'idle' | 'approving' | 'waitingApproval' | 'depositing' | 'waitingDeposit' | 'success' | 'error';

interface UsePoolDepositOptions {
    poolAddress: `0x${string}`;
    onSuccess?: () => void; // Called after deposit confirms (trigger refetch)
}

/**
 * Two-step deposit flow: USDC.approve() → Pool.deposit()
 * Handles wallet prompts, tx confirmation, toasts, and state machine.
 */
export function usePoolDeposit({ poolAddress, onSuccess }: UsePoolDepositOptions) {
    const { address: userAddress } = useAccount();
    const [step, setStep] = useState<DepositStep>('idle');
    const [depositAmount, setDepositAmount] = useState<bigint>(BigInt(0));

    // ─── Step 1: Approve USDC spend ───────────────────────────────
    const {
        writeContract: writeApprove,
        data: approveTxHash,
        isPending: isApprovePending,
        error: approveError,
        reset: resetApprove,
    } = useWriteContract();

    const {
        isLoading: isApproveConfirming,
        isSuccess: isApproveConfirmed,
    } = useWaitForTransactionReceipt({ hash: approveTxHash });

    // ─── Step 2: Deposit into pool ────────────────────────────────
    const {
        writeContract: writeDeposit,
        data: depositTxHash,
        isPending: isDepositPending,
        error: depositError,
        reset: resetDeposit,
    } = useWriteContract();

    const {
        isLoading: isDepositConfirming,
        isSuccess: isDepositConfirmed,
    } = useWaitForTransactionReceipt({ hash: depositTxHash });

    // ─── State machine transitions ────────────────────────────────

    // After approve wallet prompt → waiting for confirmation
    useEffect(() => {
        if (step === 'approving' && approveTxHash) {
            setStep('waitingApproval');
        }
    }, [step, approveTxHash]);

    // After approve confirms → trigger deposit
    useEffect(() => {
        if (step === 'waitingApproval' && isApproveConfirmed && userAddress) {
            setStep('depositing');
            writeDeposit({
                address: poolAddress,
                abi: POOL_ABI,
                functionName: 'deposit',
                args: [depositAmount, userAddress],
            });
        }
    }, [step, isApproveConfirmed, poolAddress, depositAmount, userAddress, writeDeposit]);

    // After deposit wallet prompt → waiting for confirmation
    useEffect(() => {
        if (step === 'depositing' && depositTxHash) {
            setStep('waitingDeposit');
        }
    }, [step, depositTxHash]);

    // After deposit confirms → success!
    useEffect(() => {
        if (step === 'waitingDeposit' && isDepositConfirmed && depositTxHash) {
            setStep('success');
            toast.success('Deposit successful! 🎉', {
                description: `Your deposit has been confirmed on-chain.`,
                action: {
                    label: 'View on SnowTrace ↗',
                    onClick: () =>
                        window.open(
                            `https://testnet.snowtrace.io/tx/${depositTxHash}`,
                            '_blank'
                        ),
                },
                duration: 10_000,
                id: `deposit-${depositTxHash}`,
            });
            onSuccess?.();
        }
    }, [step, isDepositConfirmed, depositTxHash, onSuccess]);

    // Handle errors
    useEffect(() => {
        if (approveError && (step === 'approving' || step === 'waitingApproval')) {
            setStep('error');
            toast.error('Approval failed', { description: parseRevertReason(approveError) });
        }
    }, [approveError, step]);

    useEffect(() => {
        if (depositError && (step === 'depositing' || step === 'waitingDeposit')) {
            setStep('error');
            toast.error('Deposit failed', { description: parseRevertReason(depositError) });
        }
    }, [depositError, step]);

    // ─── Public API ───────────────────────────────────────────────

    /** Start the approve → deposit flow for a given USDC amount (human readable, e.g. "1000") */
    const startDeposit = useCallback(
        (amountUsdc: string) => {
            const parsed = parseUnits(amountUsdc, USDC_DECIMALS);
            setDepositAmount(parsed);
            setStep('approving');
            writeApprove({
                address: ADDRESSES.USDC,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [poolAddress, parsed],
            });
        },
        [poolAddress, writeApprove]
    );

    /** Reset back to idle state */
    const reset = useCallback(() => {
        setStep('idle');
        setDepositAmount(BigInt(0));
        resetApprove();
        resetDeposit();
    }, [resetApprove, resetDeposit]);

    // Derive UI-friendly state
    const isLoading =
        isApprovePending || isApproveConfirming || isDepositPending || isDepositConfirming;

    const stepLabel =
        step === 'approving' || step === 'waitingApproval'
            ? 'Approving USDC... (1/2)'
            : step === 'depositing' || step === 'waitingDeposit'
                ? 'Depositing... (2/2)'
                : step === 'success'
                    ? 'Deposit confirmed!'
                    : null;

    const stepNumber = step === 'approving' || step === 'waitingApproval' ? 1 : 2;

    return {
        step,
        stepNumber,
        stepLabel,
        isLoading,
        startDeposit,
        reset,
        approveTxHash,
        depositTxHash,
    };
}
