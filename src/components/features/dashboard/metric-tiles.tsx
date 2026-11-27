'use client';

import { useMemo, type ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { Info, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { PortfolioStats } from '@/types/trading';
import type { EnrichedDay } from '@/lib/analytics/core';
import { resolveDeltaTone, type KPIDirection } from '@/lib/utils/kpi';
import { AnimatedNumber, GrowBar, Ring } from '@/components/motion/primitives';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/utils';
import { useMoney, ratio } from './format';

interface MetricTilesProps {
  stats: PortfolioStats;
  previousStats: PortfolioStats | null;
  days: EnrichedDay[];
  payoffRatio: number;
}

function Delta({ current, previous, direction, format }: { current: number; previous: number | null | undefined; direction: KPIDirection; format: (v: number) => string }) {
  if (previous === null || previous === undefined || !Number.isFinite(previous) || !Number.isFinite(current)) {
    return <span className="text-[11px] text-muted-foreground">no prior period</span>;
  }
  const diff = current - previous;
  const tone = resolveDeltaTone(direction, diff);
  const Icon = tone === 'positive' ? TrendingUp : tone === 'negative' ? TrendingDown : Minus;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : 'text-muted-foreground')}>
      <Icon className="h-3 w-3" />
      {diff > 0 ? '+' : ''}{format(diff)}
      <span className="font-normal text-muted-foreground">vs prior</span>
    </span>
  );
}

function Spark({ data, tone }: { data: number[]; tone: 'positive' | 'negative' | 'brand' }) {
  const series = useMemo(() => data.map((v, i) => ({ i, v })), [data]);
  if (series.length < 2) return null;
  const color = tone === 'positive' ? 'hsl(var(--positive))' : tone === 'negative' ? 'hsl(var(--negative))' : 'hsl(var(--brand))';
  const id = `spark-${tone}`;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-11 opacity-45 [mask-image:linear-gradient(to_top,transparent,black_60%)]" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.25} strokeOpacity={0.7} fill={`url(#${id})`} isAnimationActive animationDuration={450} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Tile({ label, hint, children, footer, spark }: { label: string; hint: string; children: ReactNode; footer?: ReactNode; spark?: ReactNode }) {
  return (
    <div className="surface surface-interactive relative flex min-h-[132px] flex-col overflow-hidden p-4">
      {spark}
      <div className="relative flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="rounded text-muted-foreground/70 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label={`About ${label}`}>
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-xs">{hint}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="relative mt-2 flex-1">{children}</div>
      {footer && <div className="relative mt-2">{footer}</div>}
    </div>
  );
}

