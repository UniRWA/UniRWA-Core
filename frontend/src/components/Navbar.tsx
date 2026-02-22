'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
    { href: '/', label: 'Markets' },
    { href: '/pools', label: 'Pools' },
    { href: '/trade', label: 'Trade' },
    { href: '/portfolio', label: 'Portfolio' },
];

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 80);
        handleScroll();
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <motion.nav
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                    ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-100/50'
                    : 'bg-transparent border-b border-transparent'
                }`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex-shrink-0">
                        <span
                            className="text-xl font-bold"
                            style={{
                                background: 'linear-gradient(135deg, #FF5C16, #D075FF)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            UniRWA
                        </span>
                    </Link>

                    {/* Center Nav Links — Desktop */}
                    <div className="hidden md:flex items-center gap-8">
                        {NAV_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`text-sm font-medium transition-colors duration-300 ${scrolled
                                        ? 'text-gray-600 hover:text-gray-900'
                                        : 'text-white/80 hover:text-white'
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    {/* Connect Wallet Button — Desktop */}
                    <div className="hidden md:block">
                        <button
                            className="px-6 py-2.5 rounded-full text-white text-sm font-semibold transition-all duration-300"
                            style={{
                                background: 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                                boxShadow: '0 4px 24px rgba(255,92,22,0.4)',
                            }}
                        >
                            Connect Wallet
                        </button>
                    </div>

                    {/* Mobile Hamburger */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className={`md:hidden p-2 rounded-lg transition-colors ${scrolled
                                ? 'text-gray-600 hover:text-gray-900'
                                : 'text-white/80 hover:text-white'
                            }`}
                    >
                        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Nav Menu */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        className="md:hidden overflow-hidden bg-white/90 backdrop-blur-md border-t border-gray-100/50"
                    >
                        <div className="px-4 py-4 space-y-3">
                            {NAV_LINKS.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileOpen(false)}
                                    className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2 transition-colors"
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <button
                                className="w-full mt-2 px-6 py-2.5 rounded-full text-white text-sm font-semibold"
                                style={{
                                    background: 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                                    boxShadow: '0 4px 24px rgba(255,92,22,0.4)',
                                }}
                            >
                                Connect Wallet
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.nav>
    );
}
