import { Skeleton } from "@/components/ui/skeleton";

/** Dashboard skeleton — metric cards + chart area */
export const DashboardSkeleton = () => (
  <div className="space-y-6 animate-in fade-in duration-300">
    {/* Metric cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass-card p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
    {/* Chart area */}
    <div className="glass-card p-5 space-y-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-[220px] w-full rounded-lg" />
    </div>
    {/* Table rows */}
    <div className="glass-card p-5 space-y-3">
      <Skeleton className="h-5 w-36" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded" />
      ))}
    </div>
  </div>
);

/** Pipeline/Kanban skeleton — columns with cards */
export const PipelineSkeleton = () => (
  <div className="flex gap-4 overflow-x-auto pb-4 animate-in fade-in duration-300">
    {Array.from({ length: 5 }).map((_, col) => (
      <div key={col} className="min-w-[260px] flex-shrink-0 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-8 rounded-full ml-auto" />
        </div>
        {Array.from({ length: 3 - col % 2 }).map((_, card) => (
          <div key={card} className="glass-card p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

/** Table/list skeleton — for Contratos, Financeiro */
export const TableSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <div className="space-y-4 animate-in fade-in duration-300">
    {/* Summary cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass-card p-4 space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-28" />
        </div>
      ))}
    </div>
    {/* Table */}
    <div className="glass-card p-4 space-y-3">
      <Skeleton className="h-10 w-full rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded" />
      ))}
    </div>
  </div>
);

/** Grid skeleton — for Imóveis cards */
export const GridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in duration-300">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="glass-card overflow-hidden">
        <Skeleton className="h-48 w-full" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-6 w-32" />
        </div>
      </div>
    ))}
  </div>
);
