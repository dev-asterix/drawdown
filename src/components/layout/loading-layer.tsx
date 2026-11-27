'use client';

import { Loader2 } from 'lucide-react';

interface LoadingLayerProps {
  isLoading: boolean;
  message?: string;
}

/**
 * Non-blocking sync indicator: a slim indeterminate bar along the top of the
 * viewport plus a small status pill. The UI stays fully interactive.
 */
export function LoadingLayer({ isLoading, message = 'Syncing from cloud…' }: LoadingLayerProps) {
  if (!isLoading) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden" role="progressbar" aria-label={message}>
        <div className="h-full w-1/3 animate-[loading-bar_1.1s_cubic-bezier(0.2,0,0,1)_infinite] rounded-full bg-primary" />
      </div>
      <div
        className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-raised px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-elev-3 animate-in fade-in-0 slide-in-from-bottom-2"
        aria-live="polite"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        {message}
      </div>
    </>
  );
}
