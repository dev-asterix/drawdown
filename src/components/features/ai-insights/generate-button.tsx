'use client';

import { Loader2, LineChart, ShieldAlert, Shapes } from 'lucide-react';
import type { InsightType } from '@/lib/ai/types';
import { cn } from '@/lib/utils/utils';

const META: Record<InsightType, { label: string; description: string; Icon: typeof LineChart }> = {
  'performance-summary': { label: 'Performance Summary', description: 'What drove results this period', Icon: LineChart },
  'risk-review': { label: 'Risk Review', description: 'Drawdowns, streaks and exposure', Icon: ShieldAlert },
  'trade-pattern-analysis': { label: 'Trade Patterns', description: 'Habits hidden in your notes', Icon: Shapes },
};

interface GenerateButtonProps {
  insightType: InsightType;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

export function GenerateButton({ insightType, disabled, loading, onClick }: GenerateButtonProps) {
  const { label, description, Icon } = META[insightType];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl border border-border/80 bg-background/40 p-2.5 text-left outline-none transition-all',
        'hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
