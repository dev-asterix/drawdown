import { Skeleton } from '@/components/ui/skeleton';

/**
 * Layout-matched placeholder shown only on a cold first load (no cache yet),
 * so the page never jumps when real data arrives.
 */
export function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:p-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-72" />
        </div>
        <Skeleton className="h-9 w-80" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface h-[260px] p-6 lg:col-span-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-12 w-64" />
          <Skeleton className="mt-6 h-4 w-80" />
        </div>
        <div className="surface h-[260px] p-5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-4 h-9 w-40" />
          <Skeleton className="mt-6 h-14 w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="surface h-[132px] p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="surface h-[420px] p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-6 h-[320px] w-full" />
        </div>
        <div className="surface h-[420px] p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-14 w-full" />
          <Skeleton className="mt-2 h-14 w-full" />
          <Skeleton className="mt-2 h-14 w-full" />
        </div>
      </div>
    </div>
  );
}
