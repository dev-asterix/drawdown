'use client';

import { useState } from 'react';
import { PortfolioStats } from '@/types/trading';
import { cn } from '@/lib/utils/utils';
import { Brain, Crosshair, ShieldAlert } from 'lucide-react';
import { CustomTabs, type TabItem } from '@/components/ui/custom-tabs';
import { FormattedCurrency, FormattedPercentage } from '@/components/common/formatted-values';
import { useSettings } from '@/hooks/use-settings';
import { formatPercentage } from '@/lib/utils/format-settings';

interface TraderCockpitProps {
  stats: PortfolioStats;
}

type Tab = 'risk' | 'edge' | 'behavior';

const TABS: TabItem[] = [
  { id: 'risk', label: 'Risk', icon: ShieldAlert },
  { id: 'edge', label: 'Edge', icon: Crosshair },
  { id: 'behavior', label: 'Behavior', icon: Brain },
];

function Row({ label, children, variant }: { label: string; children: React.ReactNode; variant?: 'positive' | 'negative' | 'neutral' }) {
  const bg = variant === 'positive' ? 'bg-positive/5 border border-positive/20'
    : variant === 'negative' ? 'bg-negative/5 border border-negative/20'
    : 'bg-muted/50';
  return (
    <div className={cn('flex items-center justify-between p-2.5 rounded-lg', bg)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-bold">{children}</span>
    </div>
  );
}

export function TraderCockpit({ stats }: TraderCockpitProps) {
  const [tab, setTab] = useState<Tab>('risk');
  const { settings } = useSettings();
  const maxAllowedDD = 30;

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 p-4 pb-3">
        <h3 className="text-sm font-semibold">Trader cockpit</h3>
        <CustomTabs size="sm" compact items={TABS} value={tab} onValueChange={(v) => setTab(v as Tab)} />
      </div>

      {/* Tab content */}
      <div className="p-4 space-y-2.5">
        {tab === 'risk' && (
          <>
            <Row label="Max Drawdown" variant="negative">
              <span className="text-negative"><FormattedPercentage value={stats.maxDrawdown} decimals={1} /></span>
            </Row>
            <div className="p-2.5 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">DD / Allowed</span>
                <span className="text-xs font-bold text-muted-foreground">{stats.maxDrawdown.toFixed(1)}% / {maxAllowedDD}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={cn('h-2 rounded-full transition-all',
                    stats.maxDrawdown <= maxAllowedDD * 0.7 ? 'bg-positive' :
                    stats.maxDrawdown <= maxAllowedDD ? 'bg-warning' : 'bg-negative'
                  )}
                  style={{ width: `${Math.min(100, (stats.maxDrawdown / maxAllowedDD) * 100)}%` }}
                />
              </div>
            </div>
            <Row label="Risk of Ruin">
              <span className={cn(
                stats.maxDrawdown > 25 ? 'text-negative' :
                stats.maxDrawdown > 15 ? 'text-warning' : 'text-positive'
              )}>
                {stats.maxDrawdown > 25 ? 'HIGH' : stats.maxDrawdown > 15 ? 'MED' : 'LOW'}
              </span>
            </Row>
          </>
        )}

        {tab === 'edge' && (
          <>
            <Row label="Profit Factor" variant={stats.profitFactor >= 1 ? 'positive' : 'negative'}>
              <span className={cn(stats.profitFactor >= 1 ? 'text-positive' : 'text-negative')}>
                {stats.profitFactor ? (settings ? formatPercentage(stats.profitFactor, settings, { asDecimal: true, decimals: 2 }) : stats.profitFactor.toFixed(2)) : '∞'}
              </span>
            </Row>
            <Row label="Expectancy">
              <span className={cn(stats.expectancy > 0 ? 'text-positive' : 'text-negative')}>
                {stats.expectancy >= 0 ? '+' : ''}<FormattedCurrency value={Math.abs(stats.expectancy)} short />
              </span>
            </Row>
            <Row label="Tail Risk Ratio" variant={(Math.abs(stats.largestLoss) / stats.averageProfit) > 2 ? 'negative' : undefined}>
              <span className={cn(
                (Math.abs(stats.largestLoss) / stats.averageProfit) > 2 ? 'text-negative' : 'text-positive'
              )}>
                {stats.averageProfit > 0 ? (Math.abs(stats.largestLoss) / stats.averageProfit).toFixed(1) : '∞'}
              </span>
            </Row>
          </>
        )}

        {tab === 'behavior' && (
          <>
            <Row label="Current Streak">
              <span className={cn(stats.currentStreak > 0 ? 'text-positive' : 'text-negative')}>
                {stats.currentStreak > 0 ? '+' : ''}{stats.currentStreak}
              </span>
            </Row>
            <Row label="Asymmetry Ratio">
              <span className={cn(
                (stats.averageProfit / Math.abs(stats.averageLoss)) > 1 ? 'text-positive' : 'text-warning'
              )}>
                {stats.averageLoss !== 0 ? (stats.averageProfit / Math.abs(stats.averageLoss)).toFixed(1) : '∞'}:1
              </span>
            </Row>
            <Row label="Best Day" variant="positive">
              <span className="text-positive">+<FormattedCurrency value={stats.largestProfit} short /></span>
            </Row>
            <Row label="Worst Day" variant="negative">
              <span className="text-negative">-<FormattedCurrency value={Math.abs(stats.largestLoss)} short /></span>
            </Row>
          </>
        )}
      </div>
    </div>
  );
}
