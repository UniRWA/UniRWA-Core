'use client';

import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { ShieldCheck, Users, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { fetchAssets, type Asset } from '@/lib/api';

const BORDER_COLORS: Record<string, string> = {
  BUIDL: 'border-l-orange-400',
  BENJI: 'border-l-purple-400',
  OUSG: 'border-l-blue-400',
};

const STEPS = [
  { icon: ShieldCheck, title: 'Verify Once', desc: 'Complete a one-time KYC check. A soulbound ComplianceNFT is issued to your wallet. Access all features permanently.' },
  { icon: Users, title: 'Pool Together', desc: 'Deposit from $1,000 USDC into a fractional pool. When the pool reaches its threshold, it auto-purchases the underlying RWA.' },
  { icon: Zap, title: 'Exit Anytime', desc: 'Trade vault tokens instantly on the secondary market — AMM or orderbook. No waiting. No redemption queues.' },
];

const FILTERS = ['All', 'Treasury', 'Money Market', 'Bond'];

function formatNav(nav: string | number): string {
  return `$${Number(nav).toFixed(4)}`;
}

function formatApy(apy: string | number): string {
  return `${Number(apy).toFixed(2)}%`;
}

function formatTvl(tvl: string | number): string {
  const num = Number(tvl);
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(0)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
}

function formatMinDeposit(min: string | number): string {
  const num = Number(min);
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)},000`;
  return `$${num.toLocaleString()}`;
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function SkeletonAssetCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-md border-l-4 border-l-gray-200 p-6">
      <div className="mb-4">
        <Skeleton className="h-5 w-20 mb-2" />
        <Skeleton className="h-4 w-44 mb-1" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="flex items-baseline gap-2 mb-5">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-8" />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((n) => (
          <div key={n}>
            <Skeleton className="h-3 w-12 mb-1.5" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 flex-1 rounded-xl" />
      </div>
    </div>
  );
}

function AssetGrid() {
  const { data: assets, isLoading, isError } = useQuery({
    queryKey: ['assets'],
    queryFn: fetchAssets,
    staleTime: 60_000,
  });

  if (isError) {
    return (
      <div className="bg-white rounded-2xl shadow-md p-8 text-center">
        <p className="text-gray-500 mb-3">Unable to load assets. The backend may be unavailable.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #FF5C16, #FF8A50)' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading || !assets) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[1, 2, 3].map((n) => (
          <SkeletonAssetCard key={n} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {assets.map((asset: Asset, i: number) => (
        <Reveal key={asset.symbol} delay={i * 0.1}>
          <div className={`group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border-l-4 ${BORDER_COLORS[asset.symbol] || 'border-l-gray-400'}`}>
            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{asset.symbol}</h3>
                <p className="text-sm text-gray-500">{asset.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">by {asset.issuer}</p>
              </div>
              <div className="flex items-baseline gap-2 mb-5">
                <p
                  className="text-3xl font-black"
                  style={{
                    background: 'linear-gradient(135deg, #FF5C16, #D075FF)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {formatApy(asset.yield_apy)}
                </p>
                <span className="text-xs text-gray-400 uppercase tracking-wider">APY</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-600">
                  +0.02%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">NAV</p>
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-green-500 font-bold mr-0.5">LIVE</span>
                    {formatNav(asset.nav)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">TVL</p>
                  <p className="text-sm font-semibold text-gray-900">{formatTvl(asset.tvl)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Min Deposit</p>
                  <p className="text-sm font-semibold text-gray-900">{formatMinDeposit(asset.min_investment)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Link
                  href={`/assets/${asset.symbol}`}
                  className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Details
                </Link>
                <Link
                  href="/pools"
                  className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300"
                  style={{
                    background: 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                  }}
                >
                  Join Pool
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}


export default function HomePage() {
  return (
    <div className="-mt-16">
      <section
        className="relative overflow-hidden pt-32 pb-24 md:pt-44 md:pb-36"
        style={{
          background: 'linear-gradient(170deg, #0A0A0E 0%, #141418 40%, #1C1C24 70%, #24242E 100%)',
        }}
      >
        <div
          className="absolute top-20 -left-40 w-[500px] h-[500px] rounded-full animate-pulseSoft pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(255,92,22,0.15) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute bottom-10 -right-40 w-[500px] h-[500px] rounded-full animate-pulseSoft pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(208,117,255,0.15) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animationDelay: '3s',
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-2 mb-8"
          >
            <span className="text-green-400 text-sm">🟢</span>
            <span className="text-sm text-white/80 font-medium">$685M+ in RWA live on Avalanche</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
            className="text-5xl md:text-7xl font-black tracking-tight leading-[0.95] text-white mb-6"
          >
            The{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #FF5C16, #FFA680, #D075FF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Liquidity Layer
            </span>
            <br />
            for Real-World Assets
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10"
          >
            Pool into tokenized Treasury funds. Trade instantly on a secondary market. Earn real-world yield — all on Avalanche.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Link
              href="/pools"
              className="px-8 py-3.5 rounded-full text-white font-semibold text-base transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #FF5C16, #FF8A50)',
                boxShadow: '0 4px 24px rgba(255,92,22,0.4)',
              }}
            >
              Explore Assets
            </Link>
            <Link
              href="#how-it-works"
              className="px-8 py-3.5 rounded-full font-semibold text-base border-2 border-white/20 text-white hover:bg-white/10 transition-all duration-300"
            >
              How It Works
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="bg-white/5 rounded-2xl px-8 md:px-16 py-6 inline-flex flex-wrap items-center justify-center gap-12 md:gap-20"
          >
            <div className="text-center">
              <p
                className="text-4xl md:text-5xl font-black"
                style={{
                  background: 'linear-gradient(135deg, #FF5C16, #D075FF)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                $685M+
              </p>
              <p className="text-sm tracking-widest uppercase text-white/40 mt-1">RWA on Avalanche</p>
            </div>
            <div className="text-center">
              <p className="text-4xl md:text-5xl font-black text-white">4.85%</p>
              <p className="text-sm tracking-widest uppercase text-white/40 mt-1">Best APY</p>
            </div>
            <div className="text-center">
              <p className="text-4xl md:text-5xl font-black text-white">&lt;2s</p>
              <p className="text-sm tracking-widest uppercase text-white/40 mt-1">Exit Anytime</p>
            </div>
          </motion.div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-28"
          style={{ background: 'linear-gradient(to bottom, transparent, #FFF5F0)' }}
        />
      </section>

      <section className="py-20 md:py-28 bg-brand-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 mb-2">
              Live on Avalanche
            </h2>
            <p className="text-gray-500 mb-10">Institutional-grade tokenized assets, accessible to everyone.</p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-10">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Search assets..."
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-orange/30"
                  readOnly
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {FILTERS.map((f, i) => (
                  <button
                    key={f}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${i === 0
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          <AssetGrid />
        </div>
      </section>


      <section id="how-it-works" className="py-24 md:py-36 bg-brand-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-[#0F0F1A]">
              How It Works
            </h2>
            <div className="w-16 h-0.5 bg-brand-orange mt-4 mb-12" />
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-0 relative">
            <div className="hidden md:block absolute top-5 left-[16.67%] right-[16.67%] border-t-2 border-dashed border-orange-200" />

            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const num = String(i + 1).padStart(2, '0');
              return (
                <Reveal key={step.title} delay={i * 0.15}>
                  <div className="relative px-4 md:px-6">
                    <span
                      className="absolute -top-4 left-2 text-8xl font-black select-none pointer-events-none"
                      style={{ color: 'rgba(255,92,22,0.06)' }}
                    >
                      {num}
                    </span>

                    <div className="relative z-10 w-10 h-10 border-2 border-orange-400 rounded-full flex items-center justify-center text-sm font-bold text-orange-500 bg-brand-cream mb-4">
                      {num}
                    </div>

                    <Icon size={28} className="text-brand-orange mb-4" />

                    <h3 className="text-2xl font-bold text-[#0F0F1A] mt-4">{step.title}</h3>
                    <p className="text-base text-gray-500 mt-2 max-w-xs">{step.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <footer
        className="py-12"
        style={{
          background: 'linear-gradient(170deg, #0A0A0E 0%, #141418 100%)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <span
              className="text-lg font-bold"
              style={{
                background: 'linear-gradient(135deg, #FF5C16, #D075FF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              UniRWA
            </span>

            <div className="flex items-center gap-6">
              {['Markets', 'Pools', 'Trade', 'Portfolio', 'KYC'].map((item) => (
                <Link
                  key={item}
                  href={item === 'Markets' ? '/' : `/${item.toLowerCase()}`}
                  className="text-sm text-white/50 hover:text-white transition-colors"
                >
                  {item}
                </Link>
              ))}
            </div>

            <p className="text-sm text-white/30">Built on Avalanche · Testnet</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
