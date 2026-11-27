'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FlaskConical, LogIn, Plus } from 'lucide-react';
import type { DailyPnL } from '@/types/trading';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { AddTransactionForm } from '@/components/features/transactions/add-transaction-form';
import { DashboardView } from '@/components/features/dashboard/dashboard-view';
import { calculatePortfolioStats } from '@/lib/utils/calculate-stats';
import { DEMO_CAPITAL, generateDemoEntries } from '@/lib/demo-data';

/**
 * Public, read-write-in-memory demo of the dashboard with generated data.
 * Nothing is persisted or sent anywhere.
 */
export default function DemoPage() {
  // Generated on the client so the sample is anchored to the visitor's "today"
  // (the page is statically prerendered, so build-time data would be stale).
  const [entries, setEntries] = useState<DailyPnL[]>([]);
  useEffect(() => {
    setEntries(generateDemoEntries()); // eslint-disable-line react-hooks/set-state-in-effect -- one-time client init
  }, []);
  const stats = useMemo(() => calculatePortfolioStats(entries, DEMO_CAPITAL), [entries]);

  const onAdd = useCallback(async (e: Partial<DailyPnL>) => {
    setEntries((prev) => [...prev, { id: crypto.randomUUID(), date: e.date ?? new Date(), pnl: e.pnl ?? 0, notes: e.notes }]);
  }, []);
  const onUpdate = useCallback(async (id: string, u: Partial<DailyPnL>) => {
    setEntries((prev) => prev.map((x) => (x.id === id ? { ...x, ...u } : x)));
  }, []);
  const onDelete = useCallback((id: string) => {
    setEntries((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <AppLayout
      stats={stats}
      addPnlButton={
        <AddTransactionForm
          onAdd={onAdd}
          trigger={
            <Button className="h-9 w-9 rounded-xl bg-primary text-primary-foreground md:w-auto md:px-3">
              <Plus className="h-4 w-4" />
              <span className="ml-2 hidden text-sm font-medium md:inline">Add P&L</span>
            </Button>
          }
        />
      }
      refreshButton={
        <Button asChild variant="outline" className="h-9 rounded-xl border-border/80 bg-card px-3 text-sm">
          <Link href="/"><LogIn className="mr-1.5 h-4 w-4" />Sign in</Link>
        </Button>
      }
    >
      <DashboardView
        entries={entries}
        baseCapital={DEMO_CAPITAL}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onDelete={onDelete}
        banner={
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-info/30 bg-info/5 px-4 py-2.5 text-sm">
            <FlaskConical className="h-4 w-4 text-info" />
            <span><b>Demo mode</b> — generated sample data. Edits stay in this tab and are never saved.</span>
          </div>
        }
      />
    </AppLayout>
  );
}
