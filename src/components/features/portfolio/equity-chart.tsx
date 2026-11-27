'use client';

import { useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Cell, ComposedChart, Line, ReferenceDot,
  ReferenceLine, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis,
} from 'recharts';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Activity, BarChart3, CalendarDays, Gauge, MousePointerClick, TrendingDown, TrendingUp } from 'lucide-react';
import { format, parseISO, startOfMonth, startOfWeek, endOfMonth, endOfWeek } from 'date-fns';
import type { DailyPnL } from '@/types/trading';
import type { EnrichedDay } from '@/lib/analytics/core';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { CustomTabs, type TabItem } from '@/components/ui/custom-tabs';
import { cn } from '@/lib/utils/utils';
import { applyPnLViewMode, type PnLViewMode, type EquityViewMode } from './equity-chart-helpers';
import { PnLCalendar } from './pnl-calendar';
import { MonthCalendar } from './month-calendar';
import { useMoney } from '@/components/features/dashboard/format';
import type { Range } from '@/lib/analytics/range';

type ChartType = 'equity' | 'pnl' | 'drawdown' | 'rolling' | 'activity';
type Aggregation = 'daily' | 'weekly' | 'monthly';

interface EquityChartProps {
  /** Range-scoped enriched days */
  days: EnrichedDay[];
  /** All-time enriched days (calendar navigation) */
  allDays: EnrichedDay[];
  /** All raw entries (year heatmap) */
  allEntries: DailyPnL[];
  range?: Range;
  className?: string;
  onDayClick: (key: string) => void;
  onEmptyDayClick?: (key: string) => void;
  onRangeDrill?: (from: Date, to: Date) => void;
}

interface Point {
  key: string;
  label: string;
  from: Date;
  to: Date;
  pnl: number;
  equity: number;
  peak: number;
  drawdownPct: number;
  cumulative: number;
  rWin: number;
  rExp: number;
  sessions: number;
  isNewHigh: boolean;
}

const TABS: TabItem[] = [
  { id: 'equity', label: 'Equity', icon: TrendingUp },
  { id: 'pnl', label: 'P&L', icon: BarChart3 },
  { id: 'drawdown', label: 'Drawdown', icon: TrendingDown },
  { id: 'rolling', label: 'Rolling', icon: Gauge },
  { id: 'activity', label: 'Calendar', icon: CalendarDays },
];

const TITLES: Record<ChartType, { title: string; sub: string }> = {
  equity: { title: 'Equity curve', sub: 'Account value after each session' },
  pnl: { title: 'Session P&L', sub: 'Green and red sessions over time' },
  drawdown: { title: 'Underwater', sub: 'Distance below the running equity peak' },
  rolling: { title: 'Rolling form', sub: '20-session win rate and average P&L' },
  activity: { title: 'Calendar', sub: 'Every session, day by day' },
};

function aggregate(days: EnrichedDay[], mode: Aggregation): Point[] {
  if (mode === 'daily') {
    return days.map((d) => ({
      key: d.key, label: format(d.date, 'MMM d'), from: d.date, to: d.date, pnl: d.pnl, equity: d.equity, peak: d.peak,
      drawdownPct: d.drawdownPct, cumulative: d.cumulative, rWin: d.rollingWinRate, rExp: d.rollingExpectancy, sessions: 1, isNewHigh: d.isNewHigh,
    }));
  }
  const map = new Map<string, Point>();
  for (const d of days) {
    const start = mode === 'weekly' ? startOfWeek(d.date, { weekStartsOn: 1 }) : startOfMonth(d.date);
    const key = format(start, 'yyyy-MM-dd');
    const p = map.get(key);
    if (!p) {
      map.set(key, {
        key,
        label: mode === 'weekly' ? `Wk ${format(start, 'MMM d')}` : format(start, "MMM ''yy"),
        from: start,
        to: mode === 'weekly' ? endOfWeek(start, { weekStartsOn: 1 }) : endOfMonth(start),
        pnl: d.pnl, equity: d.equity, peak: d.peak, drawdownPct: d.drawdownPct, cumulative: d.cumulative,
        rWin: d.rollingWinRate, rExp: d.rollingExpectancy, sessions: 1, isNewHigh: d.isNewHigh,
      });
    } else {
      p.pnl += d.pnl;
      p.equity = d.equity;
      p.peak = d.peak;
      p.drawdownPct = Math.min(p.drawdownPct, d.drawdownPct);
      p.cumulative = d.cumulative;
      p.rWin = d.rollingWinRate;
      p.rExp = d.rollingExpectancy;
      p.sessions++;
      p.isNewHigh = p.isNewHigh || d.isNewHigh;
    }
  }
  return Array.from(map.values());
}

