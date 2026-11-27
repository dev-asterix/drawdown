'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Edit2, Plus, RefreshCw } from 'lucide-react';
import type { DailyPnL } from '@/types/trading';
import { AppLayout } from '@/components/layout/app-layout';
import { LoginScreen } from '@/components/auth/login-screen';
import { LoadingLayer } from '@/components/layout/loading-layer';
import { SyncStatusIndicator } from '@/components/common/sync-status-indicator';
import { Button } from '@/components/ui/button';
import { AddTransactionForm } from '@/components/features/transactions/add-transaction-form';
import { EditEquityForm } from '@/components/features/portfolio/edit-equity-form';
import { FundHistory } from '@/components/features/funds/fund-history';
import { DashboardView } from '@/components/features/dashboard/dashboard-view';
import { calculatePortfolioStats } from '@/lib/utils/calculate-stats';
import { getCachedPortfolio, setCachedPortfolio } from '@/lib/local-cache';
import { scheduleSync } from '@/lib/sync-queue';

const DEFAULT_CAPITAL = 100000;

const toEntries = (raw: any[]): DailyPnL[] => (raw ?? []).map((e: any) => ({ ...e, date: new Date(e.date) }));

export default function Dashboard() {
  const { data: session, status } = useSession();
  const email = session?.user?.email ?? null;

  /** Every entry for all time — ranges are filtered on the client so switching is instant. */
  const [entries, setEntries] = useState<DailyPnL[]>([]);
  const [baseCapital, setBaseCapital] = useState<number>(DEFAULT_CAPITAL);
  const [loading, setLoading] = useState(true);
  const [optimisticError, setOptimisticError] = useState<string | null>(null);
  const [optimisticProgress, setOptimisticProgress] = useState(false);

  const flashError = (msg: string) => {
    setOptimisticError(msg);
    setTimeout(() => setOptimisticError(null), 5000);
  };

  const fetchFromCloud = useCallback(async () => {
    const response = await fetch('/api/portfolio?consolidated=false');
    if (!response.ok) return;
    const data = await response.json();
    setEntries(toEntries(data.dailyPnL));
    setBaseCapital(data.stats?.initialCapital ?? data.initialCapital ?? DEFAULT_CAPITAL);
    if (email) {
      await setCachedPortfolio(email, {
        dailyPnL: data.dailyPnL,
        fundTransactions: data.fundTransactions || [],
        initialCapital: data.stats?.initialCapital ?? data.initialCapital,
        lastUpdated: data.lastUpdated,
      });
    }
  }, [email]);

  const fetchData = useCallback(async () => {
    if (!email) return;
    try {
      setLoading(true);
      // Cache first for an instant paint, then refresh from the cloud in the background.
      const cached = await getCachedPortfolio(email);
      if (cached) {
        setEntries(toEntries(cached.dailyPnL));
        if (typeof cached.initialCapital === 'number') setBaseCapital(cached.initialCapital);
        setLoading(false);
        fetchFromCloud().catch((e) => console.error('Background refresh failed:', e));
        return;
      }
      await fetchFromCloud();
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
    } finally {
      setLoading(false);
    }
  }, [email, fetchFromCloud]);

  useEffect(() => {
    if (status === 'authenticated') fetchData();
  }, [status, fetchData]);

  /** Apply a change locally, persist it to the cache, and queue a cloud sync. */
  const commit = useCallback(async (next: DailyPnL[], mutateCache: (cached: any) => any) => {
    setEntries(next);
    if (!email) return;
    const cached = await getCachedPortfolio(email);
    if (cached) await setCachedPortfolio(email, { ...mutateCache(cached), lastUpdated: new Date().toISOString() });
    scheduleSync(email);
  }, [email]);

  const handleAddEntry = useCallback(async (entry: Partial<DailyPnL>) => {
    if (!email) return;
    const newEntry: DailyPnL = { id: crypto.randomUUID(), date: entry.date || new Date(), pnl: entry.pnl || 0, notes: entry.notes };
    const original = entries;
    try {
      if (entries.length > 5000) setOptimisticProgress(true);
      const next = [...entries, newEntry].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      await commit(next, (c) => ({ ...c, dailyPnL: [...c.dailyPnL, newEntry] }));
    } catch (error) {
      console.error('Error adding transaction:', error);
      setEntries(original);
      flashError('Error adding transaction - please try again');
    } finally {
      setOptimisticProgress(false);
    }
  }, [email, entries, commit]);

  const handleUpdateEntry = useCallback(async (id: string, updated: Partial<DailyPnL>) => {
    if (!email) return;
    const original = entries.find((t) => t.id === id);
    if (!original) {
      console.error('Transaction not found');
      return;
    }
    const merged: DailyPnL = {
      ...original,
      date: updated.date || original.date,
      pnl: updated.pnl !== undefined ? updated.pnl : original.pnl,
      notes: updated.notes !== undefined ? updated.notes : (original.notes || ''),
    };
    const snapshot = entries;
    try {
      await commit(entries.map((t) => (t.id === id ? merged : t)), (c) => ({
        ...c,
        dailyPnL: c.dailyPnL.map((t: any) => (t.id === id ? merged : t)),
      }));
    } catch (error) {
      console.error('Error updating cache:', error);
      setEntries(snapshot);
      flashError('Error saving changes - please try again');
    }
  }, [email, entries, commit]);

  const handleDeleteEntry = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    if (!email) return;
    const snapshot = entries;
    try {
      await commit(entries.filter((t) => t.id !== id), (c) => ({ ...c, dailyPnL: c.dailyPnL.filter((t: any) => t.id !== id) }));
    } catch (error) {
      console.error('Error deleting entry:', error);
      setEntries(snapshot);
      flashError('Failed to delete entry');
    }
  }, [email, entries, commit]);

  const globalStats = useMemo(() => calculatePortfolioStats(entries, baseCapital), [entries, baseCapital]);

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin" /></div>;
  }
  if (status === 'unauthenticated') return <LoginScreen />;

  return (
    <>
      <LoadingLayer isLoading={loading} message="Syncing your portfolio data from cloud..." />
      <SyncStatusIndicator />
      <AppLayout
        stats={globalStats}
        equityEditButton={
          <EditEquityForm
            currentEquity={baseCapital}
            onEquityUpdated={fetchData}
            trigger={
              <Button variant="ghost" size="icon" title="Edit Initial Capital" className="h-6 w-6 rounded-lg">
                <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            }
          />
        }
        addPnlButton={
          <AddTransactionForm
            onAdd={handleAddEntry}
            trigger={
              <Button className="h-9 w-9 rounded-xl bg-primary text-primary-foreground shadow-sm transition-all duration-300 hover:bg-primary/90 hover:shadow-md active:scale-95 md:w-auto md:px-3">
                <Plus className="h-4 w-4" />
                <span className="ml-2 hidden text-sm font-medium md:inline">Add P&L</span>
              </Button>
            }
          />
        }
        refreshButton={
          <Button variant="outline" size="icon" onClick={fetchData} title="Refresh Data" className="h-9 w-9 rounded-xl border-border/80 bg-card shadow-sm transition-all duration-300 active:scale-95">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      >
        {optimisticError && (
          <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-destructive/90 px-4 py-3 text-sm text-destructive-foreground shadow-lg animate-in slide-in-from-bottom-2 duration-200">
            <span>{optimisticError}</span>
            <button onClick={() => setOptimisticError(null)} className="ml-2 text-xs underline">Dismiss</button>
          </div>
        )}
        {optimisticProgress && (
          <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-lg">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Processing...</span>
          </div>
        )}

        <DashboardView
          entries={entries}
          baseCapital={baseCapital}
          onAdd={handleAddEntry}
          onUpdate={handleUpdateEntry}
          onDelete={handleDeleteEntry}
          renderFunds={(range) => <FundHistory onFundUpdate={fetchData} dateRange={range} />}
        />
      </AppLayout>
    </>
  );
}
