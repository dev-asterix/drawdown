'use client';

import { useMemo, useState } from 'react';
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isAfter, isSameMonth, isToday,
  startOfMonth, startOfWeek, subMonths, endOfDay,
} from 'date-fns';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { EnrichedDay } from '@/lib/analytics/core';
import { mapPnLToBucket } from './pnl-calendar-helpers';
import { cn } from '@/lib/utils/utils';
import { useMoney } from '@/components/features/dashboard/format';

interface MonthCalendarProps {
  /** All-time enriched days, so navigation works beyond the selected range. */
  days: EnrichedDay[];
  initialMonth?: Date;
  onDayClick: (key: string, hasEntry: boolean) => void;
  onMonthDrill?: (from: Date, to: Date) => void;
}

const WEEK_HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * A true month grid for daily tracking: every cell shows the session's
 * P&L, weekly totals run down the right edge, empty past days invite logging.
 */
export function MonthCalendar({ days, initialMonth, onDayClick, onMonthDrill }: MonthCalendarProps) {
  const money = useMoney();
  const reduce = useReducedMotion();
  const [month, setMonth] = useState(() => startOfMonth(initialMonth ?? (days.length ? days[days.length - 1].date : new Date())));
  const [direction, setDirection] = useState(0);

  const byKey = useMemo(() => new Map(days.map((d) => [d.key, d])), [days]);

  const { weeks, summary, maxAbs } = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const all = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const ws: Date[][] = [];
    for (let i = 0; i < all.length; i += 7) ws.push(all.slice(i, i + 7));
    const inMonth = days.filter((d) => isSameMonth(d.date, month));
    const total = inMonth.reduce((s, d) => s + d.pnl, 0);
    const wins = inMonth.filter((d) => d.pnl > 0).length;
    return {
      weeks: ws,
      maxAbs: Math.max(0, ...inMonth.map((d) => Math.abs(d.pnl))),
      summary: { total, sessions: inMonth.length, winRate: inMonth.length ? (wins / inMonth.length) * 100 : 0 },
    };
  }, [month, days]);

  const go = (dir: number) => {
    setDirection(dir);
    setMonth((m) => (dir > 0 ? addMonths(m, 1) : subMonths(m, 1)));
  };

  const now = new Date();

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => go(-1)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMonthDrill?.(startOfMonth(month), endOfMonth(month))}
            className="min-w-[128px] rounded-lg px-2 py-1 text-sm font-semibold hover:bg-accent"
            title="Zoom the dashboard to this month"
          >
            {format(month, 'MMMM yyyy')}
          </button>
          <button
            onClick={() => go(1)}
            disabled={isAfter(startOfMonth(addMonths(month, 1)), now)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={cn('font-semibold', summary.total >= 0 ? 'text-positive' : 'text-negative')}>{money.signed(summary.total)}</span>
          <span className="text-muted-foreground">{summary.sessions} sessions</span>
          <span className="text-muted-foreground">{summary.winRate.toFixed(0)}% win</span>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(52px,0.9fr)] gap-1 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {WEEK_HEAD.map((d) => <div key={d} className="pb-1">{d}</div>)}
        <div className="pb-1">Week</div>
      </div>

      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={format(month, 'yyyy-MM')}
          custom={direction}
          initial={reduce ? false : { opacity: 0, x: direction * 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="grid flex-1 auto-rows-fr gap-1"
        >
          {weeks.map((week) => {
            const weekDays = week.map((d) => byKey.get(format(d, 'yyyy-MM-dd'))).filter(Boolean) as EnrichedDay[];
            const weekTotal = weekDays.reduce((s, d) => s + d.pnl, 0);
            return (
              <div key={week[0].toISOString()} className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(52px,0.9fr)] gap-1">
                {week.map((date) => {
                  const key = format(date, 'yyyy-MM-dd');
                  const entry = byKey.get(key);
                  const outside = !isSameMonth(date, month);
                  const future = isAfter(date, endOfDay(now));
                  const { bucket, tone } = entry ? mapPnLToBucket(entry.pnl, maxAbs) : { bucket: 0, tone: 'neutral' as const };
                  return (
                    <button
                      key={key}
                      disabled={future}
                      onClick={() => onDayClick(key, !!entry)}
                      className={cn(
                        'group relative flex min-h-[44px] flex-col items-start justify-between rounded-lg border p-1.5 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[52px]',
                        outside && 'opacity-35',
                        future && 'cursor-not-allowed opacity-25',
                        entry
                          ? cn('border-transparent hover:shadow-elev-2', bucket > 0 && `bg-${tone}-${bucket}`, bucket >= 4 && 'text-background dark:text-background')
                          : 'border-dashed border-border/70 hover:border-primary/50',
                        isToday(date) && 'ring-2 ring-primary/70',
                      )}
                      aria-label={`${key}${entry ? `: ${money.signedFull(entry.pnl)}` : ': no session'}`}
                    >
                      <span className={cn('text-[10px] font-medium', !entry && 'text-muted-foreground')}>{format(date, 'd')}</span>
                      {entry ? (
                        <span className="w-full truncate text-[10px] font-semibold tabular-nums sm:text-[11px]">{money.signed(entry.pnl)}</span>
                      ) : (
                        !future && !outside && <Plus className="h-3 w-3 self-end text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </button>
                  );
                })}
                <div className={cn('flex flex-col items-end justify-center well px-1.5 text-[10px] tabular-nums', weekDays.length === 0 && 'opacity-40')}>
                  <span className={cn('font-semibold', weekTotal > 0 ? 'text-positive' : weekTotal < 0 ? 'text-negative' : 'text-muted-foreground')}>
                    {weekDays.length ? money.signed(weekTotal) : '—'}
                  </span>
                  <span className="text-muted-foreground">{weekDays.length}d</span>
                </div>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
