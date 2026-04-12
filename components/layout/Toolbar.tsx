"use client"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback } from "react"
import SyncButton from "@/components/SyncButton"
import AddApplicationDialog from "@/components/AddApplicationDialog"
import { Button } from "@/components/ui/button"
import { LayoutList, LayoutGrid } from "lucide-react"

type ViewMode = "table" | "kanban"

interface ToolbarProps {
  lastSyncedAt: Date | null
  cooldownMs: number
}

export default function Toolbar({ lastSyncedAt, cooldownMs }: ToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view: ViewMode = searchParams.get("view") === "kanban" ? "kanban" : "table"

  const setView = useCallback(
    (next: ViewMode) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === "kanban") params.set("view", "kanban")
      else params.delete("view")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, pathname, searchParams],
  )

  return (
    <div className="flex items-center justify-between py-3">
      <SyncButton lastSyncedAt={lastSyncedAt} cooldownMs={cooldownMs} compact />

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border p-0.5">
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="icon-xs"
            aria-label="Table view"
            onClick={() => setView("table")}
          >
            <LayoutList className="size-3.5" />
          </Button>
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="icon-xs"
            aria-label="Kanban view"
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="size-3.5" />
          </Button>
        </div>

        <AddApplicationDialog />
      </div>
    </div>
  )
}
