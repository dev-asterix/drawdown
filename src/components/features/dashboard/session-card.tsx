'use client';

import { useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, CalendarPlus } from 'lucide-react';
import type { EnrichedDay } from '@/lib/analytics/core';
import { percentileRank, summarize } from '@/lib/analytics/core';
import { AnimatedNumber } from '@/components/motion/primitives';
import { cn } from '@/lib/utils/utils';
import { useMoney, toneClass } from './format';

interface SessionCardProps {
  days: EnrichedDay[];
  onOpenDay: (key: string) => void;
  onLogToday: () => void;
}

/**
 * "Latest session" — the daily tracking anchor: today's (or the most recent)
 * result in context, plus a clickable strip of recent sessions.
 */
export function SessionCard({ days, onOpenDay, onLogToday }: SessionCardProps) {
  const money = useMoney();
  const reduce = useReducedMotion();
  const last = days[days.length - 1];
  const recent = useMemo(() => days.slice(-24), [days]);
  const maxAbs = useMemo(() => Math.max(1, ...recent.map((d) => Math.abs(d.pnl))), [recent]);

  const context = useMemo(() => {
    if (!last) return null;
    const pnls = days.map((d) => d.pnl);
    const sorted = [...pnls].sort((a, b) => b - a);
    const rank = sorted.indexOf(last.pnl) + 1;
    const { mean } = summarize(pnls);
    return {
      rank,
      percentile: percentileRank(pnls, last.pnl),
      vsMean: last.pnl - mean,
    };
  }, [days, last]);

  const loggedToday = last && isToday(last.date);

  if (!last || !context) {
    return (
      <div className="surface flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="eyebrow">Latest session</p>
        <p className="text-sm text-muted-foreground">No sessions in this range yet.</p>
        <button onClick={onLogToday} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          <CalendarPlus className="h-4 w-4" /> Log today
        </button>
      </div>
    );
  }

  const when = isToday(last.date) ? 'Today' : isYesterday(last.date) ? 'Yesterday' : format(last.date, 'EEE, MMM d');

  return (
    <div className="surface flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            {loggedToday && <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-positive" />}
            Latest session
          </p>
          <p className="mt-1 text-sm font-medium">{when}</p>
        </div>
        {!loggedToday && (
          <button
            onClick={onLogToday}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <CalendarPlus className="h-3.5 w-3.5" /> Log today
          </button>
        )}
      </div>

      <button
        onClick={() => onOpenDay(last.key)}
        className="group mt-3 flex items-end justify-between gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AnimatedNumber value={last.pnl} format={money.signedFull} className={cn('text-3xl font-bold tracking-tight', toneClass(last.pnl))} />
        <span className="mb-1 inline-flex items-center text-xs text-muted-foreground transition-colors group-hover:text-foreground">
          Analyze <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="well px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rank</p>
          <p className="text-sm font-semibold">#{context.rank}<span className="text-xs font-normal text-muted-foreground">/{days.length}</span></p>
        </div>
        <div className="well px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Percentile</p>
          <p className="text-sm font-semibold">P{Math.round(context.percentile)}</p>
        </div>
        <div className="well px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">vs avg</p>
          <p className={cn('text-sm font-semibold', toneClass(context.vsMean))}>{money.signed(context.vsMean)}</p>
        </div>
      </div>

      {/* Recent sessions strip */}
      <div className="mt-auto pt-4">
        <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Last {recent.length} sessions</span>
          <span>{format(recent[0].date, 'MMM d')} → {format(last.date, 'MMM d')}</span>
        </div>
        <div className="flex h-14 items-center gap-[3px]" role="list" aria-label="Recent sessions">
          {recent.map((d, i) => {
            const h = Math.max(8, (Math.abs(d.pnl) / maxAbs) * 50);
            return (
              <button
                key={d.key}
                role="listitem"
                onClick={() => onOpenDay(d.key)}
                title={`${format(d.date, 'EEE, MMM d')}: ${money.signedFull(d.pnl)}`}
                aria-label={`${d.key} ${money.signedFull(d.pnl)}`}
                className="group relative flex h-full flex-1 items-center justify-center outline-none"
              >
                <motion.span
                  className={cn(
                    'block w-full max-w-[14px] rounded-sm transition-opacity group-hover:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-ring',
                    d.pnl >= 0 ? 'bg-positive' : 'bg-negative',
                    d.key === last.key ? 'opacity-100' : 'opacity-60',
                  )}
                  style={{ originY: d.pnl >= 0 ? 1 : 0, translateY: d.pnl >= 0 ? -h / 2 : h / 2 }}
                  initial={{ height: reduce ? h : 0 }}
                  animate={{ height: h }}
                  transition={{ delay: reduce ? 0 : i * 0.008, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
