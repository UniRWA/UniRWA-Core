'use client';

interface TxLinkProps {
    txHash: string;
    label?: string;
}

export default function TxLink({ txHash, label }: TxLinkProps) {
    const truncated = `${txHash.slice(0, 6)}...${txHash.slice(-4)}`;

    return (
        <a
            href={`https://testnet.snowtrace.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-orange hover:underline transition-all duration-200"
        >
            {label || truncated}
        </a>
    );
}
