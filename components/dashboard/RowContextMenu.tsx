"use client"
import { useEffect, useRef } from "react"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { STATUS_CONFIG, STATUS_COLORS, STATUS_DISPLAY_ORDER } from "@/lib/constants"

interface Props {
  x: number
  y: number
  onClose: () => void
  onOpen: () => void
  onChangeStatus: (status: applicationStatus) => void
  onDelete: () => void
}

export default function RowContextMenu({ x, y, onClose, onOpen, onChangeStatus, onDelete }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleEsc)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleEsc)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-lg border border-border bg-card shadow-lg py-1 min-w-44"
      style={{ left: x, top: y }}
    >
      <button
        className="flex w-full items-center px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left"
        onClick={() => { onOpen(); onClose() }}
      >
        Open
      </button>

      <div className="mx-2 my-1 h-px bg-border" />
      <div className="px-3 py-1 text-xs text-muted-foreground">Change status</div>
      {STATUS_DISPLAY_ORDER.map((s) => (
        <button
          key={s}
          className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left"
          onClick={() => { onChangeStatus(s); onClose() }}
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
          {STATUS_CONFIG[s].label}
        </button>
      ))}

      <div className="mx-2 my-1 h-px bg-border" />
      <button
        className="flex w-full items-center px-3 py-1.5 text-sm text-destructive hover:bg-muted transition-colors text-left"
        onClick={() => { onDelete(); onClose() }}
      >
        Delete
      </button>
    </div>
  )
}
