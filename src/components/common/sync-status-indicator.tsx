'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudOff, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils/utils';

export function SyncStatusIndicator() {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'synced'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    const handleSynced = () => {
      setSyncStatus('synced');
      setLastSyncTime(new Date().toLocaleTimeString());
      setTimeout(() => setSyncStatus('idle'), 3000);
    };

    const handleSyncError = () => {
      setSyncStatus('error');
    };

    window.addEventListener('portfolio-synced', handleSynced);
    window.addEventListener('portfolio-sync-error', handleSyncError);

    return () => {
      window.removeEventListener('portfolio-synced', handleSynced);
      window.removeEventListener('portfolio-sync-error', handleSyncError);
    };
  }, []);

  if (syncStatus === 'idle') return null;

  return (
    <div className={cn(
      "fixed bottom-4 right-4 px-3 py-2 rounded-lg shadow-elev-2 flex items-center gap-2 text-sm",
      " border transition duration-base",
      syncStatus === 'syncing' && "bg-primary/90 border-primary/30 text-primary",
      syncStatus === 'synced' && "bg-positive/10 border-positive/30 text-positive",
      syncStatus === 'error' && "bg-negative/10 border-negative/30 text-negative"
    )}>
      {syncStatus === 'syncing' && (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Syncing to cloud...</span>
        </>
      )}
      {syncStatus === 'synced' && (
        <>
          <Check className="w-4 h-4" />
          <span>Synced {lastSyncTime}</span>
        </>
      )}
      {syncStatus === 'error' && (
        <>
          <CloudOff className="w-4 h-4" />
          <span>Sync failed - retrying...</span>
        </>
      )}
    </div>
  );
}
