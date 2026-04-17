"use client"
import { type StatusChangeRecord } from "@/types/application"
import { STATUS_COLORS, STATUS_CONFIG } from "@/lib/constants"
import { applicationStatus } from "@/app/generated/prisma/enums"

interface Props {
  history: StatusChangeRecord[]
}

const TRIGGER_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SYNC: "Auto-classified",
  AUTO_GHOST: "Auto-ghosted · 30d no response",
  DRAG_DROP: "Drag-and-drop",
  COMMAND_PALETTE: "Command palette",
}

function formatDate(date: Date | string): string {
  const d = new Date(date)
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  // Show actual date for older events — more useful in a timeline
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined })
}

export default function SidebarTimeline({ history }: Props) {
  // Show chronological order (oldest first) for a natural timeline
  const sorted = [...history].sort((a, b) => {
    const dateA = new Date(a.eventDate ?? a.createdAt).getTime()
    const dateB = new Date(b.eventDate ?? b.createdAt).getTime()
    return dateA - dateB
  })

  return (
    <div className="relative pl-4">
      {/* Connecting line */}
      <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />

      <div className="space-y-3">
        {sorted.map((entry, i) => {
          const toStatus = entry.toStatus as applicationStatus
          const color = STATUS_COLORS[toStatus] ?? "#888"
          const label = STATUS_CONFIG[toStatus]?.label ?? entry.toStatus
          const isInitial = entry.fromStatus === entry.toStatus
          const displayDate = entry.eventDate ?? entry.createdAt

          return (
            <div key={entry.id} className="relative flex items-start gap-3">
              {/* Dot — larger for the latest event */}
              <span
                className={`absolute -left-4 top-1 rounded-full ring-2 ring-card shrink-0 ${
                  i === sorted.length - 1 ? "size-3 -left-4.25" : "size-2.5"
                }`}
                style={{ backgroundColor: color }}
              />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs font-medium" style={{ color }}>
                  {isInitial ? label : `${STATUS_CONFIG[entry.fromStatus as applicationStatus]?.label ?? entry.fromStatus} → ${label}`}
                </span>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{formatDate(displayDate)}</span>
                  <span>·</span>
                  <span>{TRIGGER_LABELS[entry.trigger] ?? entry.trigger}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
