'use client';

import { useQuery } from '@tanstack/react-query';
import { createPublicClient, http } from 'viem';
import { avalancheFuji } from 'viem/chains';

/* ------------------------------------------------------------------ */
/*  Avvy Domains Reverse Resolution on Avalanche Fuji                  */
/*  Resolves wallet address → .avax name using ReverseResolverV1       */
/* ------------------------------------------------------------------ */

const AVVY_REVERSE_RESOLVER = '0x630706B99c053C727094C952ca685637dFE89c0a' as const;

const REVERSE_RESOLVER_ABI = [
    {
        name: 'getReverseName',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'addr', type: 'address' }],
        outputs: [{ name: '', type: 'string' }],
    },
] as const;

const fujiClient = createPublicClient({
    chain: avalancheFuji,
    transport: http(),
});

/**
 * Hook to resolve an Avalanche address to its .avax Avvy Domain name.
 * Returns null if no name is found or on any error (fails silently).
 */
export function useAvvyName(address: `0x${string}` | undefined) {
    return useQuery<string | null>({
        queryKey: ['avvy-name', address],
        queryFn: async () => {
            if (!address) return null;
            try {
                const name = await fujiClient.readContract({
                    address: AVVY_REVERSE_RESOLVER,
                    abi: REVERSE_RESOLVER_ABI,
                    functionName: 'getReverseName',
                    args: [address],
                });
                return name && name.length > 0 ? name : null;
            } catch {
                // Fail silently — return null if no name registered or contract reverts
                return null;
            }
        },
        enabled: !!address,
        staleTime: 5 * 60 * 1000, // 5 minutes — names rarely change
        retry: false,
    });
}
