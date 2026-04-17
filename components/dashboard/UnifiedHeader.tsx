"use client"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { STATUS_COLORS, STATUS_CONFIG, STATUS_DISPLAY_ORDER } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, X, Trash2 } from "lucide-react"

interface Props {
  filterStatus: applicationStatus | "ALL"
  onFilterChange: (status: applicationStatus | "ALL") => void
  // Sidebar nav — only rendered when sidebar is open
  sidebarOpen: boolean
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  onDelete?: () => void
  onClose?: () => void
}

export default function UnifiedHeader({
  filterStatus,
  onFilterChange,
  sidebarOpen,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onDelete,
  onClose,
}: Props) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
      {/* Left: filter pills */}
      <div className="flex items-center gap-1.5">
        <FilterPill
          active={filterStatus === "ALL"}
          onClick={() => onFilterChange("ALL")}
          label="All"
        />
        {STATUS_DISPLAY_ORDER.map((s) => (
          <FilterPill
            key={s}
            active={filterStatus === s}
            onClick={() => onFilterChange(s)}
            label={STATUS_CONFIG[s].label}
            color={STATUS_COLORS[s]}
          />
        ))}
      </div>

      {/* Right: sidebar nav buttons (only when sidebar is open) */}
      {sidebarOpen && (
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon-xs" onClick={onPrev} disabled={!hasPrev} aria-label="Previous">
              <ChevronUp className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={onNext} disabled={!hasNext} aria-label="Next">
              <ChevronDown className="size-3.5" />
            </Button>
          </div>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Delete"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close sidebar">
            <X className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

function FilterPill({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-foreground text-background"
          : "bg-muted/60 text-muted-foreground hover:bg-muted"
      }`}
    >
      {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  )
}
