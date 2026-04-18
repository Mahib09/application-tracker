"use client"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { STATUS_COLORS, STATUS_CONFIG, STATUS_DISPLAY_ORDER } from "@/lib/constants"
import { Tag } from "lucide-react"

interface Props {
  filterStatus: applicationStatus | "ALL"
  onFilterChange: (status: applicationStatus | "ALL") => void
  allTags?: string[]
  filterTag?: string | null
  onFilterTag?: (tag: string | null) => void
}

export default function UnifiedHeader({ filterStatus, onFilterChange, allTags = [], filterTag, onFilterTag }: Props) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 flex-wrap">
      <div className="flex items-center gap-1.5 flex-wrap">
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

      {allTags.length > 0 && onFilterTag && (
        <div className="flex items-center gap-1.5 border-l border-border pl-3 flex-wrap">
          <Tag className="size-3 text-muted-foreground shrink-0" />
          {filterTag && (
            <button
              onClick={() => onFilterTag(null)}
              className="rounded-full px-2.5 py-1 text-xs font-medium bg-foreground text-background transition-colors"
            >
              {filterTag} ×
            </button>
          )}
          {!filterTag && (
            <select
              value=""
              onChange={(e) => onFilterTag(e.target.value || null)}
              className="rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground border-0 outline-none cursor-pointer hover:bg-muted"
            >
              <option value="">Filter by tag…</option>
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
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
