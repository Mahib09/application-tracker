"use client"

export default function TableSkeleton() {
  return (
    <div className="bg-card">
      {/* Fake table header */}
      <div className="border-b border-border">
        <div className="flex items-center px-3 py-2.5 gap-6">
          <div className="w-8" />
          <div className="h-3 w-20 rounded bg-muted animate-pulse" />
          <div className="h-3 w-16 rounded bg-muted animate-pulse" />
          <div className="h-3 w-14 rounded bg-muted animate-pulse" />
          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          <div className="hidden lg:block h-3 w-20 rounded bg-muted animate-pulse" />
        </div>
      </div>

      {/* Fake rows */}
      {Array.from({ length: 7 }, (_, i) => (
        <div
          key={i}
          className="flex items-center px-3 py-3 gap-6 border-b border-border/50"
          style={{ opacity: 1 - i * 0.08 }}
        >
          <div className="w-8 flex justify-center">
            <div className="size-3.5 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-3.5 rounded bg-muted animate-pulse" style={{ width: `${90 + (i % 3) * 20}px` }} />
          <div className="h-3.5 rounded bg-muted animate-pulse" style={{ width: `${70 + (i % 4) * 15}px` }} />
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-muted animate-pulse" />
            <div className="h-3.5 w-16 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-3.5 w-14 rounded bg-muted animate-pulse" />
          <div className="hidden lg:block h-3.5 w-10 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  )
}
