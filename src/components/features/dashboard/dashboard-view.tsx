'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Filter, X } from 'lucide-react';
import type { DailyPnL } from '@/types/trading';
import type { InsightType } from '@/lib/ai/types';
import { redactSnapshot } from '@/lib/ai/redact';
import { describeRange, type Range } from '@/lib/analytics/range';
import { BEHAVIOR_TAGS, hasTag } from '@/lib/analytics/tags';
import { WEEKDAY_LABELS } from '@/lib/analytics/core';
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

  const model = useDashboardModel(entries, baseCapital, range);
  const rangeLabel = describeRange(range);

  // --- range & drill-down ---------------------------------------------------
  const setRange = useCallback((r: Range | undefined) => {
    setTrail([]);
    setRangeState(r);
  }, []);

  const drillTo = useCallback((from: Date, to: Date) => {
    setTrail((t) => [...t, range]);
    setRangeState({ from: startOfDay(from), to: endOfDay(to) });
  }, [range]);

  const drillBack = useCallback(() => {
    setTrail((t) => {
      const copy = [...t];
      const prev = copy.pop();
      setRangeState(prev);
      return copy;
    });
  }, []);

  const openDay = useCallback((key: string) => {
    setDayKey(key);
    setDrawerOpen(true);
  }, []);

  const scrollToJournal = () => setTimeout(() => journalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);

  const handleSignal = useCallback((a: SignalAction) => {
    switch (a.type) {
      case 'day': openDay(a.key); break;
      case 'range': drillTo(parseISO(a.from), parseISO(a.to)); break;
      case 'weekday': setFocus({ type: 'weekday', weekday: a.weekday }); scrollToJournal(); break;
      case 'tag': setFocus({ type: 'tag', tag: a.tag }); scrollToJournal(); break;
    }
  }, [openDay, drillTo]);

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
    dateRange: { from: range?.from ?? new Date(0), to: range?.to ?? new Date() },
    dailyPnL: model.rangeEntries,
    stats: model.stats,
    drawdownSeries: model.days.map((d) => d.drawdownPct),
    currency: settings?.currency ?? 'INR',
    notes: model.rangeEntries.filter((e) => e.notes).map((e) => e.notes!),
  }), [range, model, settings?.currency]);

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

        <Reveal className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PulseHero days={model.days} stats={model.stats} previousStats={model.previousStats} rangeLabel={rangeLabel} health={model.health} />
          </div>
          <SessionCard days={model.days} onOpenDay={openDay} onLogToday={() => setLogDate(format(new Date(), 'yyyy-MM-dd'))} />
        </Reveal>

        <Reveal>
          <MetricTiles stats={model.stats} previousStats={model.previousStats} days={model.days} payoffRatio={model.payoffRatio} />
        </Reveal>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Reveal>
              <EquityChart
                days={model.days}
                allDays={model.allDays}
                allEntries={entries}
                range={range}
                onDayClick={openDay}
                onEmptyDayClick={(key) => openDay(key)}
                onRangeDrill={drillTo}
              />
            </Reveal>

            <Reveal>
              <SignalsFeed days={model.days} onAction={handleSignal} />
            </Reveal>

            <Reveal>
              <DeepDive
                days={model.days}
                startingEquity={model.startingEquity}
                activeWeekday={focus?.type === 'weekday' ? focus.weekday : null}
                activeTag={focus?.type === 'tag' ? focus.tag : null}
                onMonthDrill={drillTo}
                onRangeDrill={drillTo}
                onDay={openDay}
                onWeekday={(w) => {
                  setFocus((f) => (f?.type === 'weekday' && f.weekday === w ? null : { type: 'weekday', weekday: w }));
                  scrollToJournal();
                }}
                onTag={(t) => {
                  setFocus((f) => (f?.type === 'tag' && f.tag === t ? null : { type: 'tag', tag: t }));
                  scrollToJournal();
                }}
              />
            </Reveal>

            <Reveal>
              <div ref={journalRef} className="scroll-mt-20 space-y-2">
                {focusLabel && (
                  <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                    <Filter className="h-3.5 w-3.5 text-primary" />
                    <span>Journal filtered to <b>{focusLabel}</b> · {journalEntries.length} entries</span>
                    <button onClick={() => setFocus(null)} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                      <X className="h-3 w-3" /> Clear
                    </button>
                  </div>
                )}
                <TraderTransactionTable transactions={journalEntries} onDelete={onDelete} onEdit={setEditing} onUpdate={onUpdate} />
              </div>
            </Reveal>
          </div>

          <aside className="flex min-w-0 flex-col gap-5">
            <Reveal><AIInsightsSection buildSnapshot={buildSnapshot} /></Reveal>
            <Reveal><StopLossSimulator days={model.days} allDays={model.allDays} /></Reveal>
            <Reveal><TraderCockpit stats={model.stats} /></Reveal>
            {renderFunds && <Reveal>{renderFunds(range)}</Reveal>}
          </aside>
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
