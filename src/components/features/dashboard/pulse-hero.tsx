'use client';

import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import type { PortfolioStats } from '@/types/trading';
import type { EnrichedDay } from '@/lib/analytics/core';
import { AnimatedNumber, Ring } from '@/components/motion/primitives';
import { cn } from '@/lib/utils/utils';
import { useMoney, signedPct, toneClass } from './format';

interface PulseHeroProps {
  days: EnrichedDay[];
  stats: PortfolioStats;
  previousStats: PortfolioStats | null;
  rangeLabel: string;
  health: { score: number; components: Record<string, number> };
}

const COMPONENT_LABELS: Record<string, string> = {
  edge: 'Edge',
  accuracy: 'Accuracy',
  payoff: 'Payoff',
  risk: 'Risk control',
  consistency: 'Consistency',
};

function healthMeta(score: number) {
  if (score >= 70) return { label: 'Healthy', Icon: ShieldCheck, ring: 'stroke-positive', text: 'text-positive' };
  if (score >= 45) return { label: 'Fragile', Icon: ShieldAlert, ring: 'stroke-warning', text: 'text-warning' };
  return { label: 'At risk', Icon: ShieldX, ring: 'stroke-negative', text: 'text-negative' };
}

export function PulseHero({ days, stats, previousStats, rangeLabel, health }: PulseHeroProps) {
  const money = useMoney();
  const series = useMemo(() => days.map((d) => ({ key: d.key, v: d.cumulative })), [days]);
  const positive = stats.totalPnL >= 0;
  const delta = previousStats ? stats.totalPnL - previousStats.totalPnL : null;
  const meta = healthMeta(health.score);

  return (
    <div className="surface relative overflow-hidden">
      <div className="grid-fade pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div
        className={cn(
          'pointer-events-none absolute -top-24 left-1/3 h-56 w-[60%] rounded-full blur-3xl opacity-25',
          positive ? 'bg-positive' : 'bg-negative',
        )}
        aria-hidden
      />

      {/* Background curve */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 opacity-90 [mask-image:linear-gradient(to_top,black_55%,transparent)] sm:h-32" aria-hidden>
        {series.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={positive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={positive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Area
                type="monotone"
                dataKey="v"
                stroke={positive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
                strokeOpacity={0.55}
                strokeWidth={1.5}
                fill="url(#pulseFill)"
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="relative grid gap-6 p-5 pb-32 sm:p-6 sm:pb-36 md:grid-cols-[1fr_auto] md:pb-6">
        <div className="min-w-0 space-y-4 md:pb-28">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">Net P&L</span>
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground shadow-elev-1">
              {rangeLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <AnimatedNumber
              value={stats.totalPnL}
              format={money.signedFull}
              className={cn('text-4xl font-bold tracking-tight sm:text-5xl', toneClass(stats.totalPnL))}
            />
            <span
              className={cn(
                'mb-1.5 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold',
                positive ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative',
              )}
            >
              {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              <AnimatedNumber value={stats.totalPnLPercentage} format={(v) => signedPct(v, 2)} />
            </span>
          </div>

          <dl className="grid max-w-xl grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Equity</dt>
              <dd className="font-semibold"><AnimatedNumber value={stats.currentEquity} format={money.short} /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sessions</dt>
              <dd className="font-semibold">
                {stats.totalDays}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  <span className="text-positive">{stats.profitDays}W</span> · <span className="text-negative">{stats.lossDays}L</span>
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Best / worst</dt>
              <dd className="font-semibold">
                <span className="text-positive">{money.short(stats.largestProfit)}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-negative">{money.short(stats.largestLoss)}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">vs prior period</dt>
              <dd className={cn('font-semibold', delta === null ? 'text-muted-foreground' : toneClass(delta))}>
                {delta === null ? '—' : money.signed(delta)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Health gauge */}
        <div className="flex items-center gap-4 surface-raised p-4 md:flex-col md:items-stretch md:w-56">
          <div className="flex items-center gap-3 md:justify-between">
            <Ring value={health.score} size={76} stroke={7} indicatorClassName={meta.ring}>
              <div className="text-center leading-none">
                <AnimatedNumber value={health.score} format={(v) => Math.round(v).toString()} className="text-xl font-bold" />
                <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">/100</div>
              </div>
            </Ring>
            <div className="md:text-right">
              <p className="eyebrow">System health</p>
              <p className={cn('mt-1 flex items-center gap-1 font-semibold md:justify-end', meta.text)}>
                <meta.Icon className="h-4 w-4" /> {meta.label}
              </p>
            </div>
          </div>
          <ul className="hidden flex-1 space-y-1.5 sm:block">
            {Object.entries(health.components).map(([k, v]) => (
              <li key={k} className="flex items-center gap-2 text-[11px]">
                <span className="w-20 shrink-0 text-muted-foreground">{COMPONENT_LABELS[k] ?? k}</span>
                <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out-expo', v >= 0.66 ? 'bg-positive' : v >= 0.33 ? 'bg-warning' : 'bg-negative')}
                    style={{ width: `${Math.round(v * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
