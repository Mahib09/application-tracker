"use client"
import { useState, useMemo } from "react"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { type Application } from "@/types/application"
import { KANBAN_COLUMN_ORDER } from "@/lib/constants"
import KanbanColumn from "@/components/dashboard/KanbanColumn"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface Props {
  applications: Application[]
  selectedId: string | null
  onSelect: (id: string) => void
  onStatusChange: (id: string, prev: applicationStatus, next: applicationStatus) => Promise<void>
  onApproveReview: (id: string, status: applicationStatus) => Promise<void>
  onDismissReview: (id: string) => Promise<void>
}

export default function KanbanBoard({
  applications,
  selectedId,
  onSelect,
  onStatusChange,
  onApproveReview,
  onDismissReview,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, applicationStatus>>({})

  const reviewItems = useMemo(
    () => applications.filter((a) => a.status === applicationStatus.NEEDS_REVIEW),
    [applications],
  )

  const effectiveStatus = (app: Application): applicationStatus =>
    overrides[app.id] ?? app.status

  const byColumn = useMemo(() => {
    const map = new Map<applicationStatus, Application[]>()
    KANBAN_COLUMN_ORDER.forEach((s) => map.set(s, []))
    for (const app of applications) {
      const s = effectiveStatus(app)
      if (s === applicationStatus.NEEDS_REVIEW) continue
      map.get(s)?.push(app)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications, overrides])

  const handleDrop = async (id: string, next: applicationStatus) => {
    const app = applications.find((a) => a.id === id)
    if (!app) return
    const prev = effectiveStatus(app)
    if (prev === next) return
    setOverrides((o) => ({ ...o, [id]: next }))
    try {
      await onStatusChange(id, prev, next)
    } catch {
      setOverrides((o) => {
        const { [id]: _, ...rest } = o
        return rest
      })
    }
  }

  return (
    <div className="py-4">
      {reviewItems.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
              {reviewItems.length} items need review
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {reviewItems.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-md border border-amber-300 bg-card px-2 py-1 text-xs dark:border-amber-900"
              >
                <span className="font-medium">{r.company}</span>
                <span className="text-muted-foreground">{r.roleTitle}</span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => onApproveReview(r.id, applicationStatus.APPLIED)}
                  aria-label="Approve"
                  className="text-green-600"
                >
                  ✓
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => onDismissReview(r.id)}
                  aria-label="Dismiss"
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="flex gap-3 overflow-x-auto pb-2"
        onDragEnd={() => setDraggingId(null)}
      >
        {KANBAN_COLUMN_ORDER.map((s) => (
          <KanbanColumn
            key={s}
            status={s}
            applications={byColumn.get(s) ?? []}
            selectedId={selectedId}
            onSelect={onSelect}
            onDropCard={handleDrop}
            onDragStart={setDraggingId}
            onDragEnd={() => setDraggingId(null)}
          />
        ))}
      </div>
      {draggingId && null}
    </div>
  )
}
