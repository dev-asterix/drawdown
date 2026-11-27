/**
 * Daily stop-loss simulator.
 *
 * Replays a set of trading days as if every losing day had been cut at a
 * fixed maximum loss. This is an approximation: it assumes the stop would have
 * filled exactly at the limit and that the day's later trades (which might
 * have recovered the loss) would not have happened.
 */
export interface SimulationDay {
  key: string;
  pnl: number;
}

export interface SimulationResult {
  actualTotal: number;
  simulatedTotal: number;
  /** simulatedTotal - actualTotal (≥ 0 since stops only cap losses) */
  saved: number;
  /** Days where the stop would have triggered */
  daysCapped: number;
  /** Worst single day after the stop */
  worstDay: number;
  /** Cumulative curves for plotting */
  series: Array<{ key: string; actual: number; simulated: number }>;
}

export function simulateDailyStop(days: SimulationDay[], stop: number): SimulationResult {
  const limit = Math.abs(stop);
  let actual = 0;
  let simulated = 0;
  let daysCapped = 0;
  let worstDay = 0;
  const series: SimulationResult['series'] = [];

  for (const d of days) {
    const capped = limit > 0 && d.pnl < -limit ? -limit : d.pnl;
    if (capped !== d.pnl) daysCapped++;
    actual += d.pnl;
    simulated += capped;
    worstDay = Math.min(worstDay, capped);
    series.push({ key: d.key, actual, simulated });
  }

  return {
    actualTotal: actual,
    simulatedTotal: simulated,
    saved: simulated - actual,
    daysCapped,
    worstDay,
    series,
  };
}

/**
 * A sensible default stop: the trader's median losing day, rounded to a
 * "nice" number, so the first thing they see is meaningful.
 */
export function suggestStop(values: number[]): number {
  const losses = values.filter((v) => v < 0).map(Math.abs).sort((a, b) => a - b);
  if (losses.length === 0) return 1000;
  const median = losses[Math.floor(losses.length / 2)];
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(median)) - 1);
  return Math.max(magnitude, Math.round(median / magnitude) * magnitude);
}
