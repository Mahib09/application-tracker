"use client"
import { useState } from "react"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { type Application } from "@/types/application"
import { STATUS_COLORS, STATUS_CONFIG } from "@/lib/constants"
import KanbanCard from "@/components/dashboard/KanbanCard"

interface Props {
  status: applicationStatus
  applications: Application[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDropCard: (id: string, next: applicationStatus) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
}

export default function KanbanColumn({
  status,
  applications,
  selectedId,
  onSelect,
  onDropCard,
  onDragStart,
  onDragEnd,
}: Props) {
  const [over, setOver] = useState(false)
  const color = STATUS_COLORS[status]
  const label = STATUS_CONFIG[status].label

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!over) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData("text/plain")
        if (id) onDropCard(id, status)
      }}
      className={`flex min-h-[60vh] w-[80vw] md:w-64 shrink-0 snap-center md:snap-align-none flex-col rounded-lg border bg-muted/30 ${
        over ? "border-foreground/40 bg-muted/60" : "border-border"
      }`}
    >
      <div
        className="rounded-t-lg border-b border-border px-3 py-2"
        style={{ borderTop: `2px solid ${color}` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs font-medium text-foreground">{label}</span>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{applications.length}</span>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {applications.map((app) => (
          <KanbanCard
            key={app.id}
            app={app}
            selected={selectedId === app.id}
            onSelect={onSelect}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  )
}
