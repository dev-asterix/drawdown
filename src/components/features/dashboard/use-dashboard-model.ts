'use client';

import { useMemo } from 'react';
import type { DailyPnL, PortfolioStats } from '@/types/trading';
import { calculatePortfolioStats } from '@/lib/utils/calculate-stats';
import {
  enrichDays, groupByPeriod, healthScore, type EnrichedDay,
} from '@/lib/analytics/core';
import { filterByRange, previousRange, startingEquityFor, type Range } from '@/lib/analytics/range';

export interface DashboardModel {
  /** Raw entries inside the range */
  rangeEntries: DailyPnL[];
  /** Consolidated, enriched days inside the range (range-local peak) */
  days: EnrichedDay[];
  /** Consolidated, enriched days for all time (true equity) */
  allDays: EnrichedDay[];
  startingEquity: number;
  stats: PortfolioStats;
  previousStats: PortfolioStats | null;
  globalStats: PortfolioStats;
  health: ReturnType<typeof healthScore>;
  payoffRatio: number;
  positiveWeeksPct: number;
}

export function useDashboardModel(entries: DailyPnL[], baseCapital: number, range: Range | undefined): DashboardModel {
  return useMemo(() => {
    const rangeEntries = filterByRange(entries, range);
    const startingEquity = startingEquityFor(entries, baseCapital, range);
    const stats = calculatePortfolioStats(rangeEntries, startingEquity);
    const globalStats = calculatePortfolioStats(entries, baseCapital);

    const prev = previousRange(range);
    let previousStats: PortfolioStats | null = null;
    if (prev) {
      const prevEntries = filterByRange(entries, prev);
      if (prevEntries.length >= 2) {
        previousStats = calculatePortfolioStats(prevEntries, startingEquityFor(entries, baseCapital, prev));
      }
    }

    const days = enrichDays(rangeEntries, startingEquity);
    const allDays = enrichDays(entries, baseCapital);

    const weeks = groupByPeriod(days, 'week');
    const positiveWeeksPct = weeks.length ? (weeks.filter((w) => w.total > 0).length / weeks.length) * 100 : 0;
    const payoffRatio = stats.averageLoss !== 0 ? stats.averageProfit / Math.abs(stats.averageLoss) : stats.averageProfit > 0 ? Infinity : 0;

    const health = healthScore({
      profitFactor: stats.profitFactor,
      winRate: stats.winRate,
      payoffRatio,
      maxDrawdownPct: stats.maxDrawdown,
      positiveWeeksPct,
    });

    return { rangeEntries, days, allDays, startingEquity, stats, previousStats, globalStats, health, payoffRatio, positiveWeeksPct };
  }, [entries, baseCapital, range]);
}
