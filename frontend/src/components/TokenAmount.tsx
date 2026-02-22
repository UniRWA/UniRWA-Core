'use client';

interface TokenAmountProps {
    amount: number;
    symbol: string;
    large?: boolean;
}

export default function TokenAmount({ amount, symbol, large }: TokenAmountProps) {
    const formatted = amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    if (large) {
        return (
            <span
                className="font-bold"
                style={{
                    background: 'linear-gradient(135deg, #FF5C16, #FFA680, #D075FF)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                }}
            >
                {formatted} {symbol}
            </span>
        );
    }

    return (
        <span className="font-medium">
            {formatted} {symbol}
        </span>
    );
}
