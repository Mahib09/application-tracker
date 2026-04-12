"use client"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { STATUS_COLORS, STATUS_CONFIG, STATUS_DISPLAY_ORDER } from "@/lib/constants"

interface Props {
  counts: Record<applicationStatus, number>
  total: number
}

export default function TableFooter({ counts, total }: Props) {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border text-xs text-muted-foreground">
      <span className="tabular-nums font-medium text-foreground">{total} total</span>
      {STATUS_DISPLAY_ORDER.map((status) => (
        <span key={status} className="flex items-center gap-1.5 tabular-nums">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: STATUS_COLORS[status] }}
          />
          {counts[status] ?? 0} {STATUS_CONFIG[status].label}
        </span>
      ))}
    </div>
  )
}
