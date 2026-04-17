import TableSkeleton from "@/components/dashboard/TableSkeleton"

export default function DashboardLoading() {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* NavBar placeholder */}
      <div className="border-b border-border bg-card px-6 py-2.5 flex items-center justify-between">
        <div className="h-5 w-12 rounded bg-muted animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-7 w-24 rounded-full bg-muted animate-pulse" />
          <div className="size-7 rounded bg-muted animate-pulse" />
        </div>
      </div>

      {/* Toolbar placeholder */}
      <div className="max-w-7xl mx-auto w-full px-6">
        <div className="flex items-center justify-between py-3">
          <div className="h-7 w-36 rounded bg-muted animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-16 rounded-lg bg-muted animate-pulse" />
            <div className="h-7 w-28 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="flex-1 min-h-0 max-w-7xl mx-auto w-full px-6 pb-2">
        <div className="h-full rounded-lg border border-border overflow-hidden">
          {/* Filter pills placeholder */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-6 rounded-full bg-muted animate-pulse" style={{ width: `${50 + i * 8}px` }} />
            ))}
          </div>
          <TableSkeleton />
        </div>
      </div>
    </div>
  )
}
