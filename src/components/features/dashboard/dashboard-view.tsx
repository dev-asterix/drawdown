'use client';

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Filter, X } from 'lucide-react';
import type { DailyPnL } from '@/types/trading';
import type { InsightType } from '@/lib/ai/types';
import { redactSnapshot } from '@/lib/ai/redact';
import { describeRange, type Range } from '@/lib/analytics/range';
import { BEHAVIOR_TAGS, hasTag } from '@/lib/analytics/tags';
import { WEEKDAY_LABELS } from '@/lib/analytics/core';
import { cn } from '@/lib/utils/utils';
import type { SignalAction } from '@/lib/analytics/signals';
import { useSettings } from '@/hooks/use-settings';
import { Stagger, Reveal } from '@/components/motion/primitives';
import { AIInsightsSection } from '@/components/features/ai-insights/ai-insights-section';
import { TraderCockpit } from '@/components/features/portfolio/trader-cockpit';
import { EquityChart } from '@/components/features/portfolio/equity-chart';
import { DayAnalysisDrawer } from '@/components/features/portfolio/day-analysis-drawer';
import { TraderTransactionTable } from '@/components/features/transactions/trader-transaction-table';
import { AddTransactionForm } from '@/components/features/transactions/add-transaction-form';
import { EditTransactionForm } from '@/components/features/transactions/edit-transaction-form';
import { useDashboardModel } from './use-dashboard-model';
import { PulseHero } from './pulse-hero';
import { SessionCard } from './session-card';
import { MetricTiles } from './metric-tiles';
import { SignalsFeed } from './signals-feed';
import { DeepDive } from './deep-dive';
import { StopLossSimulator } from './stop-loss-simulator';
import { RangeBar } from './range-bar';

type Focus = { type: 'weekday'; weekday: number } | { type: 'tag'; tag: string } | null;

// Heavy panels only re-render when their own props change (e.g. opening the
// drawer or typing a note no longer re-renders every chart).
const PulseHeroM = memo(PulseHero);
const SessionCardM = memo(SessionCard);
const MetricTilesM = memo(MetricTiles);
const EquityChartM = memo(EquityChart);
const SignalsFeedM = memo(SignalsFeed);
const DeepDiveM = memo(DeepDive);
const JournalM = memo(TraderTransactionTable);
const AIInsightsM = memo(AIInsightsSection);
const SimulatorM = memo(StopLossSimulator);
const CockpitM = memo(TraderCockpit);

export interface DashboardViewProps {
  entries: DailyPnL[];
  baseCapital: number;
  onAdd: (entry: Partial<DailyPnL>) => Promise<void>;
  onUpdate: (id: string, updated: Partial<DailyPnL>) => Promise<void>;
  onDelete: (id: string) => void;
  /** Rendered at the bottom of the side column (e.g. fund history). */
  renderFunds?: (range: Range | undefined) => ReactNode;
  /** Notice rendered above the dashboard (e.g. demo banner). */
  banner?: ReactNode;
}

