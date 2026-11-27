/**
 * Drawdown analytics engine.
 *
 * Pure, deterministic functions that turn raw daily P&L entries into the
 * derived series and breakdowns rendered across the dashboard. Nothing here
 * touches React, the network or storage, so every function is unit-testable.
 */
import { format, startOfWeek, startOfMonth } from 'date-fns';
import type { DailyPnL } from '@/types/trading';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One consolidated trading day with everything the UI needs to draw it. */
export interface EnrichedDay {
  /** Local calendar key, yyyy-MM-dd */
  key: string;
  date: Date;
  pnl: number;
  notes: string;
  /** Ids of the raw entries merged into this day (usually one). */
  ids: string[];
  /** Equity before this day's P&L was booked. */
  equityBefore: number;
  /** Equity after this day's P&L. */
  equity: number;
  /** Running high-water mark (including this day). */
  peak: number;
  /** Drawdown from the peak as a negative percentage (0 at a new high). */
  drawdownPct: number;
  /** Cumulative P&L since the start of the series. */
  cumulative: number;
  /** Day's P&L as a % of equity before the day. */
  returnPct: number;
  /** Rolling win rate over the trailing window (incl. this day), 0–100. */
  rollingWinRate: number;
  /** Rolling average P&L over the trailing window. */
  rollingExpectancy: number;
  /** Standard score of this day versus the whole series. */
  zScore: number;
  /** True if this day set a new equity high. */
  isNewHigh: boolean;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

export interface SeriesSummary {
  count: number;
  mean: number;
  median: number;
  stdDev: number;
}

export interface WeekdayStat {
  weekday: number;
  label: string;
  count: number;
  total: number;
  average: number;
  winRate: number;
  best: number;
  worst: number;
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
  /** midpoint, useful as an x value */
  mid: number;
  tone: 'gain' | 'loss' | 'mixed';
}

export interface DrawdownEpisode {
  start: string;
  trough: string;
  /** null when not recovered yet */
  recovery: string | null;
  depthPct: number;
  depthAbs: number;
  /** trading days from start to trough */
  daysToTrough: number;
  /** trading days from start to recovery (or to the last day if ongoing) */
  duration: number;
  recovered: boolean;
}

export interface MonthCell {
  year: number;
  month: number; // 0-11
  key: string; // yyyy-MM
  total: number;
  days: number;
  winRate: number;
  returnPct: number;
}

export interface YearRow {
  year: number;
  months: (MonthCell | null)[];
  total: number;
  days: number;
}

export interface PeriodGroup {
  key: string;
  start: Date;
  total: number;
  days: number;
  wins: number;
  losses: number;
}

export interface ConditionalStats {
  /** Win rate on the day after a losing day */
  afterLossWinRate: number | null;
  /** Average P&L on the day after a losing day */
  afterLossAverage: number | null;
  /** Win rate on the day after a winning day */
  afterWinWinRate: number | null;
  afterWinAverage: number | null;
  /** Sample sizes */
  afterLossCount: number;
  afterWinCount: number;
}

export interface StreakRun {
  type: 'win' | 'loss';
  length: number;
  total: number;
  start: string;
  end: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Local yyyy-MM-dd key for any date-like value. */
export function dayKey(d: Date | string | number): string {
  return format(new Date(d), 'yyyy-MM-dd');
}

export function summarize(values: number[]): SeriesSummary {
  const count = values.length;
  if (count === 0) return { count: 0, mean: 0, median: 0, stdDev: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / count;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const variance = count > 1 ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (count - 1) : 0;
  return { count, mean, median, stdDev: Math.sqrt(variance) };
}

/** Percentile rank (0–100) of `value` within `values`. Ties count half. */
export function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 0;
  let below = 0;
  let equal = 0;
  for (const v of values) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return ((below + equal / 2) / values.length) * 100;
}

/**
 * Merge entries that fall on the same local calendar day and sort ascending.
 * Mirrors the consolidation the API applies, but keys by local date.
 */
export function consolidateByDay(entries: DailyPnL[]): Array<{ key: string; date: Date; pnl: number; notes: string; ids: string[] }> {
  const map = new Map<string, { key: string; date: Date; pnl: number; notes: string; ids: string[] }>();
  for (const e of entries) {
    const date = new Date(e.date);
    if (Number.isNaN(date.getTime()) || !Number.isFinite(e.pnl)) continue;
    const key = dayKey(date);
    const existing = map.get(key);
    if (existing) {
      existing.pnl += e.pnl;
      existing.ids.push(e.id);
      if (e.notes) existing.notes = existing.notes ? `${existing.notes}; ${e.notes}` : e.notes;
    } else {
      map.set(key, { key, date, pnl: e.pnl, notes: e.notes ?? '', ids: [e.id] });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

/**
 * Build the enriched day series: equity, drawdown, rolling stats and z-scores.
 *
 * @param entries raw entries (any order, may contain same-day duplicates)
 * @param startingEquity equity before the first entry
 * @param window trailing window for rolling stats (default 20 trading days)
 */
export function enrichDays(entries: DailyPnL[], startingEquity: number, window = 20): EnrichedDay[] {
  const days = consolidateByDay(entries);
  const { mean, stdDev } = summarize(days.map((d) => d.pnl));

  const result: EnrichedDay[] = [];
  let equity = startingEquity;
  let peak = startingEquity;
  let cumulative = 0;

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const equityBefore = equity;
    equity += d.pnl;
    cumulative += d.pnl;
    const isNewHigh = equity > peak;
    peak = Math.max(peak, equity);
    const drawdownPct = peak > 0 ? ((equity - peak) / peak) * 100 : 0;

    const windowStart = Math.max(0, i - window + 1);
    let wins = 0;
    let sum = 0;
    for (let j = windowStart; j <= i; j++) {
      if (days[j].pnl > 0) wins++;
      sum += days[j].pnl;
    }
    const n = i - windowStart + 1;

    result.push({
      key: d.key,
      date: d.date,
      pnl: d.pnl,
      notes: d.notes,
      ids: d.ids,
      equityBefore,
      equity,
      peak,
      drawdownPct: drawdownPct === 0 ? 0 : drawdownPct,
      cumulative,
      returnPct: equityBefore !== 0 ? (d.pnl / Math.abs(equityBefore)) * 100 : 0,
      rollingWinRate: (wins / n) * 100,
      rollingExpectancy: sum / n,
      zScore: stdDev > 0 ? (d.pnl - mean) / stdDev : 0,
      isNewHigh,
      weekday: d.date.getDay(),
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Breakdowns
// ---------------------------------------------------------------------------

export function weekdayStats(days: Pick<EnrichedDay, 'pnl' | 'weekday'>[]): WeekdayStat[] {
  const buckets: WeekdayStat[] = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday, label, count: 0, total: 0, average: 0, winRate: 0, best: 0, worst: 0,
  }));
  const wins = new Array(7).fill(0);
  for (const d of days) {
    const b = buckets[d.weekday];
    if (b.count === 0) {
      b.best = d.pnl;
      b.worst = d.pnl;
    } else {
      b.best = Math.max(b.best, d.pnl);
      b.worst = Math.min(b.worst, d.pnl);
    }
    b.count++;
    b.total += d.pnl;
    if (d.pnl > 0) wins[d.weekday]++;
  }
  for (const b of buckets) {
    b.average = b.count ? b.total / b.count : 0;
    b.winRate = b.count ? (wins[b.weekday] / b.count) * 100 : 0;
  }
  return buckets;
}

/**
 * Histogram of daily P&L. Bins are symmetric around zero so gains and losses
 * never share a bucket (a bin edge always sits at 0).
 */
export function pnlHistogram(values: number[], targetBins = 16): HistogramBin[] {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return [];
  const maxAbs = Math.max(...finite.map(Math.abs));
  if (maxAbs === 0) return [{ from: 0, to: 0, mid: 0, count: finite.length, tone: 'mixed' }];

  const half = Math.max(1, Math.round(targetBins / 2));
  const width = maxAbs / half;
  const bins: HistogramBin[] = [];
  for (let i = -half; i < half; i++) {
    const from = i * width;
    const to = (i + 1) * width;
    bins.push({ from, to, mid: (from + to) / 2, count: 0, tone: to <= 0 ? 'loss' : 'gain' });
  }
  for (const v of finite) {
    if (v === 0) continue; // flat days are not plotted in either side
    let idx = Math.floor(v / width) + half;
    if (v > 0 && v % width === 0) idx -= 1; // upper edge belongs to the lower bin on gain side
    idx = Math.min(bins.length - 1, Math.max(0, idx));
    bins[idx].count++;
  }
  return bins;
}

/** Identify every peak-to-recovery drawdown, deepest first. */
export function drawdownEpisodes(days: EnrichedDay[], startingEquity: number): DrawdownEpisode[] {
  const episodes: DrawdownEpisode[] = [];
  let peak = startingEquity;
  let peakKey: string | null = null;
  let current: (DrawdownEpisode & { startIndex: number; troughIndex: number }) | null = null;

  days.forEach((d, i) => {
    if (d.equity >= peak) {
      if (current) {
        current.recovery = d.key;
        current.recovered = true;
        current.duration = i - current.startIndex + 1;
        episodes.push(current);
        current = null;
      }
      peak = d.equity;
      peakKey = d.key;
      return;
    }
    const depthAbs = peak - d.equity;
    const depthPct = peak > 0 ? (depthAbs / peak) * 100 : 0;
    if (!current) {
      current = {
        start: peakKey ?? d.key,
        trough: d.key,
        recovery: null,
        depthAbs,
        depthPct,
        daysToTrough: 1,
        duration: 1,
        recovered: false,
        startIndex: i,
        troughIndex: i,
      };
    } else if (depthAbs > current.depthAbs) {
      current.trough = d.key;
      current.depthAbs = depthAbs;
      current.depthPct = depthPct;
      current.troughIndex = i;
      current.daysToTrough = i - current.startIndex + 1;
    }
    current.duration = i - current.startIndex + 1;
  });
  if (current) episodes.push(current);

  return episodes
    .map(({ startIndex: _s, troughIndex: _t, ...rest }: DrawdownEpisode & { startIndex?: number; troughIndex?: number }) => rest)
    .sort((a, b) => b.depthPct - a.depthPct);
}

/** Year × month P&L matrix. `capitalByMonth` lets return% use start-of-month equity. */
export function monthlyMatrix(days: EnrichedDay[]): YearRow[] {
  const cells = new Map<string, MonthCell & { wins: number; startEquity: number }>();
  for (const d of days) {
    const year = d.date.getFullYear();
    const month = d.date.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    let c = cells.get(key);
    if (!c) {
      c = { year, month, key, total: 0, days: 0, winRate: 0, returnPct: 0, wins: 0, startEquity: d.equityBefore };
      cells.set(key, c);
    }
    c.total += d.pnl;
    c.days++;
    if (d.pnl > 0) c.wins++;
  }
  const years = new Map<number, YearRow>();
  cells.forEach((c) => {
    c.winRate = c.days ? (c.wins / c.days) * 100 : 0;
    c.returnPct = c.startEquity !== 0 ? (c.total / Math.abs(c.startEquity)) * 100 : 0;
    let row = years.get(c.year);
    if (!row) {
      row = { year: c.year, months: new Array(12).fill(null), total: 0, days: 0 };
      years.set(c.year, row);
    }
    const { wins: _w, startEquity: _e, ...cell } = c;
    row.months[c.month] = cell;
    row.total += c.total;
    row.days += c.days;
  });
  return Array.from(years.values()).sort((a, b) => b.year - a.year);
}

/** Group days by ISO week (Mon start) or calendar month. */
export function groupByPeriod(days: Pick<EnrichedDay, 'date' | 'pnl'>[], period: 'week' | 'month'): PeriodGroup[] {
  const map = new Map<string, PeriodGroup>();
  for (const d of days) {
    const start = period === 'week' ? startOfWeek(d.date, { weekStartsOn: 1 }) : startOfMonth(d.date);
    const key = dayKey(start);
    let g = map.get(key);
    if (!g) {
      g = { key, start, total: 0, days: 0, wins: 0, losses: 0 };
      map.set(key, g);
    }
    g.total += d.pnl;
    g.days++;
    if (d.pnl > 0) g.wins++;
    else if (d.pnl < 0) g.losses++;
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

/** How does the trader do the day after a win vs the day after a loss? */
export function conditionalStats(days: Pick<EnrichedDay, 'pnl'>[]): ConditionalStats {
  let lossN = 0, lossWins = 0, lossSum = 0;
  let winN = 0, winWins = 0, winSum = 0;
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1].pnl;
    const cur = days[i].pnl;
    if (prev < 0) {
      lossN++;
      lossSum += cur;
      if (cur > 0) lossWins++;
    } else if (prev > 0) {
      winN++;
      winSum += cur;
      if (cur > 0) winWins++;
    }
  }
  return {
    afterLossWinRate: lossN ? (lossWins / lossN) * 100 : null,
    afterLossAverage: lossN ? lossSum / lossN : null,
    afterWinWinRate: winN ? (winWins / winN) * 100 : null,
    afterWinAverage: winN ? winSum / winN : null,
    afterLossCount: lossN,
    afterWinCount: winN,
  };
}

/** All consecutive win/loss runs, chronological. Flat days break a run. */
export function streakRuns(days: Pick<EnrichedDay, 'pnl' | 'key'>[]): StreakRun[] {
  const runs: StreakRun[] = [];
  let cur: StreakRun | null = null;
  for (const d of days) {
    const type = d.pnl > 0 ? 'win' : d.pnl < 0 ? 'loss' : null;
    if (!type) {
      if (cur) runs.push(cur);
      cur = null;
      continue;
    }
    if (cur && cur.type === type) {
      cur.length++;
      cur.total += d.pnl;
      cur.end = d.key;
    } else {
      if (cur) runs.push(cur);
      cur = { type, length: 1, total: d.pnl, start: d.key, end: d.key };
    }
  }
  if (cur) runs.push(cur);
  return runs;
}

/** Share of gross profit contributed by the best `n` days (0–100). */
export function profitConcentration(values: number[], n = 3): number {
  const gains = values.filter((v) => v > 0).sort((a, b) => b - a);
  const gross = gains.reduce((s, v) => s + v, 0);
  if (gross === 0) return 0;
  return (gains.slice(0, n).reduce((s, v) => s + v, 0) / gross) * 100;
}

/**
 * Composite 0–100 "system health" score from profit factor, win rate,
 * payoff ratio, drawdown and consistency. Each component maps to 0–1.
 */
export function healthScore(input: {
  profitFactor: number;
  winRate: number;
  payoffRatio: number;
  maxDrawdownPct: number;
  positiveWeeksPct: number;
}): { score: number; components: Record<'edge' | 'accuracy' | 'payoff' | 'risk' | 'consistency', number> } {
  const clamp = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
  const components = {
    edge: clamp((input.profitFactor - 0.5) / 1.5), // PF 0.5 → 0, 2.0 → 1
    accuracy: clamp((input.winRate - 30) / 35), // 30% → 0, 65% → 1
    payoff: clamp((input.payoffRatio - 0.5) / 1.5), // 0.5 → 0, 2.0 → 1
    risk: clamp(1 - input.maxDrawdownPct / 30), // 0% → 1, 30% → 0
    consistency: clamp((input.positiveWeeksPct - 30) / 45), // 30% → 0, 75% → 1
  };
  const weights = { edge: 0.3, accuracy: 0.15, payoff: 0.15, risk: 0.25, consistency: 0.15 };
  const score = Math.round(
    (Object.keys(weights) as (keyof typeof weights)[]).reduce((s, k) => s + components[k] * weights[k], 0) * 100,
  );
  return { score, components };
}
