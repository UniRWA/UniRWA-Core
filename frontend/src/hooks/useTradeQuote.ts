import { useState, useEffect, useRef } from 'react';
import { useReadContract } from 'wagmi';
import { ADDRESSES, ROUTER_ABI, USDC_DECIMALS, RWA_DECIMALS } from '@/config/contracts';

export function useTradeQuote(
    rwaToken: `0x${string}` | undefined,
    amount: string,
    isSell: boolean
) {
    const [debouncedAmount, setDebouncedAmount] = useState('');
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setDebouncedAmount(amount);
        }, 500);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [amount]);

    const inputDecimals = isSell ? RWA_DECIMALS : USDC_DECIMALS;
    const outputDecimals = isSell ? USDC_DECIMALS : RWA_DECIMALS;

    const parsedAmount = parseFloat(debouncedAmount);
    const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;
    const rawAmount = isValidAmount
        ? BigInt(Math.floor(parsedAmount * 10 ** inputDecimals))
        : BigInt(0);

    const enabled = !!rwaToken && rawAmount > BigInt(0);
    const { data, isLoading, error, refetch } = useReadContract({
        address: ADDRESSES.ROUTER,
        abi: ROUTER_ABI,
        functionName: 'getBestRoute',
        args: [rwaToken ?? ('0x0000000000000000000000000000000000000000' as `0x${string}`), rawAmount, isSell],
        query: {
            enabled,
        },
    });

    const routeType = data ? Number((data as [number, bigint])[0]) : 0;
    const rawExpectedOut = data ? (data as [number, bigint])[1] : BigInt(0);
    const expectedOut = Number(rawExpectedOut) / 10 ** outputDecimals;

    const feeRate = 0.003;
    const fee = isValidAmount ? parsedAmount * feeRate : 0;
    const priceImpact =
        isValidAmount && expectedOut > 0
            ? Math.abs((expectedOut / (parsedAmount * (1 - feeRate)) - 1) * 100)
            : 0;

    return {
        expectedOut,
        rawExpectedOut,
        route: routeType === 0 ? 'AMM' : 'Orderbook',
        fee,
        priceImpact,
        isLoading: isLoading && isValidAmount,
        error,
        refetch,
        isValidAmount,
        rawAmount,
    };
}
