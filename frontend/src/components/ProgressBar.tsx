'use client';

import { motion } from 'framer-motion';

interface ProgressBarProps {
    filled: number;
    threshold: number;
    showLabel?: boolean;
}

export default function ProgressBar({ filled, threshold, showLabel }: ProgressBarProps) {
    const percentage = Math.min((filled / threshold) * 100, 100);

    return (
        <div className="flex items-center gap-3 w-full">
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                    className="h-full rounded-full"
                    style={{
                        background: 'linear-gradient(90deg, #FF5C16, #D075FF)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
                />
            </div>
            {showLabel && (
                <span className="text-sm font-medium text-gray-500 whitespace-nowrap">
                    {percentage.toFixed(0)}% filled
                </span>
            )}
        </div>
    );
}
