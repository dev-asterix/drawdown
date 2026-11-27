'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, startOfWeek, addDays } from 'date-fns';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDownRight, ArrowUpRight, CalendarPlus, Check, ChevronLeft, ChevronRight, Coffee, Crown, Edit2,
  Loader2, Sparkles, Trash2,
} from 'lucide-react';
import type { DailyPnL } from '@/types/trading';
import type { EnrichedDay } from '@/lib/analytics/core';
import { percentileRank, summarize, WEEKDAY_LABELS } from '@/lib/analytics/core';
import { describeDay } from '@/lib/analytics/signals';
import { BEHAVIOR_TAGS, hasTag, toggleTag } from '@/lib/analytics/tags';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AnimatedNumber, GrowBar } from '@/components/motion/primitives';
import { cn } from '@/lib/utils/utils';
import { useMoney, toneClass } from '@/components/features/dashboard/format';

interface DayAnalysisDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** yyyy-MM-dd of the session being inspected */
  dayKey: string | null;
  /** Range-scoped days: rank / percentile context */
  rangeDays: EnrichedDay[];
  /** All-time days: navigation, equity, weekday baselines */
  allDays: EnrichedDay[];
  /** Raw entries (to edit individual entries of a day) */
  entries: DailyPnL[];
  onNavigate: (key: string) => void;
  onUpdate?: (id: string, updated: Partial<DailyPnL>) => Promise<void>;
  onEdit?: (entry: DailyPnL) => void;
  onDelete?: (id: string) => void;
  onLog?: (key: string) => void;
}

