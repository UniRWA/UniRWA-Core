'use client';

import React from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
}

/**
 * Root-level React Error Boundary.
 * Catches any unhandled JS error in children and shows a friendly UI
 * instead of a blank white screen.
 *
 * Must be a class component — React does not support error boundaries
 * as function components (no hook equivalent for componentDidCatch).
 */
export default class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    ErrorBoundaryState
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Log to console in dev; in production this would go to Sentry/DataDog
        console.error('[ErrorBoundary] Caught error:', error, info);
    }

    handleRefresh = () => {
        this.setState({ hasError: false });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-brand-cream flex items-center justify-center px-4">
                    <div className="text-center max-w-md">
                        {/* Icon */}
                        <div
                            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                            style={{
                                background:
                                    'linear-gradient(135deg, rgba(255,92,22,0.1), rgba(208,117,255,0.1))',
                            }}
                        >
                            <svg
                                width="36"
                                height="36"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#FF5C16"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-gray-500 mb-8">
                            An unexpected error occurred. Please refresh the page to try
                            again.
                        </p>

                        <button
                            onClick={this.handleRefresh}
                            className="px-8 py-3.5 rounded-full text-white font-semibold text-base transition-all duration-300 hover:-translate-y-0.5"
                            style={{
                                background: 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                                boxShadow: '0 4px 24px rgba(255,92,22,0.4)',
                            }}
                        >
                            Refresh Page
                        </button>

                        <p className="text-xs text-gray-400 mt-6">
                            If this keeps happening, try clearing your browser cache or
                            switching wallets.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
