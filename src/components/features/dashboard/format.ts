'use client';

import { useCallback } from 'react';
import { useSettings } from '@/hooks/use-settings';
import { formatCurrency, formatCurrencyShort } from '@/lib/utils/format-settings';

/** Currency formatters bound to the user's settings. */
export function useMoney() {
  const { settings } = useSettings();
  const full = useCallback((v: number) => formatCurrency(v, settings), [settings]);
  const short = useCallback((v: number) => formatCurrencyShort(v, settings), [settings]);
  const signed = useCallback((v: number) => `${v > 0 ? '+' : ''}${formatCurrencyShort(v, settings)}`, [settings]);
  const signedFull = useCallback((v: number) => `${v > 0 ? '+' : ''}${formatCurrency(v, settings)}`, [settings]);
  return { full, short, signed, signedFull, settings };
}

export const pct = (v: number, digits = 1) => `${Number.isFinite(v) ? v.toFixed(digits) : '∞'}%`;
export const signedPct = (v: number, digits = 1) => `${v > 0 ? '+' : ''}${pct(v, digits)}`;
export const ratio = (v: number, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : '∞');

export function toneClass(v: number) {
  return v > 0 ? 'text-positive' : v < 0 ? 'text-negative' : 'text-muted-foreground';
}
