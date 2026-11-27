import { subDays, isWeekend, startOfDay } from 'date-fns';
import type { DailyPnL } from '@/types/trading';

/** Small deterministic PRNG (mulberry32) so the demo looks the same on every load. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOTES_WIN = ['Clean breakout, followed plan', 'Patient entries, sized right', 'Trend day, held winners', 'Took profits at levels'];
const NOTES_LOSS = ['Chopped up in the open', 'Stopped out twice', 'Fought the trend', 'News spike against me'];

export const DEMO_CAPITAL = 500000;

/**
 * ~10 months of weekday sessions with a realistic edge: ~54% win rate, winners
 * slightly larger than losers, a mid-period drawdown, weak Mondays and a few
 * tagged behaviour days.
 */
export function generateDemoEntries(today = new Date(), sessions = 210): DailyPnL[] {
  const rand = rng(42);
  const gauss = () => {
    const u = 1 - rand();
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const days: Date[] = [];
  let cursor = startOfDay(today);
  while (days.length < sessions) {
    if (!isWeekend(cursor) && rand() > 0.06) days.push(new Date(cursor.getTime() + 10 * 3600 * 1000));
    cursor = subDays(cursor, 1);
  }
  days.reverse();

  return days.map((date, i) => {
    const phase = i / sessions;
    // A rough patch roughly 40–55% of the way through
    const regime = phase > 0.42 && phase < 0.55 ? -0.3 : 0.3;
    const monday = date.getDay() === 1 ? -0.3 : 0;
    const friday = date.getDay() === 4 ? 0.2 : 0;
    const z = gauss() + regime + monday + friday;
    let pnl = Math.round(z * 5600 + (z > 0 ? 1500 : -150));

    let notes: string | undefined;
    const r = rand();
    if (pnl < -9000 && r < 0.55) {
      notes = `${NOTES_LOSS[Math.floor(rand() * NOTES_LOSS.length)]} revenge`;
      pnl = Math.round(pnl * 1.2);
    } else if (pnl < 0 && r < 0.12) {
      notes = `${NOTES_LOSS[Math.floor(rand() * NOTES_LOSS.length)]} oversize`;
    } else if (pnl > 0 && r < 0.22) {
      notes = `${NOTES_WIN[Math.floor(rand() * NOTES_WIN.length)]} rule-followed`;
    } else if (r < 0.05) {
      notes = 'Entered late, chased the move fomo';
    }

    return { id: `demo-${i}`, date, pnl, notes };
  });
}
