'use client';

import { ReactNode } from 'react';
import Image from 'next/image';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserNav } from '@/components/auth/user-nav';
import { cn } from '@/lib/utils/utils';
import { Footer } from '@/components/layout/footer';
import { FormattedCurrency, FormattedPercentage } from '@/components/common/formatted-values';
import { MobileNav } from '@/components/ui/mobile-nav';
import { useBreakpoint } from '@/hooks/use-breakpoint';

interface AppLayoutProps {
  children: ReactNode;
  stats?: {
    currentEquity: number;
    totalPnL: number;
    totalPnLPercentage: number;
  };
  equityEditButton?: ReactNode;
  refreshButton?: ReactNode;
  addPnlButton?: ReactNode;
}

/**
 * Application shell: sticky header + scrolling content.
 * The header is a solid (not blurred) layer so scrolling never triggers
 * backdrop-filter repaints.
 */
export function AppLayout({ children, stats, equityEditButton, refreshButton, addPnlButton }: AppLayoutProps) {
  const breakpoint = useBreakpoint();
  const up = (stats?.totalPnL ?? 0) >= 0;

  return (
    <div className="app-backdrop flex h-screen w-full max-w-full flex-col overflow-x-hidden">
      <header className="relative z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/95 px-3 shadow-elev-1 md:h-16 md:gap-4 md:px-6">
        {/* Left: logo + mobile nav */}
        <div className="flex items-center gap-2">
          {breakpoint === 'mobile' && <MobileNav />}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-sunken shadow-inset">
              <Image src="/logo.png" alt="Logo" width={20} height={20} className="object-contain" />
            </div>
            <h1 className="text-sm font-bold tracking-tight md:text-base">Drawdown</h1>
          </div>
        </div>

        {/* Center: headline stats (tablet+) */}
        {stats && breakpoint !== 'mobile' && (
          <div className="well flex items-center divide-x divide-border/70 px-1 py-1">
            <div className="px-3 py-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Equity</p>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold tabular-nums"><FormattedCurrency value={stats.currentEquity} short /></p>
                {equityEditButton}
              </div>
            </div>
            <div className="px-3 py-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">All-time P&L</p>
              <div className="flex items-baseline gap-1.5">
                <p className={cn('text-sm font-semibold tabular-nums', up ? 'text-positive' : 'text-negative')}>
                  {up ? '+' : '−'}<FormattedCurrency value={Math.abs(stats.totalPnL)} short />
                </p>
                <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums', up ? 'bg-positive/12 text-positive' : 'bg-negative/12 text-negative')}>
                  <FormattedPercentage value={stats.totalPnLPercentage} />
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          {addPnlButton}
          {refreshButton}
          <ThemeToggle />
          <UserNav stats={stats} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden [overscroll-behavior-y:contain]">
        <main className="w-full max-w-full">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