function RichTooltip({ active, payload, mode, money, aggregation, rUnit, equityMode }: any) {
  if (!active || !payload?.length) return null;
  const p: Point = payload[0].payload;
  const dateLabel = aggregation === 'daily'
    ? format(p.from, 'EEE, MMM d, yyyy')
    : aggregation === 'weekly' ? `Week of ${format(p.from, 'MMM d, yyyy')}` : format(p.from, 'MMMM yyyy');
  return (
    <div className="min-w-[190px] rounded-xl border border-border bg-popover/95 p-3 text-xs shadow-xl backdrop-blur" role="tooltip">
      <p className="mb-2 font-medium text-muted-foreground">{dateLabel}{aggregation !== 'daily' && ` · ${p.sessions} sessions`}</p>
      <div className="space-y-1">
        <Row label={aggregation === 'daily' ? 'Session P&L' : 'Period P&L'} value={money.signedFull(p.pnl)} tone={p.pnl} />
        {mode === 'equity' && equityMode === 'r-multiple' && <Row label="Cumulative" value={`${(p.cumulative / rUnit).toFixed(2)}R`} tone={p.cumulative} />}
        <Row label="Equity" value={money.full(p.equity)} />
        <Row label="Drawdown" value={`${p.drawdownPct.toFixed(2)}%`} tone={p.drawdownPct < 0 ? -1 : 0} />
        {mode === 'rolling' && (
          <>
            <Row label="Win rate (20)" value={`${p.rWin.toFixed(0)}%`} />
            <Row label="Avg P&L (20)" value={money.signed(p.rExp)} tone={p.rExp} />
          </>
        )}
      </div>
      <p className="mt-2 flex items-center gap-1 border-t border-border pt-2 text-[10px] text-muted-foreground">
        <MousePointerClick className="h-3 w-3" /> Click to {aggregation === 'daily' ? 'analyze session' : 'zoom in'}
      </p>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', tone === undefined ? '' : tone > 0 ? 'text-positive' : tone < 0 ? 'text-negative' : '')}>{value}</span>
    </div>
  );
}

const axisTick = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 }; // eslint-disable-line no-restricted-syntax -- chart axis styling

