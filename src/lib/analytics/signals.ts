/**
 * Signals: deterministic, on-device pattern detection.
 *
 * Each rule looks at the enriched day series and, when it finds something
 * statistically meaningful, emits a short, plain-language observation plus a
 * drill-down action the UI can follow. No data leaves the browser.
 */
import {
  conditionalStats, groupByPeriod, profitConcentration, summarize, weekdayStats,
  WEEKDAY_LABELS, type EnrichedDay,
} from './core';
import { tagStats } from './tags';

export type SignalTone = 'positive' | 'negative' | 'warning' | 'info';

export type SignalAction =
  | { type: 'day'; key: string }
  | { type: 'range'; from: string; to: string; label: string }
  | { type: 'weekday'; weekday: number }
  | { type: 'tag'; tag: string };

export interface Signal {
  id: string;
  tone: SignalTone;
  /** 0–100; higher sorts first */
  priority: number;
  title: string;
  detail: string;
  /** Short highlighted figure, e.g. "-₹12.4k" or "38%" */
  metric?: string;
  action?: SignalAction;
}

export interface SignalInput {
  days: EnrichedDay[];
  formatMoney: (v: number) => string;
}

const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function buildSignals({ days, formatMoney }: SignalInput): Signal[] {
  const out: Signal[] = [];
  if (days.length < 3) return out;

  const pnls = days.map((d) => d.pnl);
  const { mean, stdDev } = summarize(pnls);
  const wins = days.filter((d) => d.pnl > 0);
  const losses = days.filter((d) => d.pnl < 0);
  const winRate = (wins.length / days.length) * 100;
  const grossProfit = wins.reduce((s, d) => s + d.pnl, 0);
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, d) => s + d.pnl, 0) / losses.length : 0;
  const last = days[days.length - 1];

  // 1. Drawdown status / new highs ------------------------------------------------
  if (last.drawdownPct < -0.5) {
    const recoverPct = (last.peak / last.equity - 1) * 100;
    out.push({
      id: 'drawdown-status',
      tone: last.drawdownPct < -10 ? 'negative' : 'warning',
      priority: 70 + Math.min(25, Math.abs(last.drawdownPct)),
      title: `You're ${Math.abs(last.drawdownPct).toFixed(1)}% below your equity peak`,
      detail: `A ${recoverPct.toFixed(1)}% gain (${formatMoney(last.peak - last.equity)}) takes you back to a new high.`,
      metric: `${last.drawdownPct.toFixed(1)}%`,
    });
  } else if (last.isNewHigh) {
    out.push({
      id: 'new-high',
      tone: 'positive',
      priority: 65,
      title: 'Equity just closed at a new all-time high',
      detail: `${formatMoney(last.equity)} on ${last.key}. Protect it — this is when oversizing usually creeps in.`,
      metric: 'ATH',
      action: { type: 'day', key: last.key },
    });
  }

  // 2. Recent form vs baseline --------------------------------------------------------
  if (days.length >= 15 && stdDev > 0) {
    const recent = days.slice(-5);
    const recentMean = recent.reduce((s, d) => s + d.pnl, 0) / recent.length;
    const z = (recentMean - mean) / (stdDev / Math.sqrt(recent.length));
    if (Math.abs(z) >= 1.5) {
      const hot = z > 0;
      out.push({
        id: 'recent-form',
        tone: hot ? 'positive' : 'negative',
        priority: 60 + Math.min(30, Math.abs(z) * 8),
        title: hot ? 'Your last 5 sessions are running hot' : 'Your last 5 sessions are well below your norm',
        detail: `Averaging ${formatMoney(recentMean)}/day vs your usual ${formatMoney(mean)} — ${Math.abs(z).toFixed(1)}σ ${hot ? 'above' : 'below'} baseline.`,
        metric: `${z > 0 ? '+' : ''}${z.toFixed(1)}σ`,
        action: { type: 'range', from: recent[0].key, to: last.key, label: 'Last 5 sessions' },
      });
    }
  }

  // 3. Weekday edge ----------------------------------------------------------------
  if (days.length >= 15) {
    const wd = weekdayStats(days).filter((w) => w.count >= 3);
    if (wd.length >= 2) {
      const worst = wd.reduce((a, b) => (b.average < a.average ? b : a));
      const best = wd.reduce((a, b) => (b.average > a.average ? b : a));
      if (worst.average < 0 && worst.average < mean) {
        out.push({
          id: 'weekday-worst',
          tone: 'warning',
          priority: 55 + Math.min(20, Math.abs(worst.average - mean) / (stdDev || 1) * 20),
          title: `${WEEKDAY_FULL[worst.weekday]}s are costing you`,
          detail: `${worst.count} sessions, ${worst.winRate.toFixed(0)}% win rate, ${formatMoney(worst.total)} in total. Consider sizing down or sitting out.`,
          metric: formatMoney(worst.average),
          action: { type: 'weekday', weekday: worst.weekday },
        });
      }
      if (best.average > 0 && best.weekday !== worst.weekday && best.average > mean * 1.25) {
        out.push({
          id: 'weekday-best',
          tone: 'positive',
          priority: 45,
          title: `${WEEKDAY_FULL[best.weekday]} is your strongest day`,
          detail: `Averaging ${formatMoney(best.average)} across ${best.count} sessions with a ${best.winRate.toFixed(0)}% hit rate.`,
          metric: WEEKDAY_LABELS[best.weekday],
          action: { type: 'weekday', weekday: best.weekday },
        });
      }
    }
  }

  // 4. Tilt: what happens after a loss? --------------------------------------------
  const cond = conditionalStats(days);
  if (cond.afterLossWinRate !== null && cond.afterLossCount >= 5) {
    const gap = cond.afterLossWinRate - winRate;
    if (gap <= -10) {
      out.push({
        id: 'tilt',
        tone: 'negative',
        priority: 72,
        title: 'Losses tend to follow losses',
        detail: `The day after a red day you win only ${cond.afterLossWinRate.toFixed(0)}% of the time (vs ${winRate.toFixed(0)}% overall). A post-loss cool-down rule could help.`,
        metric: `${cond.afterLossWinRate.toFixed(0)}%`,
      });
    } else if (gap >= 10) {
      out.push({
        id: 'resilience',
        tone: 'positive',
        priority: 40,
        title: 'You bounce back well after red days',
        detail: `Win rate after a loss is ${cond.afterLossWinRate.toFixed(0)}% — higher than your ${winRate.toFixed(0)}% baseline.`,
        metric: `${cond.afterLossWinRate.toFixed(0)}%`,
      });
    }
  }

  // 5. Outlier loss ------------------------------------------------------------------
  if (losses.length >= 3 && avgLoss < 0) {
    const worst = losses.reduce((a, b) => (b.pnl < a.pnl ? b : a));
    const multiple = worst.pnl / avgLoss;
    if (multiple >= 2.5) {
      const share = grossProfit > 0 ? (Math.abs(worst.pnl) / grossProfit) * 100 : 0;
      out.push({
        id: 'outlier-loss',
        tone: 'negative',
        priority: 68 + Math.min(20, multiple * 2),
        title: `One session cost ${multiple.toFixed(1)}× your average loss`,
        detail: share > 0
          ? `${worst.key} wiped out ${share.toFixed(0)}% of your gross profit for the period. Review what broke down.`
          : `${worst.key} is your outlier loss for the period. Review what broke down.`,
        metric: formatMoney(worst.pnl),
        action: { type: 'day', key: worst.key },
      });
    }
  }

  // 6. Profit concentration -------------------------------------------------------
  if (wins.length >= 8) {
    const conc = profitConcentration(pnls, 3);
    if (conc >= 45) {
      out.push({
        id: 'concentration',
        tone: 'info',
        priority: 42,
        title: 'Your profits lean on a few big days',
        detail: `Your top 3 sessions make up ${conc.toFixed(0)}% of gross profit. Results may swing more than the win rate suggests.`,
        metric: `${conc.toFixed(0)}%`,
      });
    }
  }

  // 7. Edge margin: break-even win rate -----------------------------------------
  if (wins.length >= 3 && losses.length >= 3) {
    const payoff = avgWin / Math.abs(avgLoss);
    const breakEven = 100 / (1 + payoff);
    const margin = winRate - breakEven;
    out.push({
      id: 'edge-margin',
      tone: margin >= 5 ? 'positive' : margin >= 0 ? 'info' : 'negative',
      priority: margin < 0 ? 66 : 35,
      title: margin >= 0
        ? `Your edge clears break-even by ${margin.toFixed(1)} pts`
        : `You're ${Math.abs(margin).toFixed(1)} pts below break-even`,
      detail: `With a ${payoff.toFixed(2)}:1 payoff you need ${breakEven.toFixed(0)}% winners to break even; you're hitting ${winRate.toFixed(0)}%.`,
      metric: `${payoff.toFixed(2)}R`,
    });
  }

  // 8. Streak ---------------------------------------------------------------------
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const p = days[i].pnl;
    if (p === 0) break;
    if (streak === 0) streak = p > 0 ? 1 : -1;
    else if ((streak > 0 && p > 0) || (streak < 0 && p < 0)) streak += streak > 0 ? 1 : -1;
    else break;
  }
  if (Math.abs(streak) >= 3) {
    const start = days[days.length - Math.abs(streak)];
    out.push({
      id: 'streak',
      tone: streak > 0 ? 'positive' : 'negative',
      priority: 50 + Math.abs(streak) * 3,
      title: streak > 0 ? `${streak} green sessions in a row` : `${Math.abs(streak)} red sessions in a row`,
      detail: streak > 0
        ? 'Momentum is with you. Keep size consistent rather than pressing.'
        : 'Consider cutting size until you log a green day.',
      metric: `${streak > 0 ? '+' : ''}${streak}`,
      action: { type: 'range', from: start.key, to: last.key, label: 'Current streak' },
    });
  }

  // 9. Consistency by week ------------------------------------------------------
  const weeks = groupByPeriod(days, 'week');
  if (weeks.length >= 6) {
    const green = weeks.filter((w) => w.total > 0).length;
    const pct = (green / weeks.length) * 100;
    out.push({
      id: 'weekly-consistency',
      tone: pct >= 60 ? 'positive' : pct >= 45 ? 'info' : 'warning',
      priority: 30,
      title: `${green} of ${weeks.length} weeks closed green`,
      detail: pct >= 60 ? 'Solid week-over-week consistency.' : 'Weekly results are choppy — smoothing losing weeks matters more than bigger winners.',
      metric: `${pct.toFixed(0)}%`,
    });
  }

  // 10. Behaviour tags --------------------------------------------------------------
  const tags = tagStats(days).filter((t) => t.count >= 2);
  const costly = tags.filter((t) => !t.good && t.average < 0).sort((a, b) => a.total - b.total)[0];
  if (costly) {
    out.push({
      id: `tag-${costly.id}`,
      tone: 'negative',
      priority: 64,
      title: `"${costly.label}" days average ${formatMoney(costly.average)}`,
      detail: `${costly.count} tagged sessions, ${formatMoney(costly.total)} in total. This is a behaviour leak you can plug.`,
      metric: formatMoney(costly.total),
      action: { type: 'tag', tag: costly.id },
    });
  }
  const disciplined = tags.find((t) => t.good);
  if (disciplined && disciplined.average > mean) {
    out.push({
      id: 'tag-discipline',
      tone: 'positive',
      priority: 38,
      title: 'Following your rules pays',
      detail: `Rule-followed sessions average ${formatMoney(disciplined.average)} vs ${formatMoney(mean)} overall.`,
      metric: `${disciplined.winRate.toFixed(0)}%`,
      action: { type: 'tag', tag: disciplined.id },
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}

/**
 * Plain-language read of a single session in the context of the period.
 */
export function describeDay(day: EnrichedDay, all: EnrichedDay[], formatMoney: (v: number) => string): string[] {
  const lines: string[] = [];
  const wins = all.filter((d) => d.pnl > 0);
  const losses = all.filter((d) => d.pnl < 0);
  const avgWin = wins.length ? wins.reduce((s, d) => s + d.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, d) => s + d.pnl, 0) / losses.length : 0;

  if (day.pnl > 0 && avgWin > 0) {
    const m = day.pnl / avgWin;
    lines.push(m >= 1.5 ? `A standout win — ${m.toFixed(1)}× your average winning day.` : m < 0.6 ? `A small win, ${(m * 100).toFixed(0)}% of your average winner.` : 'A typical winning session for you.');
  } else if (day.pnl < 0 && avgLoss < 0) {
    const m = day.pnl / avgLoss;
    lines.push(m >= 1.5 ? `An outsized loss — ${m.toFixed(1)}× your average losing day.` : m < 0.6 ? 'A controlled loss, smaller than usual.' : 'A typical losing session for you.');
  } else if (day.pnl === 0) {
    lines.push('A flat session.');
  }

  if (Math.abs(day.zScore) >= 2) {
    lines.push(`Statistically unusual: ${Math.abs(day.zScore).toFixed(1)}σ from your mean day.`);
  }
  if (day.isNewHigh) lines.push(`Closed at a new equity high of ${formatMoney(day.equity)}.`);
  else if (day.drawdownPct < -1) lines.push(`Ended ${Math.abs(day.drawdownPct).toFixed(1)}% below the running peak.`);

  const idx = all.findIndex((d) => d.key === day.key);
  if (idx > 0) {
    const prev = all[idx - 1];
    if (prev.pnl < 0 && day.pnl < 0) lines.push('Followed a losing session — watch for tilt.');
    if (prev.pnl < 0 && day.pnl > 0) lines.push('A recovery day after a loss.');
  }
  return lines;
}
