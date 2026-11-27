'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowUpRight, Info, Radar, TrendingDown, TrendingUp } from 'lucide-react';
import type { EnrichedDay } from '@/lib/analytics/core';
import { buildSignals, type Signal, type SignalAction } from '@/lib/analytics/signals';
import { cn } from '@/lib/utils/utils';
import { useMoney } from './format';

interface SignalsFeedProps {
  days: EnrichedDay[];
  onAction: (action: SignalAction) => void;
}

const TONE = {
  positive: { Icon: TrendingUp, chip: 'bg-positive/10 text-positive', bar: 'bg-positive' },
  negative: { Icon: TrendingDown, chip: 'bg-negative/10 text-negative', bar: 'bg-negative' },
  warning: { Icon: AlertTriangle, chip: 'bg-warning/10 text-warning', bar: 'bg-warning' },
  info: { Icon: Info, chip: 'bg-info/10 text-info', bar: 'bg-info' },
} as const;

function actionLabel(a: SignalAction) {
  switch (a.type) {
    case 'day': return 'Open session';
    case 'range': return `Zoom to ${a.label.toLowerCase()}`;
    case 'weekday': return 'Filter journal';
    case 'tag': return 'Show tagged days';
  }
}

export function SignalsFeed({ days, onAction }: SignalsFeedProps) {
  const money = useMoney();
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const signals = useMemo<Signal[]>(() => buildSignals({ days, formatMoney: money.short }), [days, money.short]);
  const visible = expanded ? signals : signals.slice(0, 4);

  return (
    <section className="surface p-5" aria-labelledby="signals-title">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-primary-foreground shadow-sm">
            <Radar className="h-4 w-4" />
          </span>
          <div>
            <h3 id="signals-title" className="text-sm font-semibold">Signals</h3>
            <p className="text-[11px] text-muted-foreground">Patterns detected on-device from {days.length} sessions</p>
          </div>
        </div>
        {signals.length > 4 && (
          <button onClick={() => setExpanded((e) => !e)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
            {expanded ? 'Show less' : `+${signals.length - 4} more`}
          </button>
        )}
      </div>

      {signals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Log a few more sessions and patterns will start showing up here.
        </p>
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-2">
          <AnimatePresence initial={!reduce}>
            {visible.map((s, i) => {
              const t = TONE[s.tone];
              const interactive = !!s.action;
              const Body = (
                <>
                  <span className={cn('absolute inset-y-3 left-0 w-0.5 rounded-full', t.bar)} aria-hidden />
                  <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', t.chip)}>
                    <t.Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-snug">{s.title}</span>
                      {s.metric && <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', t.chip)}>{s.metric}</span>}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{s.detail}</span>
                    {s.action && (
                      <span className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary">
                        {actionLabel(s.action)} <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </span>
                    )}
                  </span>
                </>
              );
              return (
                <motion.li
                  key={s.id}
                  layout={!reduce}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, delay: reduce ? 0 : i * 0.04 }}
                >
                  {interactive ? (
                    <button
                      onClick={() => onAction(s.action!)}
                      className="group relative flex w-full items-start gap-3 rounded-xl border border-border/70 bg-background/40 p-3 pl-4 text-left outline-none transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {Body}
                    </button>
                  ) : (
                    <div className="relative flex items-start gap-3 rounded-xl border border-border/70 bg-background/40 p-3 pl-4">{Body}</div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