export function DayAnalysisDrawer({
  isOpen, onClose, dayKey, rangeDays, allDays, entries, onNavigate, onUpdate, onEdit, onDelete, onLog,
}: DayAnalysisDrawerProps) {
  const money = useMoney();
  const reduce = useReducedMotion();
  const index = useMemo(() => (dayKey ? allDays.findIndex((d) => d.key === dayKey) : -1), [allDays, dayKey]);
  const day = index >= 0 ? allDays[index] : null;
  const prev = index > 0 ? allDays[index - 1] : null;
  const next = index >= 0 && index < allDays.length - 1 ? allDays[index + 1] : null;
  const dayEntries = useMemo(
    () => (dayKey ? entries.filter((e) => format(new Date(e.date), 'yyyy-MM-dd') === dayKey) : []),
    [entries, dayKey],
  );
  const primary = dayEntries[0];

  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  useEffect(() => {
    setNotes(primary?.notes ?? '');
    setSaving('idle');
  }, [primary?.id, primary?.notes]);

  // Keyboard: ← / → to walk sessions
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;
      if (e.key === 'ArrowLeft' && prev) onNavigate(prev.key);
      if (e.key === 'ArrowRight' && next) onNavigate(next.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, prev, next, onNavigate]);

  const context = useMemo(() => {
    if (!day) return null;
    const pool = rangeDays.some((d) => d.key === day.key) ? rangeDays : allDays;
    const pnls = pool.map((d) => d.pnl);
    const { mean, stdDev } = summarize(pnls);
    const rank = [...pnls].sort((a, b) => b - a).indexOf(day.pnl) + 1;
    const wins = pool.filter((d) => d.pnl > 0);
    const losses = pool.filter((d) => d.pnl < 0);
    const avgWin = wins.length ? wins.reduce((s, d) => s + d.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, d) => s + d.pnl, 0) / losses.length : 0;
    const sameWeekday = allDays.filter((d) => d.weekday === day.weekday);
    const wdAvg = sameWeekday.length ? sameWeekday.reduce((s, d) => s + d.pnl, 0) / sameWeekday.length : 0;
    const wdWin = sameWeekday.length ? (sameWeekday.filter((d) => d.pnl > 0).length / sameWeekday.length) * 100 : 0;

    const weekStart = startOfWeek(day.date, { weekStartsOn: 1 });
    const week = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const key = format(date, 'yyyy-MM-dd');
      return { key, date, day: allDays.find((d) => d.key === key) ?? null };
    }).filter((w, i) => i < 5 || w.day);
    const weekTotal = week.reduce((s, w) => s + (w.day?.pnl ?? 0), 0);

    const neighborhood = allDays.slice(Math.max(0, index - 7), index + 8);

    return {
      poolLabel: pool === rangeDays ? 'in range' : 'all time',
      poolSize: pool.length,
      rank,
      percentile: percentileRank(pnls, day.pnl),
      z: stdDev > 0 ? (day.pnl - mean) / stdDev : 0,
      multiple: day.pnl > 0 && avgWin ? day.pnl / avgWin : day.pnl < 0 && avgLoss ? day.pnl / avgLoss : 0,
      wdAvg, wdWin, wdCount: sameWeekday.length,
      week, weekTotal,
      neighborhood,
      lines: describeDay(day, pool, money.short),
    };
  }, [day, rangeDays, allDays, index, money.short]);

  const saveNotes = async (value: string) => {
    if (!primary || !onUpdate) return;
    setSaving('saving');
    try {
      await onUpdate(primary.id, { notes: value });
      setSaving('saved');
      setTimeout(() => setSaving('idle'), 1600);
    } catch {
      setSaving('idle');
    }
  };

  const handleTag = async (tagId: string) => {
    const updated = toggleTag(notes, tagId);
    setNotes(updated);
    await saveNotes(updated);
  };

  const date = dayKey ? parseISO(dayKey) : null;
  const positive = (day?.pnl ?? 0) >= 0;
  const weekMax = context ? Math.max(1, ...context.week.map((w) => Math.abs(w.day?.pnl ?? 0))) : 1;
  const nMax = context ? Math.max(1, ...context.neighborhood.map((d) => Math.abs(d.pnl))) : 1;

  return (
    <Sheet open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-[520px]">
        {date && (
          <>
            {/* Header */}
            <div className={cn('relative overflow-hidden border-b border-border p-5 pb-4', day ? (positive ? 'bg-positive/5' : 'bg-negative/5') : 'bg-muted/40')}>
              <div className={cn('pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-30', day ? (positive ? 'bg-positive' : 'bg-negative') : 'bg-muted')} aria-hidden />
              <SheetHeader className="relative space-y-1 text-left">
                <div className="flex items-center gap-1 pr-8">
                  <button
                    onClick={() => prev && onNavigate(prev.key)}
                    disabled={!prev}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                    aria-label="Previous session"
                    title="Previous session (←)"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <SheetTitle className="text-lg font-semibold">{format(date, 'EEEE, MMM d, yyyy')}</SheetTitle>
                  <button
                    onClick={() => next && onNavigate(next.key)}
                    disabled={!next}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                    aria-label="Next session"
                    title="Next session (→)"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <SheetDescription className="text-xs">
                  {day ? `Session ${index + 1} of ${allDays.length} · use ← → to step through sessions` : 'No session recorded on this day'}
                </SheetDescription>
              </SheetHeader>

              {day && (
                <div className="relative mt-4 flex flex-wrap items-end gap-3">
                  <AnimatedNumber key={day.key} value={day.pnl} format={money.signedFull} className={cn('text-4xl font-bold tracking-tight', toneClass(day.pnl))} duration={0.6} />
                  <span className={cn('mb-1 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold', positive ? 'bg-positive/15 text-positive' : 'bg-negative/15 text-negative')}>
                    {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {day.returnPct >= 0 ? '+' : ''}{day.returnPct.toFixed(2)}% of equity
                  </span>
                  {day.isNewHigh && (
                    <span className="mb-1 inline-flex items-center gap-1 rounded-lg bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                      <Crown className="h-3.5 w-3.5" /> New high
                    </span>
                  )}
                </div>
              )}
            </div>

            {!day || !context ? (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><Coffee className="h-6 w-6 text-muted-foreground" /></span>
                <p className="font-medium">Rest day or not logged yet</p>
                <p className="max-w-xs text-sm text-muted-foreground">Logging every session — even flat ones — keeps your stats honest.</p>
                {onLog && (
                  <Button onClick={() => onLog(dayKey!)} className="mt-2 gap-1.5">
                    <CalendarPlus className="h-4 w-4" /> Log P&L for {format(date, 'MMM d')}
                  </Button>
                )}
              </div>
            ) : (
              <motion.div
                key={day.key}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-5 p-5"
              >
                {/* Context */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Mini label={`Rank ${context.poolLabel}`} value={`#${context.rank}`} sub={`of ${context.poolSize}`} />
                  <Mini label="Percentile" value={`P${Math.round(context.percentile)}`} sub={context.percentile >= 50 ? 'better than most' : 'below median'} />
                  <Mini label="Z-score" value={`${context.z >= 0 ? '+' : ''}${context.z.toFixed(2)}σ`} sub={Math.abs(context.z) >= 2 ? 'outlier' : 'normal range'} tone={context.z} />
                  <Mini label={day.pnl >= 0 ? 'vs avg win' : 'vs avg loss'} value={`${context.multiple.toFixed(1)}×`} sub={day.pnl >= 0 ? 'avg winning day' : 'avg losing day'} />
                </div>

                {/* Auto analysis */}
                {context.lines.length > 0 && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-primary"><Sparkles className="h-3.5 w-3.5" /> Session read</p>
                    <ul className="space-y-1 text-sm text-foreground/90">
                      {context.lines.map((l) => <li key={l} className="leading-snug">{l}</li>)}
                    </ul>
                  </div>
                )}

                {/* Equity impact */}
                <div>
                  <p className="eyebrow mb-2">Equity impact</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <Mini label="Before" value={money.short(day.equityBefore)} />
                    <Mini label="After" value={money.short(day.equity)} tone={day.pnl} />
                    <Mini label="From peak" value={`${day.drawdownPct.toFixed(1)}%`} tone={day.drawdownPct < 0 ? -1 : 1} sub={day.drawdownPct < 0 ? `peak ${money.short(day.peak)}` : 'at high'} />
                  </div>
                </div>

                {/* Week context */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="eyebrow">Week of {format(context.week[0].date, 'MMM d')}</p>
                    <span className={cn('text-xs font-semibold', toneClass(context.weekTotal))}>{money.signed(context.weekTotal)}</span>
                  </div>
                  <div className="flex h-24 items-end gap-1.5">
                    {context.week.map((w) => {
                      const v = w.day?.pnl ?? 0;
                      const h = w.day ? Math.max(6, (Math.abs(v) / weekMax) * 64) : 3;
                      const selected = w.key === day.key;
                      return (
                        <button
                          key={w.key}
                          disabled={!w.day}
                          onClick={() => w.day && onNavigate(w.key)}
                          className="group flex flex-1 flex-col items-center gap-1 outline-none"
                          aria-label={`${w.key} ${w.day ? money.signedFull(v) : 'no session'}`}
                        >
                          <span className={cn('text-[9px] tabular-nums', w.day ? toneClass(v) : 'text-transparent')}>{w.day ? money.short(v) : '·'}</span>
                          <motion.span
                            className={cn(
                              'w-full max-w-[36px] rounded-md',
                              !w.day ? 'bg-muted' : v >= 0 ? 'bg-positive' : 'bg-negative',
                              selected ? 'opacity-100 ring-2 ring-foreground/70 ring-offset-2 ring-offset-background' : 'opacity-55 group-hover:opacity-90',
                            )}
                            initial={{ height: reduce ? h : 0 }}
                            animate={{ height: h }}
                            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                          />
                          <span className={cn('text-[10px]', selected ? 'font-semibold' : 'text-muted-foreground')}>{WEEKDAY_LABELS[w.date.getDay()]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Same weekday baseline */}
                <div className="rounded-xl bg-muted/50 p-3 text-xs">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">Your {format(date, 'EEEE')}s</span>
                    <span className="text-muted-foreground">{context.wdCount} sessions</span>
                  </div>
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5">
                    <span className="text-muted-foreground">Win rate</span>
                    <GrowBar value={context.wdWin} barClassName={context.wdWin >= 50 ? 'bg-positive' : 'bg-warning'} />
                    <span className="font-semibold">{context.wdWin.toFixed(0)}%</span>
                    <span className="text-muted-foreground">Average</span>
                    <span />
                    <span className={cn('font-semibold', toneClass(context.wdAvg))}>{money.signed(context.wdAvg)}</span>
                  </div>
                </div>

                {/* Neighbourhood */}
                <div>
                  <p className="eyebrow mb-2">Around this session</p>
                  <div className="flex h-16 items-center gap-[3px]">
                    {context.neighborhood.map((d) => {
                      const h = Math.max(6, (Math.abs(d.pnl) / nMax) * 28);
                      const selected = d.key === day.key;
                      return (
                        <button
                          key={d.key}
                          onClick={() => onNavigate(d.key)}
                          title={`${format(d.date, 'EEE MMM d')}: ${money.signedFull(d.pnl)}`}
                          className="relative flex h-full flex-1 items-center justify-center outline-none"
                        >
                          <span
                            className={cn('block w-full max-w-[16px] rounded-sm transition-opacity', d.pnl >= 0 ? 'bg-positive' : 'bg-negative', selected ? 'opacity-100' : 'opacity-40 hover:opacity-80')}
                            style={{ height: h, transform: `translateY(${d.pnl >= 0 ? -h / 2 : h / 2}px)` }}
                          />
                          {selected && <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-foreground" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Journal */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="eyebrow">Journal</p>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground" aria-live="polite">
                      {saving === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
                      {saving === 'saved' && <><Check className="h-3 w-3 text-positive" /> Saved</>}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BEHAVIOR_TAGS.map((t) => {
                      const on = hasTag(notes, t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => handleTag(t.id)}
                          disabled={!onUpdate || !primary}
                          aria-pressed={on}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-xs font-medium transition-all active:scale-95 disabled:opacity-50',
                            on
                              ? t.good ? 'border-positive/50 bg-positive/15 text-positive' : 'border-warning/50 bg-warning/15 text-warning'
                              : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                          )}
                        >
                          {on && <Check className="-ml-0.5 mr-1 inline h-3 w-3" />}{t.label}
                        </button>
                      );
                    })}
                  </div>
                  <label htmlFor="day-notes" className="sr-only">Session notes</label>
                  <Textarea
                    id="day-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => { if (notes !== (primary?.notes ?? '')) saveNotes(notes); }}
                    placeholder={day.pnl >= 0 ? 'What went right? Which setups worked?' : 'What went wrong? Which rule needs reinforcing?'}
                    className="min-h-[96px] resize-y text-sm"
                    disabled={!onUpdate || !primary}
                  />
                  <p className="text-[10px] text-muted-foreground">Notes save automatically when you leave the field.</p>
                </div>

                {/* Entries */}
                {dayEntries.length > 0 && (onEdit || onDelete) && (
                  <div>
                    <p className="eyebrow mb-2">Entries ({dayEntries.length})</p>
                    <ul className="divide-y divide-border rounded-xl border border-border">
                      {dayEntries.map((e) => (
                        <li key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <span className={cn('font-semibold tabular-nums', toneClass(e.pnl))}>{money.signedFull(e.pnl)}</span>
                          <span className="flex-1 truncate text-xs text-muted-foreground">{e.notes}</span>
                          {onEdit && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(e)} aria-label="Edit entry"><Edit2 className="h-3.5 w-3.5" /></Button>
                          )}
                          {onDelete && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-negative hover:text-negative" onClick={() => onDelete(e.id)} aria-label="Delete entry"><Trash2 className="h-3.5 w-3.5" /></Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: number }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('text-sm font-semibold tabular-nums', tone === undefined ? '' : toneClass(tone))}>{value}</p>
      {sub && <p className="truncate text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
