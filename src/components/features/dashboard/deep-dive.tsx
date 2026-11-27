'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis,
} from 'recharts';
import { format, parseISO, endOfMonth } from 'date-fns';
import { Brain, CalendarRange, ChartColumn, Repeat, Sigma, Tag, TrendingDown } from 'lucide-react';
import {
  conditionalStats, drawdownEpisodes, monthlyMatrix, pnlHistogram, streakRuns, summarize, weekdayStats,
  MONTH_LABELS, type EnrichedDay,
} from '@/lib/analytics/core';
import { tagStats } from '@/lib/analytics/tags';
import { mapPnLToBucket } from '@/components/features/portfolio/pnl-calendar-helpers';
import { CustomTabs } from '@/components/ui/custom-tabs';
import { GrowBar } from '@/components/motion/primitives';
import { cn } from '@/lib/utils/utils';
import { useMoney, toneClass } from './format';

type DiveTab = 'months' | 'weekdays' | 'distribution' | 'drawdowns' | 'behavior';

interface DeepDiveProps {
  days: EnrichedDay[];
  startingEquity: number;
  activeWeekday: number | null;
  activeTag: string | null;
  onMonthDrill: (from: Date, to: Date) => void;
  onWeekday: (weekday: number) => void;
  onTag: (tag: string) => void;
  onDay: (key: string) => void;
  onRangeDrill: (from: Date, to: Date) => void;
}

const axisTick = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 }; // eslint-disable-line no-restricted-syntax -- chart axis styling

