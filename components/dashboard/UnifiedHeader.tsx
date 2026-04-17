"use client"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { STATUS_COLORS, STATUS_CONFIG, STATUS_DISPLAY_ORDER } from "@/lib/constants"

interface Props {
  filterStatus: applicationStatus | "ALL"
  onFilterChange: (status: applicationStatus | "ALL") => void
}

export default function UnifiedHeader({ filterStatus, onFilterChange }: Props) {
  return (
    <div className="flex items-center border-b border-border bg-card px-4 py-2.5">
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
