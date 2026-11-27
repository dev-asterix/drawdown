import {
  startOfDay, endOfDay, subDays, subMonths, subYears, startOfYear, startOfWeek, endOfWeek,
  subWeeks, startOfMonth, endOfMonth, differenceInCalendarDays, format,
} from 'date-fns';
import type { DailyPnL } from '@/types/trading';

export interface Range {
  from: Date;
  to: Date;
}

export type RangePresetId =
  | 'today' | 'yesterday' | 'this-week' | 'last-week' | 'this-month' | 'last-month'
  | '1w' | '1m' | '3m' | 'ytd' | '1y' | 'all';

export interface RangePreset {
  id: RangePresetId;
  label: string;
  short?: string;
  resolve: (now: Date) => Range | undefined;
}

export const RANGE_PRESETS: RangePreset[] = [
  { id: '1w', label: 'Last 7 days', short: '1W', resolve: (n) => ({ from: startOfDay(subDays(n, 6)), to: endOfDay(n) }) },
  { id: '1m', label: 'Last 30 days', short: '1M', resolve: (n) => ({ from: startOfDay(subMonths(n, 1)), to: endOfDay(n) }) },
  { id: '3m', label: 'Last 3 months', short: '3M', resolve: (n) => ({ from: startOfDay(subMonths(n, 3)), to: endOfDay(n) }) },
  { id: 'ytd', label: 'Year to date', short: 'YTD', resolve: (n) => ({ from: startOfYear(n), to: endOfDay(n) }) },
  { id: '1y', label: 'Last 12 months', short: '1Y', resolve: (n) => ({ from: startOfDay(subYears(n, 1)), to: endOfDay(n) }) },
  { id: 'all', label: 'All time', short: 'All', resolve: () => undefined },
  { id: 'today', label: 'Today', resolve: (n) => ({ from: startOfDay(n), to: endOfDay(n) }) },
  { id: 'yesterday', label: 'Yesterday', resolve: (n) => ({ from: startOfDay(subDays(n, 1)), to: endOfDay(subDays(n, 1)) }) },
  { id: 'this-week', label: 'This week', resolve: (n) => ({ from: startOfWeek(n, { weekStartsOn: 1 }), to: endOfDay(n) }) },
  {
    id: 'last-week', label: 'Last week',
    resolve: (n) => {
      const w = subWeeks(n, 1);
      return { from: startOfWeek(w, { weekStartsOn: 1 }), to: endOfWeek(w, { weekStartsOn: 1 }) };
    },
  },
  { id: 'this-month', label: 'This month', resolve: (n) => ({ from: startOfMonth(n), to: endOfDay(n) }) },
  {
    id: 'last-month', label: 'Last month',
    resolve: (n) => {
      const m = subMonths(n, 1);
      return { from: startOfMonth(m), to: endOfMonth(m) };
    },
  },
];

/** Normalise a range so it spans whole local days. */
export function normalizeRange(range: Range | undefined): Range | undefined {
  if (!range) return undefined;
  return { from: startOfDay(range.from), to: endOfDay(range.to) };
}

export function inRange(date: Date | string, range: Range | undefined): boolean {
  if (!range) return true;
  const t = new Date(date).getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}

export function filterByRange<T extends Pick<DailyPnL, 'date'>>(entries: T[], range: Range | undefined): T[] {
  const r = normalizeRange(range);
  if (!r) return entries;
  return entries.filter((e) => inRange(e.date, r));
}

/** Equity at the start of `range`: base capital plus all P&L booked before it. */
export function startingEquityFor(entries: Pick<DailyPnL, 'date' | 'pnl'>[], baseCapital: number, range: Range | undefined): number {
  const r = normalizeRange(range);
  if (!r) return baseCapital;
  const before = entries.reduce((s, e) => (new Date(e.date).getTime() < r.from.getTime() ? s + e.pnl : s), 0);
  return baseCapital + before;
}

/** The equally long window immediately before `range`. */
export function previousRange(range: Range | undefined): Range | undefined {
  const r = normalizeRange(range);
  if (!r) return undefined;
  const span = differenceInCalendarDays(r.to, r.from) + 1;
  const to = endOfDay(subDays(r.from, 1));
  const from = startOfDay(subDays(r.from, span));
  return { from, to };
}

/** Human label for a range, e.g. "Nov 2025", "Mar 3 – Apr 2, 2025" or "All time". */
export function describeRange(range: Range | undefined): string {
  const r = normalizeRange(range);
  if (!r) return 'All time';
  const sameDay = format(r.from, 'yyyy-MM-dd') === format(r.to, 'yyyy-MM-dd');
  if (sameDay) return format(r.from, 'EEE, MMM d, yyyy');
  const wholeMonth = format(r.from, 'yyyy-MM-dd') === format(startOfMonth(r.from), 'yyyy-MM-dd')
    && format(r.to, 'yyyy-MM-dd') === format(endOfMonth(r.from), 'yyyy-MM-dd');
  if (wholeMonth) return format(r.from, 'MMMM yyyy');
  const sameYear = r.from.getFullYear() === r.to.getFullYear();
  return sameYear
    ? `${format(r.from, 'MMM d')} – ${format(r.to, 'MMM d, yyyy')}`
    : `${format(r.from, 'MMM d, yyyy')} – ${format(r.to, 'MMM d, yyyy')}`;
}

/** Which preset (if any) produces exactly this range today. */
export function matchPreset(range: Range | undefined, now = new Date()): RangePresetId | null {
  const r = normalizeRange(range);
  for (const p of RANGE_PRESETS) {
    const pr = normalizeRange(p.resolve(now));
    if (!r && !pr) return p.id;
    if (r && pr && r.from.getTime() === pr.from.getTime() && r.to.getTime() === pr.to.getTime()) return p.id;
  }
  return null;
}
