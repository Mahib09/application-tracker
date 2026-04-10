"use client"
import SyncButton from "@/components/SyncButton"
import AddApplicationDialog from "@/components/AddApplicationDialog"
import { Button } from "@/components/ui/button"
import { LayoutList, LayoutGrid } from "lucide-react"

type ViewMode = "table" | "kanban"

interface ToolbarProps {
  lastSyncedAt: Date | null
  cooldownMs: number
  view: ViewMode
  onViewChange: (view: ViewMode) => void
}

export default function Toolbar({ lastSyncedAt, cooldownMs, view, onViewChange }: ToolbarProps) {
  return (
    <div className="flex items-center justify-between py-3">
      {/* Left: Sync status */}
      <SyncButton lastSyncedAt={lastSyncedAt} cooldownMs={cooldownMs} compact />

      {/* Right: View toggle + Add */}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border p-0.5">
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="icon-xs"
            aria-label="Table view"
            onClick={() => onViewChange("table")}
          >
            <LayoutList className="size-3.5" />
          </Button>
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="icon-xs"
            aria-label="Kanban view"
            onClick={() => onViewChange("kanban")}
            disabled
            title="Coming soon"
          >
            <LayoutGrid className="size-3.5" />
          </Button>
        </div>

        <AddApplicationDialog />
      </div>
    </div>
  )
}
