"use client"
import { type Application } from "@/types/application"
import { applicationStatus } from "@/app/generated/prisma/enums"
import GhostProgressRing from "@/components/dashboard/GhostProgressRing"
import { motion } from "motion/react"

interface Props {
  app: Application
  selected: boolean
  onSelect: (id: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
}

function daysSince(date: Date | string | null): number {
  if (!date) return 0
  const d = new Date(date)
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)))
}

export default function KanbanCard({ app, selected, onSelect, onDragStart, onDragEnd }: Props) {
  const days = daysSince(app.appliedAt)
  const isApplied = app.status === applicationStatus.APPLIED

  return (
    <motion.div
      layout
      draggable
      onDragStart={(e) => {
        ;(e as unknown as DragEvent).dataTransfer?.setData("text/plain", app.id)
        onDragStart(app.id)
      }}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(app.id)}
      whileHover={{ y: -1 }}
      whileDrag={{ scale: 1.03, boxShadow: "0 12px 24px rgba(0,0,0,0.18)" }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`group cursor-grab active:cursor-grabbing rounded-md border bg-card px-3 py-2.5 shadow-sm hover:border-foreground/20 ${
        selected ? "border-foreground/40 ring-1 ring-foreground/20" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{app.company}</div>
          <div className="truncate text-xs text-muted-foreground">{app.roleTitle}</div>
        </div>
        {isApplied && <GhostProgressRing daysSince={days} />}
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
        {days === 0 ? "Today" : `${days}d`}
      </div>
    </motion.div>
  )
}
