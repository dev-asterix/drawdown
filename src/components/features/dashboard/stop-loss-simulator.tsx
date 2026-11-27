'use client';

import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Calculator, ShieldCheck } from 'lucide-react';
import type { EnrichedDay } from '@/lib/analytics/core';
import { simulateDailyStop, suggestStop } from '@/lib/analytics/simulator';
import { AnimatedNumber } from '@/components/motion/primitives';
import { getCurrencySymbol } from '@/lib/utils/format-settings';
import { cn } from '@/lib/utils/utils';
import { useMoney, toneClass } from './format';

interface StopLossSimulatorProps {
  /** Range-scoped days */
  days: EnrichedDay[];
  /** All-time days, for per-month selection */
  allDays: EnrichedDay[];
}

export function StopLossSimulator({ days, allDays }: StopLossSimulatorProps) {
  const money = useMoney();
  const [scope, setScope] = useState<string>('range');
  const months = useMemo(() => {
    const set = new Set(allDays.map((d) => d.key.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [allDays]);

  const scoped = useMemo(() => (scope === 'range' ? days : allDays.filter((d) => d.key.startsWith(scope))), [scope, days, allDays]);
  const suggested = useMemo(() => suggestStop(scoped.map((d) => d.pnl)), [scoped]);
  const maxLoss = useMemo(() => Math.max(suggested * 3, ...scoped.map((d) => Math.abs(Math.min(0, d.pnl)))), [scoped, suggested]);
  const [stop, setStop] = useState<number>(suggested);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) setStop(suggested);
  }, [suggested, touched]);

  const result = useMemo(() => simulateDailyStop(scoped, stop), [scoped, stop]);
  const step = Math.max(1, 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, maxLoss))) - 2));
  const symbol = getCurrencySymbol(money.settings);

  return (
    <section className="surface p-5" aria-labelledby="sim-title">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><Calculator className="h-4 w-4" /></span>
        <div>
          <h3 id="sim-title" className="text-sm font-semibold">Stop-loss simulator</h3>
          <p className="text-[11px] text-muted-foreground">Replay your sessions with a hard daily loss limit</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <label htmlFor="sim-scope" className="text-xs text-muted-foreground">Period</label>
          <select
            id="sim-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="range">Selected range</option>
            {months.map((m) => <option key={m} value={m}>{format(parseISO(`${m}-01`), 'MMMM yyyy')}</option>)}
          </select>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="sim-stop" className="text-xs text-muted-foreground">Daily stop</label>
            <div className="flex items-center gap-1 rounded-lg border border-input bg-background px-2">
              <span className="text-xs text-muted-foreground">{symbol}</span>
              <input
                id="sim-stop"
                type="number"
                min={0}
                step={step}
                value={stop}
                onChange={(e) => { setTouched(true); setStop(Math.max(0, Number(e.target.value) || 0)); }}
                className="h-7 w-20 bg-transparent text-right text-xs font-semibold tabular-nums outline-none"
              />
            </div>
          </div>
          <input
            type="range"
            aria-label="Daily stop slider"
            min={step}
            max={Math.max(step * 2, Math.ceil(maxLoss / step) * step)}
            step={step}
            value={Math.min(stop, Math.ceil(maxLoss / step) * step)}
            onChange={(e) => { setTouched(true); setStop(Number(e.target.value)); }}
            className="w-full accent-primary"
          />
          {touched && stop !== suggested && (
            <button onClick={() => { setTouched(false); setStop(suggested); }} className="text-[10px] text-primary hover:underline">
              Reset to your median loss ({money.short(suggested)})
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-muted/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Actual</p>
            <p className={cn('text-sm font-semibold tabular-nums', toneClass(result.actualTotal))}>{money.signed(result.actualTotal)}</p>
          </div>
          <div className="rounded-xl bg-primary/5 px-3 py-2 ring-1 ring-primary/20">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">With stop</p>
            <AnimatedNumber value={result.simulatedTotal} format={money.signed} className={cn('text-sm font-semibold', toneClass(result.simulatedTotal))} duration={0.4} />
          </div>
        </div>

        {result.series.length > 1 && (
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.series} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <RechartsTooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-border bg-popover/95 px-2 py-1.5 text-[11px] shadow-lg">
                        <p className="text-muted-foreground">{p.key}</p>
                        <p>Actual {money.signed(p.actual)}</p>
                        <p className="text-primary">With stop {money.signed(p.simulated)}</p>
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="actual" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.6} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="simulated" stroke="hsl(var(--brand))" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className={cn('flex items-start gap-2 rounded-xl px-3 py-2 text-xs', result.saved > 0 ? 'bg-positive/10' : 'bg-muted/50')}>
          <ShieldCheck className={cn('mt-0.5 h-4 w-4 shrink-0', result.saved > 0 ? 'text-positive' : 'text-muted-foreground')} />
          <p>
            {result.saved > 0 ? (
              <>A {money.short(stop)} stop would have triggered on <b>{result.daysCapped}</b> of {scoped.length} sessions and saved <b className="text-positive">{money.short(result.saved)}</b>.</>
            ) : (
              <>None of your {scoped.length} sessions lost more than {money.short(stop)}. Your losses are already contained at this level.</>
            )}
          </p>
        </div>
        <p className="text-[10px] leading-relaxed text-muted-foreground">Assumes the stop fills exactly at the limit and no later trades that day. Real results vary.</p>
      </div>
    </section>
  );
}