export function DashboardView({ entries, baseCapital, onAdd, onUpdate, onDelete, renderFunds, banner }: DashboardViewProps) {
  const { settings } = useSettings();
  const [range, setRangeState] = useState<Range | undefined>(undefined);
  const [trail, setTrail] = useState<(Range | undefined)[]>([]);
  const [focus, setFocus] = useState<Focus>(null);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logDate, setLogDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<DailyPnL | null>(null);
  const journalRef = useRef<HTMLDivElement>(null);

  // Range clicks update the controls immediately; the expensive recompute of
  // every chart runs as a non-blocking transition on a deferred value.
  const [isPending, startTransition] = useTransition();
  const deferredRange = useDeferredValue(range);
  const model = useDashboardModel(entries, baseCapital, deferredRange);
  const rangeLabel = describeRange(deferredRange);
  const stale = isPending || deferredRange !== range;

  // --- range & drill-down ---------------------------------------------------
  const setRange = useCallback((r: Range | undefined) => {
    startTransition(() => {
      setTrail([]);
      setRangeState(r);
    });
  }, []);

  const rangeRef = useRef(range);
  useEffect(() => { rangeRef.current = range; }, [range]);
  const drillTo = useCallback((from: Date, to: Date) => {
    startTransition(() => {
      setTrail((t) => [...t, rangeRef.current]);
      setRangeState({ from: startOfDay(from), to: endOfDay(to) });
    });
  }, []);

  const drillBack = useCallback(() => {
    startTransition(() => {
      setTrail((t) => {
        const copy = [...t];
        const prev = copy.pop();
        setRangeState(prev);
        return copy;
      });
    });
  }, []);

  const openDay = useCallback((key: string) => {
    setDayKey(key);
    setDrawerOpen(true);
  }, []);

  const scrollToJournal = useCallback(() => {
    setTimeout(() => journalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }, []);
  const onWeekday = useCallback((w: number) => {
    setFocus((f) => (f?.type === 'weekday' && f.weekday === w ? null : { type: 'weekday', weekday: w }));
    scrollToJournal();
  }, [scrollToJournal]);
  const onTag = useCallback((t: string) => {
    setFocus((f) => (f?.type === 'tag' && f.tag === t ? null : { type: 'tag', tag: t }));
    scrollToJournal();
  }, [scrollToJournal]);
  const logToday = useCallback(() => setLogDate(format(new Date(), 'yyyy-MM-dd')), []);

  const handleSignal = useCallback((a: SignalAction) => {
    switch (a.type) {
      case 'day': openDay(a.key); break;
      case 'range': drillTo(parseISO(a.from), parseISO(a.to)); break;
      case 'weekday': setFocus({ type: 'weekday', weekday: a.weekday }); scrollToJournal(); break;
      case 'tag': setFocus({ type: 'tag', tag: a.tag }); scrollToJournal(); break;
    }
  }, [openDay, drillTo, scrollToJournal]);

  // --- journal filtering ----------------------------------------------------
  const journalEntries = useMemo(() => {
    if (!focus) return model.rangeEntries;
    if (focus.type === 'weekday') return model.rangeEntries.filter((e) => new Date(e.date).getDay() === focus.weekday);
    return model.rangeEntries.filter((e) => hasTag(e.notes, focus.tag));
  }, [model.rangeEntries, focus]);

  const focusLabel = focus
    ? focus.type === 'weekday'
      ? `${WEEKDAY_LABELS[focus.weekday]} sessions`
      : `Tagged “${BEHAVIOR_TAGS.find((t) => t.id === focus.tag)?.label ?? focus.tag}”`
    : null;

  // --- AI snapshot (same redaction pipeline as before) ------------------------
  const buildSnapshot = useCallback((insightType: InsightType) => redactSnapshot({
    insightType,
    dateRange: { from: deferredRange?.from ?? new Date(0), to: deferredRange?.to ?? new Date() },
    dailyPnL: model.rangeEntries,
    stats: model.stats,
    drawdownSeries: model.days.map((d) => d.drawdownPct),
    currency: settings?.currency ?? 'INR',
    notes: model.rangeEntries.filter((e) => e.notes).map((e) => e.notes!),
  }), [deferredRange, model, settings?.currency]);

  return (
    <>
      <Stagger className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:p-6">
        {banner && <Reveal>{banner}</Reveal>}

        <Reveal className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">{format(new Date(), 'EEEE, MMMM d')}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              Performance <span className="text-gradient-brand">overview</span>
            </h2>
          </div>
          <RangeBar range={range} onChange={setRange} trail={trail} onBack={drillBack} />
        </Reveal>

        {/* While a new range is computing, dim slightly instead of blocking */}
        <div className={cn('flex flex-col gap-5 transition-opacity duration-fast', stale && 'opacity-70')} aria-busy={stale}>
          <Reveal className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PulseHeroM days={model.days} stats={model.stats} previousStats={model.previousStats} rangeLabel={rangeLabel} health={model.health} />
            </div>
            <SessionCardM days={model.days} onOpenDay={openDay} onLogToday={logToday} />
          </Reveal>

          <Reveal>
            <MetricTilesM stats={model.stats} previousStats={model.previousStats} days={model.days} payoffRatio={model.payoffRatio} />
          </Reveal>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex min-w-0 flex-col gap-5">
              <Reveal>
                <EquityChartM
                  days={model.days}
                  allDays={model.allDays}
                  allEntries={entries}
                  range={deferredRange}
                  onDayClick={openDay}
                  onEmptyDayClick={openDay}
                  onRangeDrill={drillTo}
                />
              </Reveal>

              <Reveal>
                <SignalsFeedM days={model.days} onAction={handleSignal} />
              </Reveal>

              <Reveal className="cv-auto">
                <DeepDiveM
                  days={model.days}
                  startingEquity={model.startingEquity}
                  activeWeekday={focus?.type === 'weekday' ? focus.weekday : null}
                  activeTag={focus?.type === 'tag' ? focus.tag : null}
                  onMonthDrill={drillTo}
                  onRangeDrill={drillTo}
                  onDay={openDay}
                  onWeekday={onWeekday}
                  onTag={onTag}
                />
              </Reveal>

              <Reveal className="cv-auto">
                <div ref={journalRef} className="scroll-mt-20 space-y-2">
                  {focusLabel && (
                    <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                      <Filter className="h-3.5 w-3.5 text-primary" />
                      <span>Journal filtered to <b>{focusLabel}</b> · {journalEntries.length} entries</span>
                      <button onClick={() => setFocus(null)} className="pressable ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                        <X className="h-3 w-3" /> Clear
                      </button>
                    </div>
                  )}
                  <JournalM transactions={journalEntries} onDelete={onDelete} onEdit={setEditing} onUpdate={onUpdate} />
                </div>
              </Reveal>
            </div>

            <aside className="flex min-w-0 flex-col gap-5">
              <Reveal><AIInsightsM buildSnapshot={buildSnapshot} /></Reveal>
              <Reveal><SimulatorM days={model.days} allDays={model.allDays} /></Reveal>
              <Reveal className="cv-auto"><CockpitM stats={model.stats} /></Reveal>
              {renderFunds && <Reveal className="cv-auto">{renderFunds(deferredRange)}</Reveal>}
            </aside>
          </div>
        </div>
      </Stagger>

      <DayAnalysisDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        dayKey={dayKey}
        rangeDays={model.days}
        allDays={model.allDays}
        entries={entries}
        onNavigate={setDayKey}
        onUpdate={onUpdate}
        onEdit={(e) => setEditing(e)}
        onDelete={onDelete}
        onLog={(key) => { setDrawerOpen(false); setLogDate(key); }}
      />

      <AddTransactionForm
        key={logDate ?? 'closed'}
        open={logDate !== null}
        onOpenChange={(o) => { if (!o) setLogDate(null); }}
        defaultDate={logDate ?? undefined}
        onAdd={async (entry) => {
          await onAdd(entry);
          const key = entry.date ? format(new Date(entry.date), 'yyyy-MM-dd') : logDate;
          setLogDate(null);
          if (key) openDay(key);
        }}
        trigger={<span className="hidden" />}
      />

      {editing && (
        <EditTransactionForm
          key={editing.id}
          isOpen={!!editing}
          onClose={() => setEditing(null)}
          onUpdate={onUpdate}
          entry={editing}
        />
      )}
    </>
  );
}
