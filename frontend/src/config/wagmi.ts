import { http, createConfig } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';

const FUJI_RPC = 'https://api.avax-test.network/ext/bc/C/rpc';

export const config = createConfig({
    chains: [avalancheFuji],
    transports: {
        [avalancheFuji.id]: http(FUJI_RPC),
    },
    ssr: true,
});

declare module 'wagmi' {
    interface Register {
        config: typeof config;
    }
}
