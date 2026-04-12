"use client"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { STATUS_CONFIG, STATUS_COLORS, STATUS_DISPLAY_ORDER } from "@/lib/constants"
import { motion, AnimatePresence } from "motion/react"
import { X, Trash2 } from "lucide-react"
import { useState } from "react"

interface Props {
  count: number
  onChangeStatus: (status: applicationStatus) => void
  onDelete: () => void
  onDeselect: () => void
}

export default function BulkActionBar({ count, onChangeStatus, onDelete, onDeselect }: Props) {
  const [showStatuses, setShowStatuses] = useState(false)

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-lg"
        >
          <span className="text-sm font-medium text-foreground tabular-nums">{count} selected</span>
          <div className="w-px h-5 bg-border" />

          {/* Status change */}
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setShowStatuses(!showStatuses)}>
              Move to...
            </Button>
            {showStatuses && (
              <div className="absolute bottom-full mb-1 left-0 rounded-lg border border-border bg-card shadow-lg py-1 min-w-36">
                {STATUS_DISPLAY_ORDER.map((s) => (
                  <button
                    key={s}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left"
                    onClick={() => { onChangeStatus(s); setShowStatuses(false) }}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={onDelete}>
            <Trash2 className="size-3.5" />
          </Button>

          <Button variant="ghost" size="icon-xs" onClick={onDeselect} aria-label="Deselect all">
            <X className="size-3.5" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
