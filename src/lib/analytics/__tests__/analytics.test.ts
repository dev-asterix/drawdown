import {
  enrichDays, consolidateByDay, summarize, percentileRank, weekdayStats, pnlHistogram,
  drawdownEpisodes, monthlyMatrix, conditionalStats, streakRuns, profitConcentration, healthScore,
  groupByPeriod,
} from '../core';
import { filterByRange, startingEquityFor, previousRange, describeRange, normalizeRange } from '../range';
import { simulateDailyStop, suggestStop } from '../simulator';
import { hasTag, toggleTag, tagsIn, stripTags, tagStats } from '../tags';
import { buildSignals, describeDay } from '../signals';
import type { DailyPnL } from '@/types/trading';

const d = (date: string, pnl: number, notes?: string, id = `${date}-${pnl}`): DailyPnL => ({
  id, date: new Date(`${date}T10:00:00`), pnl, notes,
});

const money = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v))}`;

describe('consolidateByDay', () => {
  it('merges same-day entries and sorts ascending', () => {
    const out = consolidateByDay([d('2025-01-03', 50), d('2025-01-02', 10, 'a'), d('2025-01-02', -4, 'b', 'x')]);
    expect(out.map((o) => o.key)).toEqual(['2025-01-02', '2025-01-03']);
    expect(out[0].pnl).toBe(6);
    expect(out[0].notes).toBe('a; b');
    expect(out[0].ids).toHaveLength(2);
  });

  it('drops invalid dates and non-finite pnl', () => {
    const bad = { id: 'z', date: new Date('nope'), pnl: 5 } as DailyPnL;
    const nan = { id: 'n', date: new Date(), pnl: NaN } as DailyPnL;
    expect(consolidateByDay([bad, nan])).toHaveLength(0);
  });
});

describe('enrichDays', () => {
  const entries = [d('2025-01-01', 100), d('2025-01-02', -50), d('2025-01-03', -100), d('2025-01-06', 200)];
  const days = enrichDays(entries, 1000, 2);

  it('tracks equity, peak and drawdown', () => {
    expect(days.map((x) => x.equity)).toEqual([1100, 1050, 950, 1150]);
    expect(days.map((x) => x.peak)).toEqual([1100, 1100, 1100, 1150]);
    expect(days[2].drawdownPct).toBeCloseTo(-13.636, 2);
    expect(days[3].drawdownPct).toBe(0);
    expect(days[3].isNewHigh).toBe(true);
    expect(days[1].isNewHigh).toBe(false);
  });

  it('computes rolling stats over the window', () => {
    expect(days[1].rollingWinRate).toBe(50);
    expect(days[2].rollingWinRate).toBe(0);
    expect(days[3].rollingExpectancy).toBe(50);
  });

  it('records equityBefore and return %', () => {
    expect(days[1].equityBefore).toBe(1100);
    expect(days[1].returnPct).toBeCloseTo(-4.545, 2);
  });
});

describe('summary helpers', () => {
  it('summarize computes mean/median/sample stdev', () => {
    const s = summarize([1, 2, 3, 4]);
    expect(s.mean).toBe(2.5);
    expect(s.median).toBe(2.5);
    expect(s.stdDev).toBeCloseTo(1.291, 3);
    expect(summarize([])).toEqual({ count: 0, mean: 0, median: 0, stdDev: 0 });
  });

  it('percentileRank counts ties as half', () => {
    expect(percentileRank([1, 2, 3, 4], 3)).toBe(62.5);
    expect(percentileRank([], 3)).toBe(0);
  });
});

describe('weekdayStats', () => {
  it('buckets by weekday', () => {
    // 2025-01-06 is a Monday
    const days = enrichDays([d('2025-01-06', 100), d('2025-01-13', -50), d('2025-01-07', 30)], 0);
    const w = weekdayStats(days);
    expect(w[1].count).toBe(2);
    expect(w[1].average).toBe(25);
    expect(w[1].winRate).toBe(50);
    expect(w[1].best).toBe(100);
    expect(w[1].worst).toBe(-50);
    expect(w[2].total).toBe(30);
  });
});

describe('pnlHistogram', () => {
  it('never mixes gains and losses in a bin and counts every non-zero value', () => {
    const values = [-100, -40, -1, 5, 50, 100, 0];
    const bins = pnlHistogram(values, 4);
    const total = bins.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(6);
    bins.forEach((b) => {
      if (b.tone === 'loss') expect(b.to).toBeLessThanOrEqual(0);
      if (b.tone === 'gain') expect(b.from).toBeGreaterThanOrEqual(0);
    });
  });

  it('handles empty and all-zero input', () => {
    expect(pnlHistogram([])).toEqual([]);
    expect(pnlHistogram([0, 0])[0].count).toBe(2);
  });
});

describe('drawdownEpisodes', () => {
  it('finds recovered and ongoing episodes, deepest first', () => {
    const entries = [
      d('2025-01-01', 100), d('2025-01-02', -200), d('2025-01-03', 300), // dd from 1100 to 900, recovered
      d('2025-01-06', -50), d('2025-01-07', -20), // ongoing
    ];
    const days = enrichDays(entries, 1000);
    const eps = drawdownEpisodes(days, 1000);
    expect(eps).toHaveLength(2);
    expect(eps[0].recovered).toBe(true);
    expect(eps[0].start).toBe('2025-01-01');
    expect(eps[0].trough).toBe('2025-01-02');
    expect(eps[0].recovery).toBe('2025-01-03');
    expect(eps[0].depthAbs).toBe(200);
    expect(eps[1].recovered).toBe(false);
    expect(eps[1].depthAbs).toBe(70);
    expect(eps[1].duration).toBe(2);
  });
});

describe('monthlyMatrix', () => {
  it('groups by year and month', () => {
    const days = enrichDays([d('2024-12-31', 10), d('2025-01-02', 20), d('2025-01-03', -5)], 100);
    const rows = monthlyMatrix(days);
    expect(rows.map((r) => r.year)).toEqual([2025, 2024]);
    expect(rows[0].months[0]?.total).toBe(15);
    expect(rows[0].months[0]?.winRate).toBe(50);
    expect(rows[0].months[0]?.returnPct).toBeCloseTo(13.636, 2);
    expect(rows[1].months[11]?.days).toBe(1);
    expect(rows[0].months[1]).toBeNull();
  });
});

describe('groupByPeriod', () => {
  it('groups by ISO week', () => {
    const days = enrichDays([d('2025-01-06', 10), d('2025-01-10', -5), d('2025-01-13', 1)], 0);
    const g = groupByPeriod(days, 'week');
    expect(g).toHaveLength(2);
    expect(g[0].total).toBe(5);
    expect(g[0].wins).toBe(1);
    expect(g[0].losses).toBe(1);
  });
});

describe('conditional stats and streaks', () => {
  const days = enrichDays([
    d('2025-01-01', -10), d('2025-01-02', -10), d('2025-01-03', 10), d('2025-01-06', 10), d('2025-01-07', 0), d('2025-01-08', -5),
  ], 0);

  it('measures the day after a loss / win', () => {
    const c = conditionalStats(days);
    expect(c.afterLossCount).toBe(2);
    expect(c.afterLossWinRate).toBe(50);
    expect(c.afterWinCount).toBe(2);
    expect(c.afterWinAverage).toBe(5);
  });

  it('lists streak runs, flat days break runs', () => {
    const runs = streakRuns(days);
    expect(runs.map((r) => `${r.type}${r.length}`)).toEqual(['loss2', 'win2', 'loss1']);
  });
});

describe('profitConcentration & healthScore', () => {
  it('computes share of gross profit from top days', () => {
    expect(profitConcentration([50, 30, 10, 10, -20], 1)).toBe(50);
    expect(profitConcentration([-1])).toBe(0);
  });

  it('healthScore is bounded and monotone in profit factor', () => {
    const base = { winRate: 50, payoffRatio: 1.2, maxDrawdownPct: 10, positiveWeeksPct: 55 };
    const low = healthScore({ ...base, profitFactor: 0.8 }).score;
    const high = healthScore({ ...base, profitFactor: 2.2 }).score;
    expect(high).toBeGreaterThan(low);
    expect(healthScore({ profitFactor: Infinity, winRate: 100, payoffRatio: Infinity, maxDrawdownPct: 0, positiveWeeksPct: 100 }).score).toBe(100);
    expect(healthScore({ profitFactor: 0, winRate: 0, payoffRatio: 0, maxDrawdownPct: 90, positiveWeeksPct: 0 }).score).toBe(0);
  });
});

describe('range helpers', () => {
  const entries = [d('2025-01-01', 10), d('2025-01-15', 20), d('2025-02-01', 30)];
  const jan = { from: new Date('2025-01-10T00:00:00'), to: new Date('2025-01-31T00:00:00') };

  it('filters inclusively by whole days', () => {
    expect(filterByRange(entries, jan)).toHaveLength(1);
    expect(filterByRange(entries, undefined)).toHaveLength(3);
    expect(filterByRange(entries, { from: new Date('2025-02-01T23:00:00'), to: new Date('2025-02-01T00:00:00') })).toHaveLength(1);
  });

  it('starting equity includes P&L before the range', () => {
    expect(startingEquityFor(entries, 100, jan)).toBe(110);
    expect(startingEquityFor(entries, 100, undefined)).toBe(100);
  });

  it('previousRange is the same length immediately before', () => {
    const p = previousRange(jan)!;
    const n = normalizeRange(jan)!;
    expect(p.to.getTime()).toBeLessThan(n.from.getTime());
    expect(Math.round((p.to.getTime() - p.from.getTime()) / 864e5)).toBe(Math.round((n.to.getTime() - n.from.getTime()) / 864e5));
  });

  it('describes ranges', () => {
    expect(describeRange(undefined)).toBe('All time');
    expect(describeRange({ from: new Date('2025-03-01T00:00:00'), to: new Date('2025-03-31T00:00:00') })).toBe('March 2025');
  });
});

describe('simulateDailyStop', () => {
  it('caps losses at the stop and reports savings', () => {
    const r = simulateDailyStop([{ key: 'a', pnl: 100 }, { key: 'b', pnl: -500 }, { key: 'c', pnl: -50 }], 200);
    expect(r.actualTotal).toBe(-450);
    expect(r.simulatedTotal).toBe(-150);
    expect(r.saved).toBe(300);
    expect(r.daysCapped).toBe(1);
    expect(r.worstDay).toBe(-200);
    expect(r.series[2]).toEqual({ key: 'c', actual: -450, simulated: -150 });
  });

  it('a zero stop leaves results unchanged', () => {
    expect(simulateDailyStop([{ key: 'a', pnl: -5 }], 0).saved).toBe(0);
  });

  it('suggests a rounded median loss', () => {
    expect(suggestStop([-1234, -5000, -800, 300])).toBe(1200);
    expect(suggestStop([5])).toBe(1000);
  });
});

describe('tags', () => {
  it('detects and toggles tags inside notes', () => {
    expect(hasTag('Felt revenge after open', 'revenge')).toBe(true);
    expect(hasTag('rule-followed', 'rule-followed')).toBe(true);
    expect(hasTag('rules followed', 'rule-followed')).toBe(false);
    expect(toggleTag('good day', 'fomo')).toBe('good day fomo');
    expect(toggleTag('good fomo day', 'fomo')).toBe('good day');
    expect(toggleTag(undefined, 'oversize')).toBe('oversize');
    expect(tagsIn('revenge oversize')).toEqual(['revenge', 'oversize']);
    expect(stripTags('nice revenge entry')).toBe('nice entry');
  });

  it('aggregates P&L per tag', () => {
    const stats = tagStats([{ pnl: -10, notes: 'revenge' }, { pnl: -30, notes: 'revenge fomo' }, { pnl: 5 }]);
    const rev = stats.find((s) => s.id === 'revenge')!;
    expect(rev.count).toBe(2);
    expect(rev.average).toBe(-20);
    expect(stats.find((s) => s.id === 'oversize')).toBeUndefined();
  });
});

describe('signals', () => {
  it('returns nothing for tiny samples', () => {
    expect(buildSignals({ days: enrichDays([d('2025-01-01', 1)], 0), formatMoney: money })).toEqual([]);
  });

  it('flags outlier losses with a drill-down to the day, sorted by priority', () => {
    const entries: DailyPnL[] = [];
    const start = new Date('2025-01-06T10:00:00');
    for (let i = 0; i < 30; i++) {
      const date = new Date(start.getTime() + i * 864e5);
      const pnl = i === 20 ? -2000 : i % 3 === 0 ? -100 : 150;
      entries.push({ id: String(i), date, pnl });
    }
    const days = enrichDays(entries, 10000);
    const signals = buildSignals({ days, formatMoney: money });
    const outlier = signals.find((s) => s.id === 'outlier-loss');
    expect(outlier).toBeDefined();
    expect(outlier!.action).toEqual({ type: 'day', key: days[20].key });
    for (let i = 1; i < signals.length; i++) {
      expect(signals[i - 1].priority).toBeGreaterThanOrEqual(signals[i].priority);
    }
  });

  it('describes a day relative to the period', () => {
    const days = enrichDays([d('2025-01-01', 100), d('2025-01-02', -100), d('2025-01-03', -400), d('2025-01-06', 100)], 1000);
    const lines = describeDay(days[2], days, money);
    expect(lines.some((l) => l.includes('outsized loss'))).toBe(true);
    expect(lines.some((l) => l.includes('Followed a losing session'))).toBe(true);
  });
});