export function DeepDive(props: DeepDiveProps) {
  const [tab, setTab] = useState<DiveTab>('months');
  const reduce = useReducedMotion();

  return (
    <section className="surface overflow-hidden" aria-labelledby="deep-dive-title">
      <div className="flex flex-col gap-3 p-4 pb-3 sm:flex-row sm:items-center sm:justify-between sm:p-5 sm:pb-3">
        <div>
          <h3 id="deep-dive-title" className="text-base font-semibold tracking-tight">Deep dive</h3>
          <p className="text-xs text-muted-foreground">Break your results down. Click anything to drill in.</p>
        </div>
        <CustomTabs
          size="sm"
          compact
          className="max-w-full overflow-x-auto"
          value={tab}
          onValueChange={(v) => setTab(v as DiveTab)}
          items={[
            { id: 'months', label: 'Months', icon: CalendarRange },
            { id: 'weekdays', label: 'Weekdays', icon: ChartColumn },
            { id: 'distribution', label: 'Distribution', icon: Sigma },
            { id: 'drawdowns', label: 'Drawdowns', icon: TrendingDown },
            { id: 'behavior', label: 'Behaviour', icon: Brain },
          ]}
        />
      </div>
      <div className="px-4 pb-5 sm:px-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            {props.days.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No sessions in this range.</p>
            ) : tab === 'months' ? <MonthsMatrix {...props} />
              : tab === 'weekdays' ? <Weekdays {...props} />
                : tab === 'distribution' ? <Distribution {...props} />
                  : tab === 'drawdowns' ? <Drawdowns {...props} />
                    : <Behavior {...props} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Months: year × month heatmap matrix
// ---------------------------------------------------------------------------
function MonthsMatrix({ days, onMonthDrill }: DeepDiveProps) {
  const money = useMoney();
  const rows = useMemo(() => monthlyMatrix(days), [days]);
  const maxAbs = useMemo(() => Math.max(0, ...rows.flatMap((r) => r.months.map((m) => Math.abs(m?.total ?? 0)))), [rows]);
  const months = rows.flatMap((r) => r.months.filter(Boolean)) as NonNullable<typeof rows[number]['months'][number]>[];
  const green = months.filter((m) => m.total > 0).length;
  const best = months.reduce<typeof months[number] | null>((b, m) => (!b || m.total > b.total ? m : b), null);
  const worst = months.reduce<typeof months[number] | null>((w, m) => (!w || m.total < w.total ? m : w), null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Green months" value={`${green}/${months.length}`} />
        <Stat label="Best month" value={best ? money.signed(best.total) : '—'} sub={best ? format(parseISO(`${best.key}-01`), 'MMM yyyy') : undefined} tone={1} />
        <Stat label="Worst month" value={worst ? money.signed(worst.total) : '—'} sub={worst ? format(parseISO(`${worst.key}-01`), 'MMM yyyy') : undefined} tone={-1} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="w-12 text-left font-medium">Year</th>
              {MONTH_LABELS.map((m) => <th key={m} className="font-medium">{m}</th>)}
              <th className="font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year}>
                <td className="font-semibold text-muted-foreground">{row.year}</td>
                {row.months.map((cell, i) => {
                  if (!cell) return <td key={i}><div className="h-11 rounded-lg border border-dashed border-border/50" /></td>;
                  const { bucket, tone } = mapPnLToBucket(cell.total, maxAbs);
                  return (
                    <td key={i}>
                      <button
                        onClick={() => {
                          const from = new Date(cell.year, cell.month, 1);
                          onMonthDrill(from, endOfMonth(from));
                        }}
                        title={`${MONTH_LABELS[cell.month]} ${cell.year}: ${money.signedFull(cell.total)} · ${cell.days} sessions · ${cell.winRate.toFixed(0)}% win`}
                        className={cn(
                          'flex h-11 w-full flex-col items-center justify-center rounded-lg font-semibold tabular-nums outline-none transition-transform duration-200 hover:scale-105 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring',
                          bucket > 0 ? `bg-${tone}-${bucket}` : 'bg-muted',
                          bucket >= 4 && 'text-background',
                        )}
                      >
                        <span className="text-[11px]">{money.signed(cell.total)}</span>
                        <span className="text-[9px] font-medium opacity-75">{cell.returnPct >= 0 ? '+' : ''}{cell.returnPct.toFixed(1)}%</span>
                      </button>
                    </td>
                  );
                })}
                <td className={cn('text-center font-bold tabular-nums', toneClass(row.total))}>{money.signed(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekdays
// ---------------------------------------------------------------------------
function Weekdays({ days, activeWeekday, onWeekday }: DeepDiveProps) {
  const money = useMoney();
  const reduce = useReducedMotion();
  const stats = useMemo(() => weekdayStats(days).filter((w) => w.count > 0 || (w.weekday >= 1 && w.weekday <= 5)), [days]);
  const ordered = useMemo(() => [...stats].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7)), [stats]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ordered} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} onClick={(s: any) => { const w = ordered[Number(s?.activeIndex)]; if (w) onWeekday(w.weekday); }} style={{ cursor: 'pointer' }}>
            <CartesianGrid stroke="hsl(var(--grid))" strokeOpacity={0.6} vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} />
            <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(v) => money.short(v)} width={60} />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} />
            <RechartsTooltip
              cursor={{ fill: 'hsl(var(--accent))', opacity: 0.4 }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const w = payload[0].payload;
                return (
                  <div className="rounded-xl border border-border bg-popover/95 p-3 text-xs shadow-xl">
                    <p className="mb-1 font-semibold">{w.label} · {w.count} sessions</p>
                    <p>Avg <span className={toneClass(w.average)}>{money.signedFull(w.average)}</span></p>
                    <p>Total <span className={toneClass(w.total)}>{money.signedFull(w.total)}</span></p>
                    <p>Win rate {w.winRate.toFixed(0)}%</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="average" radius={[4, 4, 4, 4]} maxBarSize={44} isAnimationActive={!reduce} animationDuration={700}>
              {ordered.map((w) => (
                <Cell
                  key={w.weekday}
                  fill={w.average >= 0 ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
                  fillOpacity={activeWeekday === null || activeWeekday === w.weekday ? 0.9 : 0.3}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5">
        {ordered.map((w) => (
          <li key={w.weekday}>
            <button
              onClick={() => onWeekday(w.weekday)}
              disabled={w.count === 0}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
                activeWeekday === w.weekday ? 'border-primary/60 bg-primary/5' : 'border-border/70 hover:bg-accent/50',
              )}
            >
              <span className="w-8 font-semibold">{w.label}</span>
              <span className="flex-1"><GrowBar value={w.winRate} barClassName={w.winRate >= 50 ? 'bg-positive' : 'bg-warning'} /></span>
              <span className="w-10 text-right text-muted-foreground">{w.winRate.toFixed(0)}%</span>
              <span className={cn('w-16 text-right font-semibold tabular-nums', toneClass(w.total))}>{money.signed(w.total)}</span>
            </button>
          </li>
        ))}
        <li className="px-1 pt-1 text-[10px] text-muted-foreground">Bars show average P&L per session. Click a day to filter the journal.</li>
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Distribution
// ---------------------------------------------------------------------------
function Distribution({ days }: DeepDiveProps) {
  const money = useMoney();
  const reduce = useReducedMotion();
  const values = useMemo(() => days.map((d) => d.pnl), [days]);
  const bins = useMemo(() => pnlHistogram(values, 18), [values]);
  const s = useMemo(() => summarize(values), [values]);
  const sorted = useMemo(() => [...values].sort((a, b) => a - b), [values]);
  const p5 = sorted[Math.floor(sorted.length * 0.05)] ?? 0;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
  const data = bins.map((b) => ({ ...b, label: money.short(b.mid) }));
  const binOf = (v: number) => data.reduce((best, b) => (Math.abs(b.mid - v) < Math.abs(best.mid - v) ? b : best), data[0])?.label;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap={2} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--grid))" strokeOpacity={0.6} vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} interval="preserveStartEnd" minTickGap={24} />
            <YAxis axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} width={32} />
            <RechartsTooltip
              cursor={{ fill: 'hsl(var(--accent))', opacity: 0.4 }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const b = payload[0].payload;
                return (
                  <div className="rounded-xl border border-border bg-popover/95 p-3 text-xs shadow-xl">
                    <p className="font-semibold">{money.short(b.from)} to {money.short(b.to)}</p>
                    <p className="text-muted-foreground">{b.count} sessions ({((b.count / Math.max(1, values.length)) * 100).toFixed(0)}%)</p>
                  </div>
                );
              }}
            />
            {data.length > 0 && <ReferenceLine x={binOf(s.mean)} stroke="hsl(var(--brand))" strokeDasharray="4 4" label={{ value: 'mean', position: 'top', fill: 'hsl(var(--brand))', fontSize: 10 }} />} {/* eslint-disable-line no-restricted-syntax -- chart label styling */}
            <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={!reduce} animationDuration={700}>
              {data.map((b, i) => <Cell key={i} fill={b.tone === 'loss' ? 'hsl(var(--negative))' : 'hsl(var(--positive))'} fillOpacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 content-start gap-2">
        <Stat label="Mean" value={money.signed(s.mean)} tone={s.mean} />
        <Stat label="Median" value={money.signed(s.median)} tone={s.median} />
        <Stat label="Std. dev (σ)" value={money.short(s.stdDev)} />
        <Stat label="Sharpe-like" value={s.stdDev > 0 ? (s.mean / s.stdDev * Math.sqrt(252)).toFixed(2) : '—'} sub="annualised mean/σ" />
        <Stat label="5th pct day" value={money.signed(p5)} tone={p5} sub="1-in-20 bad day" />
        <Stat label="95th pct day" value={money.signed(p95)} tone={p95} sub="1-in-20 good day" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawdowns
// ---------------------------------------------------------------------------
function Drawdowns({ days, startingEquity, onRangeDrill }: DeepDiveProps) {
  const money = useMoney();
  const episodes = useMemo(() => drawdownEpisodes(days, startingEquity).slice(0, 6), [days, startingEquity]);
  const deepest = episodes[0]?.depthPct ?? 0;
  const current = days[days.length - 1];

  if (episodes.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No drawdowns in this range — every session closed at or above the prior peak.</p>;
  }

  return (
    <div className="space-y-3">
      {current && current.drawdownPct < 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/5 px-3 py-2 text-xs">
          <TrendingDown className="h-4 w-4 text-warning" />
          <span>Currently <b>{Math.abs(current.drawdownPct).toFixed(1)}%</b> under water. Recovery needs <b>{((current.peak / current.equity - 1) * 100).toFixed(1)}%</b> ({money.short(current.peak - current.equity)}).</span>
        </div>
      )}
      <ul className="space-y-2">
        {episodes.map((e) => (
          <li key={e.start + e.trough}>
            <button
              onClick={() => onRangeDrill(parseISO(e.start), parseISO(e.recovery ?? days[days.length - 1].key))}
              className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-xl border border-border/70 px-3 py-2.5 text-left text-xs outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[150px_1fr_auto_auto]"
            >
              <span className="font-medium">
                {format(parseISO(e.start), 'MMM d')} → {e.recovery ? format(parseISO(e.recovery), 'MMM d, yy') : <span className="text-warning">ongoing</span>}
              </span>
              <span className="order-3 col-span-2 sm:order-none sm:col-span-1">
                <GrowBar value={deepest ? (e.depthPct / deepest) * 100 : 0} barClassName="bg-negative" />
              </span>
              <span className="font-semibold tabular-nums text-negative">-{e.depthPct.toFixed(1)}%</span>
              <span className="hidden text-muted-foreground sm:inline">{e.duration} sessions · trough {format(parseISO(e.trough), 'MMM d')}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-muted-foreground">Deepest first. Click an episode to zoom the dashboard to it.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Behaviour: tags, after-loss, streaks
// ---------------------------------------------------------------------------
function Behavior({ days, activeTag, onTag, onRangeDrill }: DeepDiveProps) {
  const money = useMoney();
  const tags = useMemo(() => tagStats(days).sort((a, b) => a.average - b.average), [days]);
  const cond = useMemo(() => conditionalStats(days), [days]);
  const runs = useMemo(() => streakRuns(days), [days]);
  const longestWin = runs.filter((r) => r.type === 'win').sort((a, b) => b.length - a.length)[0];
  const longestLoss = runs.filter((r) => r.type === 'loss').sort((a, b) => b.length - a.length)[0];
  const overallWin = days.length ? (days.filter((d) => d.pnl > 0).length / days.length) * 100 : 0;
  const maxTag = Math.max(1, ...tags.map((t) => Math.abs(t.average)));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <p className="eyebrow mb-2 flex items-center gap-1.5"><Tag className="h-3 w-3" /> Behaviour tags</p>
        {tags.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            Tag sessions (Revenge, Oversize, Rule-followed…) from the journal or a session drill-down to see what each habit costs or earns you.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {tags.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => onTag(t.id)}
                  className={cn(
                    'grid w-full grid-cols-[minmax(116px,auto)_1fr_64px] items-center gap-3 rounded-xl border px-3 py-2 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                    activeTag === t.id ? 'border-primary/60 bg-primary/5' : 'border-border/70 hover:bg-accent/50',
                  )}
                >
                  <span className="font-medium">{t.label} <span className="text-muted-foreground">×{t.count}</span></span>
                  <span className="relative h-2 rounded-full bg-muted">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
                    <span
                      className={cn('absolute inset-y-0 rounded-full', t.average >= 0 ? 'left-1/2 bg-positive' : 'right-1/2 bg-negative')}
                      style={{ width: `${(Math.abs(t.average) / maxTag) * 50}%` }}
                    />
                  </span>
                  <span className={cn('text-right font-semibold tabular-nums', toneClass(t.average))}>{money.signed(t.average)}</span>
                </button>
              </li>
            ))}
            <li className="px-1 text-[10px] text-muted-foreground">Average P&L per tagged session. Click to filter the journal.</li>
          </ul>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <p className="eyebrow mb-2 flex items-center gap-1.5"><Repeat className="h-3 w-3" /> What happens next</p>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="After a red day"
              value={cond.afterLossWinRate === null ? '—' : `${cond.afterLossWinRate.toFixed(0)}% win`}
              sub={cond.afterLossAverage === null ? undefined : `avg ${money.signed(cond.afterLossAverage)} · n=${cond.afterLossCount}`}
              tone={cond.afterLossWinRate === null ? undefined : cond.afterLossWinRate - overallWin}
            />
            <Stat
              label="After a green day"
              value={cond.afterWinWinRate === null ? '—' : `${cond.afterWinWinRate.toFixed(0)}% win`}
              sub={cond.afterWinAverage === null ? undefined : `avg ${money.signed(cond.afterWinAverage)} · n=${cond.afterWinCount}`}
              tone={cond.afterWinWinRate === null ? undefined : cond.afterWinWinRate - overallWin}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">Compared with your {overallWin.toFixed(0)}% overall win rate.</p>
        </div>
        <div>
          <p className="eyebrow mb-2">Streak records</p>
          <div className="grid grid-cols-2 gap-2">
            {longestWin ? (
              <button onClick={() => onRangeDrill(parseISO(longestWin.start), parseISO(longestWin.end))} className="text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
                <Stat label="Longest green run" value={`${longestWin.length} sessions`} sub={`${money.signed(longestWin.total)} · ${format(parseISO(longestWin.start), 'MMM d')}`} tone={1} />
              </button>
            ) : <Stat label="Longest green run" value="—" />}
            {longestLoss ? (
              <button onClick={() => onRangeDrill(parseISO(longestLoss.start), parseISO(longestLoss.end))} className="text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
                <Stat label="Longest red run" value={`${longestLoss.length} sessions`} sub={`${money.signed(longestLoss.total)} · ${format(parseISO(longestLoss.start), 'MMM d')}`} tone={-1} />
              </button>
            ) : <Stat label="Longest red run" value="—" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: number }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('text-sm font-semibold tabular-nums', tone === undefined ? '' : toneClass(tone))}>{value}</p>
      {sub && <p className="truncate text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