export function EquityChart({ days, allDays, allEntries, range, className, onDayClick, onEmptyDayClick, onRangeDrill }: EquityChartProps) {
  const money = useMoney();
  const reduce = useReducedMotion();
  const [chartType, setChartType] = useLocalStorage<ChartType>('equity-chart-type', 'equity');
  const [equityViewMode, setEquityViewMode] = useLocalStorage<EquityViewMode>('equity-view-mode', 'absolute');
  const [pnlViewMode, setPnlViewMode] = useLocalStorage<PnLViewMode>('pnl-view-mode', 'raw');
  const [showDrawdown, setShowDrawdown] = useLocalStorage<boolean>('equity-show-drawdown', true);
  const [aggregation, setAggregation] = useLocalStorage<Aggregation>('equity-aggregation-period', 'daily');
  const [calendarMode, setCalendarMode] = useLocalStorage<'month' | 'year'>('calendar-mode', 'month');
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const type: ChartType = (TABS.some((t) => t.id === chartType) ? chartType : 'equity') as ChartType;
  const points = useMemo(() => aggregate(days, aggregation), [days, aggregation]);

  // 1R = average losing session (falls back to 1% of starting equity)
  const rUnit = useMemo(() => {
    const losses = days.filter((d) => d.pnl < 0);
    if (losses.length) return Math.abs(losses.reduce((s, d) => s + d.pnl, 0) / losses.length);
    return Math.max(1, Math.abs(days[0]?.equityBefore ?? 100) * 0.01);
  }, [days]);

  const equityPoints = useMemo(
    () => points.map((p) => ({ ...p, y: equityViewMode === 'r-multiple' ? p.cumulative / rUnit : p.equity, yPeak: equityViewMode === 'r-multiple' ? null : p.peak })),
    [points, equityViewMode, rUnit],
  );

  // P&L view modes reuse the tested helpers (raw / clipped / log)
  const pnlPoints = useMemo(() => {
    const transformed = applyPnLViewMode(points.map((p) => ({ date: p.key, equity: p.equity, pnl: p.pnl, pnlPercentage: 0 })), pnlViewMode);
    return points.map((p, i) => ({ ...p, display: transformed[i].pnl }));
  }, [points, pnlViewMode]);

  const peakPoint = useMemo(() => equityPoints.reduce<typeof equityPoints[number] | null>((best, p) => (!best || p.y > best.y ? p : best), null), [equityPoints]);
  const troughPoint = useMemo(() => points.reduce<Point | null>((w, p) => (!w || p.drawdownPct < w.drawdownPct ? p : w), null), [points]);

  const handleClick = (state: any) => {
    const idx = typeof state?.activeIndex === 'number' ? state.activeIndex : Number(state?.activeIndex);
    const p = Number.isFinite(idx) ? points[idx] : undefined;
    if (!p) return;
    if (aggregation === 'daily') onDayClick(p.key);
    else onRangeDrill?.(p.from, p.to);
  };

  const showBrush = points.length > 45;
  const brush = showBrush ? (
    <Brush
      dataKey="label"
      height={22}
      travellerWidth={8}
      stroke="hsl(var(--brand))"
      fill="hsl(var(--card))"
      tickFormatter={() => ''}
      startIndex={Math.max(0, points.length - 120)}
    />
  ) : null;

  const tickFmt = (v: number) => (equityViewMode === 'r-multiple' && type === 'equity' ? `${v.toFixed(0)}R` : money.short(v));
  const tooltip = <RechartsTooltip content={<RichTooltip mode={type} money={money} aggregation={aggregation} rUnit={rUnit} equityMode={equityViewMode} />} cursor={{ stroke: 'hsl(var(--brand))', strokeOpacity: 0.35, strokeDasharray: '3 3' }} />;
  const anim = { isAnimationActive: !reduce, animationDuration: 700, animationEasing: 'ease-out' as const };
  const empty = days.length === 0;

  return (
    <div className={cn('surface min-w-0 overflow-hidden', className)}>
      <div className="flex flex-col gap-3 p-4 pb-2 sm:p-5 sm:pb-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight">{TITLES[type].title}</h3>
            <p className="text-xs text-muted-foreground">{TITLES[type].sub}</p>
          </div>
          <CustomTabs items={TABS} value={type} onValueChange={(v) => setChartType(v as ChartType)} size="sm" compact className="max-w-full overflow-x-auto" />
        </div>

        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Chart view controls">
          {type !== 'activity' && (
            <CustomTabs
              size="sm"
              items={[{ id: 'daily', label: 'Daily' }, { id: 'weekly', label: 'Weekly' }, { id: 'monthly', label: 'Monthly' }]}
              value={aggregation}
              onValueChange={(v) => setAggregation(v as Aggregation)}
            />
          )}
          {type === 'equity' && (
            <>
              <CustomTabs size="sm" items={[{ id: 'absolute', label: 'Absolute' }, { id: 'r-multiple', label: 'R-Multiple' }]} value={equityViewMode} onValueChange={(v) => setEquityViewMode(v as EquityViewMode)} />
              <Toggle active={showDrawdown} onClick={() => setShowDrawdown(!showDrawdown)} label="Drawdown" icon={<TrendingDown className="h-3 w-3" />} />
            </>
          )}
          {type === 'pnl' && (
            <CustomTabs size="sm" items={[{ id: 'raw', label: 'Raw' }, { id: 'clipped', label: 'Clipped' }, { id: 'log', label: 'Log' }]} value={pnlViewMode} onValueChange={(v) => setPnlViewMode(v as PnLViewMode)} />
          )}
          {type === 'activity' && (
            <CustomTabs size="sm" items={[{ id: 'month', label: 'Month' }, { id: 'year', label: '12 months' }]} value={calendarMode} onValueChange={(v) => setCalendarMode(v as 'month' | 'year')} />
          )}
          {type === 'equity' && equityViewMode === 'r-multiple' && (
            <span className="text-[11px] text-muted-foreground">1R = avg losing session ({money.short(rUnit)})</span>
          )}
        </div>
      </div>

      <div className="px-1 pb-3 sm:px-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${type}-${type === 'activity' ? calendarMode : aggregation}`}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className={cn('w-full', type === 'activity' ? 'min-h-[320px] px-2 sm:px-1' : 'h-[260px] sm:h-[320px] lg:h-[360px]')}
          >
            {empty && type !== 'activity' ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No sessions in this range</div>
            ) : type === 'activity' ? (
              calendarMode === 'month' ? (
                <MonthCalendar
                  days={allDays}
                  initialMonth={range?.to}
                  onDayClick={(key, has) => (has ? onDayClick(key) : onEmptyDayClick?.(key))}
                  onMonthDrill={onRangeDrill}
                />
              ) : (
                <PnLCalendar
                  data={allEntries}
                  className="no-card"
                  dateRange={range}
                  onDayClick={(entry, date) => {
                    const key = format(date, 'yyyy-MM-dd');
                    if (entry) onDayClick(key);
                    else onEmptyDayClick?.(key);
                  }}
                />
              )
            ) : type === 'equity' ? (
              <div className="flex h-full flex-col">
                <div className={cn('min-h-0', showDrawdown && equityViewMode === 'absolute' ? 'flex-[3]' : 'flex-1')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={equityPoints} margin={{ top: 22, right: 12, left: 0, bottom: 0 }} onClick={handleClick} syncId="studio" style={{ cursor: 'pointer' }}>
                      <defs>
                        <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="eqStroke" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="hsl(var(--brand-2))" />
                          <stop offset="100%" stopColor="hsl(var(--brand))" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="hsl(var(--grid))" strokeOpacity={0.6} vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} minTickGap={36} dy={6} />
                      <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={tickFmt} width={64} domain={['auto', 'auto']} />
                      {tooltip}
                      {equityViewMode === 'r-multiple' && <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} />}
                      {showDrawdown && equityViewMode === 'absolute' && (
                        <Line type="stepAfter" dataKey="yPeak" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeDasharray="4 4" dot={false} strokeWidth={1} {...anim} />
                      )}
                      <Area type="monotone" dataKey="y" stroke="url(#eqStroke)" strokeWidth={2.5} fill="url(#eqFill)" activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))', fill: 'hsl(var(--brand))' }} {...anim} />
                      {peakPoint && equityPoints.length > 2 && (
                        <ReferenceDot x={peakPoint.label} y={peakPoint.y} r={4} fill="hsl(var(--positive))" stroke="hsl(var(--card))" strokeWidth={2} label={{ value: 'Peak', position: 'top', fill: 'hsl(var(--positive))', fontSize: 10 }} /> // eslint-disable-line no-restricted-syntax -- chart label styling
                      )}
                      {brush}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {showDrawdown && equityViewMode === 'absolute' && (
                  <div className="min-h-0 flex-1 border-t border-border/60 pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={equityPoints} margin={{ top: 4, right: 12, left: 0, bottom: 0 }} syncId="studio" onClick={handleClick}>
                        <defs>
                          <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--negative))" stopOpacity={0.05} />
                            <stop offset="100%" stopColor="hsl(var(--negative))" stopOpacity={0.4} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="label" hide />
                        <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} width={64} domain={['dataMin', 0]} />
                        <RechartsTooltip content={() => null} cursor={{ stroke: 'hsl(var(--brand))', strokeOpacity: 0.35, strokeDasharray: '3 3' }} />
                        <Area type="monotone" dataKey="drawdownPct" stroke="hsl(var(--negative))" strokeWidth={1.25} fill="url(#ddFill)" baseValue={0} {...anim} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : type === 'pnl' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pnlPoints} margin={{ top: 10, right: 12, left: 0, bottom: 0 }} onClick={handleClick} onMouseMove={(s: any) => setHoverKey(typeof s?.activeIndex === 'number' ? pnlPoints[s.activeIndex]?.key ?? null : null)} onMouseLeave={() => setHoverKey(null)} style={{ cursor: 'pointer' }}>
                  <CartesianGrid stroke="hsl(var(--grid))" strokeOpacity={0.6} vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} minTickGap={36} dy={6} />
                  <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(v) => (pnlViewMode === 'log' ? Number(v).toFixed(1) : money.short(v))} width={64} />
                  {tooltip}
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} />
                  <Bar dataKey="display" radius={[3, 3, 3, 3]} maxBarSize={28} {...anim}>
                    {pnlPoints.map((p) => (
                      <Cell key={p.key} fill={p.pnl >= 0 ? 'hsl(var(--positive))' : 'hsl(var(--negative))'} fillOpacity={hoverKey && hoverKey !== p.key ? 0.45 : 0.9} />
                    ))}
                  </Bar>
                  {brush}
                </BarChart>
              </ResponsiveContainer>
            ) : type === 'drawdown' ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 16, right: 12, left: 0, bottom: 0 }} onClick={handleClick} style={{ cursor: 'pointer' }}>
                  <defs>
                    <linearGradient id="uwFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--negative))" stopOpacity={0.05} />
                      <stop offset="100%" stopColor="hsl(var(--negative))" stopOpacity={0.45} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--grid))" strokeOpacity={0.6} vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} minTickGap={36} dy={6} />
                  <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} width={56} domain={['dataMin', 0]} />
                  {tooltip}
                  <ReferenceLine y={-10} stroke="hsl(var(--warning))" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: '-10%', position: 'insideBottomLeft', fill: 'hsl(var(--warning))', fontSize: 10 }} /> {/* eslint-disable-line no-restricted-syntax -- chart label styling */}
                  <Area type="monotone" dataKey="drawdownPct" stroke="hsl(var(--negative))" strokeWidth={2} fill="url(#uwFill)" baseValue={0} {...anim} />
                  {troughPoint && troughPoint.drawdownPct < 0 && (
                    <ReferenceDot x={troughPoint.label} y={troughPoint.drawdownPct} r={4} fill="hsl(var(--negative))" stroke="hsl(var(--card))" strokeWidth={2} label={{ value: `${troughPoint.drawdownPct.toFixed(1)}%`, position: 'bottom', fill: 'hsl(var(--negative))', fontSize: 10 }} /> // eslint-disable-line no-restricted-syntax -- chart label styling
                  )}
                  {brush}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={points} margin={{ top: 10, right: 4, left: 0, bottom: 0 }} onClick={handleClick} style={{ cursor: 'pointer' }}>
                  <CartesianGrid stroke="hsl(var(--grid))" strokeOpacity={0.6} vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} minTickGap={36} dy={6} />
                  <YAxis yAxisId="wr" axisLine={false} tickLine={false} tick={axisTick} domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={44} />
                  <YAxis yAxisId="exp" orientation="right" axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(v) => money.short(v)} width={60} />
                  {tooltip}
                  <ReferenceLine yAxisId="wr" y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <ReferenceLine yAxisId="exp" y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.3} />
                  <Bar yAxisId="exp" dataKey="rExp" maxBarSize={10} radius={[2, 2, 2, 2]} {...anim}>
                    {points.map((p) => <Cell key={p.key} fill={p.rExp >= 0 ? 'hsl(var(--positive))' : 'hsl(var(--negative))'} fillOpacity={0.35} />)}
                  </Bar>
                  <Line yAxisId="wr" type="monotone" dataKey="rWin" stroke="hsl(var(--brand))" strokeWidth={2.25} dot={false} {...anim} />
                  {brush}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </AnimatePresence>

        {type === 'rolling' && !empty && (
          <div className="flex items-center gap-4 px-3 pt-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-brand" /> Win rate (20)</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-positive/40" /> Avg P&L (20)</span>
          </div>
        )}
        {type !== 'activity' && !empty && (
          <p className="flex items-center gap-1 px-3 pt-1 text-[10px] text-muted-foreground/80">
            <Activity className="h-3 w-3" /> {aggregation === 'daily' ? 'Click any point to drill into that session' : 'Click a period to zoom the whole dashboard into it'}
            {showBrush && ' · drag the handles below to zoom'}
          </p>
        )}
      </div>
    </div>
  );
}

function Toggle({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-[30px] items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-negative/40 bg-negative/10 text-negative' : 'border-border/80 bg-muted/60 text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