export function MetricTiles({ stats, previousStats, days, payoffRatio }: MetricTilesProps) {
  const money = useMoney();
  const rollingWin = useMemo(() => days.map((d) => d.rollingWinRate), [days]);
  const rollingExp = useMemo(() => days.map((d) => d.rollingExpectancy), [days]);
  const ddSeries = useMemo(() => days.map((d) => d.drawdownPct), [days]);
  const last10 = useMemo(() => days.slice(-10), [days]);
  const prevPayoff = previousStats && previousStats.averageLoss !== 0 ? previousStats.averageProfit / Math.abs(previousStats.averageLoss) : null;
  const ddLimit = 30;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile
        label="Win rate"
        hint="Share of sessions that closed green. The sparkline is the rolling 20-session win rate."
        spark={<Spark data={rollingWin} tone="brand" />}
        footer={<Delta current={stats.winRate} previous={previousStats?.winRate} direction="up-good" format={(v) => `${v.toFixed(1)}pt`} />}
      >
        <div className="flex items-center gap-3">
          <Ring value={stats.winRate} size={46} stroke={5} indicatorClassName={stats.winRate >= 50 ? 'stroke-positive' : 'stroke-warning'}>
            <span className="text-[10px] font-semibold">{Math.round(stats.winRate)}</span>
          </Ring>
          <div>
            <AnimatedNumber value={stats.winRate} format={(v) => `${v.toFixed(1)}%`} className="text-xl font-bold" />
            <p className="text-[11px] text-muted-foreground"><span className="text-positive">{stats.profitDays}W</span> / <span className="text-negative">{stats.lossDays}L</span></p>
          </div>
        </div>
      </Tile>

      <Tile
        label="Profit factor"
        hint="Gross profit ÷ gross loss. Above 1.0 is profitable; 1.5+ is a robust edge."
        footer={<Delta current={stats.profitFactor} previous={previousStats?.profitFactor} direction="up-good" format={(v) => v.toFixed(2)} />}
      >
        <AnimatedNumber value={Number.isFinite(stats.profitFactor) ? stats.profitFactor : 0} format={(v) => (Number.isFinite(stats.profitFactor) ? v.toFixed(2) : '∞')} className={cn('text-2xl font-bold', stats.profitFactor >= 1 ? 'text-positive' : 'text-negative')} />
        <div className="mt-2 space-y-1">
          <GrowBar value={Math.min(100, (Number.isFinite(stats.profitFactor) ? stats.profitFactor : 3) / 3 * 100)} barClassName={stats.profitFactor >= 1.5 ? 'bg-positive' : stats.profitFactor >= 1 ? 'bg-warning' : 'bg-negative'} />
          <div className="flex justify-between text-[10px] text-muted-foreground"><span>0</span><span>1.0</span><span>2.0</span><span>3.0+</span></div>
        </div>
      </Tile>

      <Tile
        label="Expectancy"
        hint="Average P&L per session. The sparkline is the rolling 20-session average."
        spark={<Spark data={rollingExp} tone={stats.expectancy >= 0 ? 'positive' : 'negative'} />}
        footer={<Delta current={stats.expectancy} previous={previousStats?.expectancy} direction="up-good" format={money.short} />}
      >
        <AnimatedNumber value={stats.expectancy} format={money.signed} className={cn('text-2xl font-bold', stats.expectancy >= 0 ? 'text-positive' : 'text-negative')} />
        <p className="text-[11px] text-muted-foreground">per session</p>
      </Tile>

      <Tile
        label="Payoff"
        hint="Average winning session vs average losing session. A payoff above 1 means winners outsize losers."
        footer={<Delta current={payoffRatio} previous={prevPayoff} direction="up-good" format={(v) => v.toFixed(2)} />}
      >
        <p className="text-2xl font-bold"><AnimatedNumber value={Number.isFinite(payoffRatio) ? payoffRatio : 0} format={(v) => (Number.isFinite(payoffRatio) ? v.toFixed(2) : '∞')} /><span className="text-sm font-medium text-muted-foreground">R</span></p>
        <div className="mt-2 space-y-1 text-[10px]">
          {(() => {
            const max = Math.max(stats.averageProfit, Math.abs(stats.averageLoss), 1);
            return (
              <>
                <div className="flex items-center gap-2"><span className="w-7 text-muted-foreground">Win</span><GrowBar value={(stats.averageProfit / max) * 100} barClassName="bg-positive" /><span className="w-12 text-right font-medium">{money.short(stats.averageProfit)}</span></div>
                <div className="flex items-center gap-2"><span className="w-7 text-muted-foreground">Loss</span><GrowBar value={(Math.abs(stats.averageLoss) / max) * 100} barClassName="bg-negative" /><span className="w-12 text-right font-medium">{money.short(stats.averageLoss)}</span></div>
              </>
            );
          })()}
        </div>
      </Tile>

      <Tile
        label="Max drawdown"
        hint={`Deepest peak-to-trough fall in the period. The bar shows usage of a ${ddLimit}% risk budget; the sparkline is the underwater curve.`}
        spark={<Spark data={ddSeries} tone="negative" />}
        footer={<Delta current={stats.maxDrawdown} previous={previousStats?.maxDrawdown} direction="up-bad" format={(v) => `${v.toFixed(1)}pt`} />}
      >
        <AnimatedNumber value={stats.maxDrawdown} format={(v) => `${v.toFixed(1)}%`} className="text-2xl font-bold text-negative" />
        <div className="mt-2">
          <GrowBar value={(stats.maxDrawdown / ddLimit) * 100} barClassName={stats.maxDrawdown > 20 ? 'bg-negative' : stats.maxDrawdown > 10 ? 'bg-warning' : 'bg-positive'} />
          <p className="mt-1 text-[10px] text-muted-foreground">{ratio((stats.maxDrawdown / ddLimit) * 100, 0)}% of {ddLimit}% budget</p>
        </div>
      </Tile>

      <Tile
        label="Streak"
        hint="Consecutive green (+) or red (−) sessions ending with the latest one. Dots show the last 10 sessions."
        footer={<span className="text-[11px] text-muted-foreground">last 10 sessions</span>}
      >
        <AnimatedNumber value={stats.currentStreak} format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}`} className={cn('text-2xl font-bold', stats.currentStreak > 0 ? 'text-positive' : stats.currentStreak < 0 ? 'text-negative' : '')} />
        <div className="mt-2 flex gap-1">
          {last10.map((d) => (
            <span
              key={d.key}
              title={`${d.key}: ${money.signedFull(d.pnl)}`}
              className={cn('h-2.5 flex-1 rounded-full', d.pnl > 0 ? 'bg-positive' : d.pnl < 0 ? 'bg-negative' : 'bg-muted-foreground/30')}
            />
          ))}
        </div>
      </Tile>
    </div>
  );
}
