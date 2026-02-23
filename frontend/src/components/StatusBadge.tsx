'use client';

type Status = 'filling' | 'funded' | 'pending' | 'verified' | 'open' | 'cancelled' | 'buy' | 'sell' | 'deposit' | 'swap' | 'kyc';

interface StatusBadgeProps {
    status: Status;
}

const STATUS_STYLES: Record<Status, string> = {
    filling: 'bg-amber-100 text-amber-700',
    funded: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    verified: 'bg-green-100 text-green-700',
    open: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
    buy: 'bg-green-50 text-green-700',
    sell: 'bg-red-50 text-red-700',
    deposit: 'bg-blue-100 text-blue-700',
    swap: 'bg-purple-100 text-purple-700',
    kyc: 'bg-green-100 text-green-700',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[status]}`}
        >
            {status}
        </span>
    );
}
