"use client"
import { useState, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { type Application } from "@/types/application"
import { KANBAN_COLUMN_ORDER } from "@/lib/constants"
import ApplicationTable from "@/components/dashboard/ApplicationTable"
import KanbanBoard from "@/components/dashboard/KanbanBoard"
import Sidebar from "@/components/dashboard/Sidebar"
import UnifiedHeader from "@/components/dashboard/UnifiedHeader"
import TableFooter from "@/components/dashboard/TableFooter"
import CommandPalette from "@/components/dashboard/CommandPalette"
import KeyboardCheatsheet from "@/components/dashboard/KeyboardCheatsheet"
import { useCommandPalette } from "@/components/dashboard/CommandPaletteProvider"
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts"
import { useUndoAction } from "@/lib/hooks/useUndoAction"
import { AnimatePresence } from "motion/react"
import { toast, undoToast } from "@/lib/toast"
import { STATUS_CONFIG } from "@/lib/constants"

interface Props {
  applications: Application[]
  onStatusChange: (id: string, prev: applicationStatus, next: applicationStatus) => Promise<void>
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onApproveReview: (id: string, status: applicationStatus) => Promise<void>
}

export default function DashboardContent({
  applications,
  onStatusChange,
  onUpdate,
  onDelete,
  onApproveReview,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view: "table" | "kanban" = searchParams.get("view") === "kanban" ? "kanban" : "table"
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<applicationStatus | "ALL">("ALL")
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const undo = useUndoAction()
  const { isOpen: paletteOpen, open: openPalette, close: closePalette } = useCommandPalette()

  const setView = useCallback(
    (next: "table" | "kanban") => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === "kanban") params.set("view", "kanban")
      else params.delete("view")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, pathname, searchParams],
  )

  const visibleApplications = useMemo(
    () => applications.filter((a) => !hiddenIds.has(a.id)),
    [applications, hiddenIds],
  )
  const nonReview = useMemo(
    () => visibleApplications.filter((a) => a.status !== applicationStatus.NEEDS_REVIEW),
    [visibleApplications],
  )
  const reviewItems = useMemo(
    () => visibleApplications.filter((a) => a.status === applicationStatus.NEEDS_REVIEW),
    [visibleApplications],
  )

  // Status counts for shared footer
  const counts = useMemo(() => {
    const c = {} as Record<applicationStatus, number>
    for (const s of Object.values(applicationStatus)) c[s] = 0
    for (const a of visibleApplications) c[a.status]++
    return c
  }, [visibleApplications])

  const selectedApp = useMemo(
    () => applications.find((a) => a.id === selectedId) ?? null,
    [applications, selectedId],
  )

  const selectedIndex = selectedApp ? nonReview.findIndex((a) => a.id === selectedApp.id) : -1
  const hasPrev = selectedIndex > 0
  const hasNext = selectedIndex >= 0 && selectedIndex < nonReview.length - 1

  const handlePrev = useCallback(() => {
    if (hasPrev) setSelectedId(nonReview[selectedIndex - 1].id)
  }, [hasPrev, selectedIndex, nonReview])

  const handleNext = useCallback(() => {
    if (hasNext) setSelectedId(nonReview[selectedIndex + 1].id)
  }, [hasNext, selectedIndex, nonReview])

  const handleUpdate = useCallback(async (id: string, patch: Record<string, unknown>) => {
    try {
      await onUpdate(id, patch)
      toast("Saved")
      router.refresh()
    } catch {
      toast.error("Failed to update")
    }
  }, [onUpdate, router])

  const handleStatusChange = useCallback(
    async (id: string, prev: applicationStatus, next: applicationStatus) => {
      try {
        await onStatusChange(id, prev, next)
        router.refresh()
        undoToast(`Status → ${STATUS_CONFIG[next].label}`, async () => {
          await onStatusChange(id, next, prev)
          router.refresh()
        })
      } catch {
        toast.error("Failed to change status")
      }
    },
    [onStatusChange, router],
  )

  const handleDelete = useCallback((id: string) => {
    const app = applications.find((a) => a.id === id)
    if (!app) return
    setHiddenIds((s) => new Set(s).add(id))
    if (selectedId === id) setSelectedId(null)
    undo.run(id, {
      message: `Deleted ${app.company}`,
      onCommit: async () => {
        try {
          await onDelete(id)
          router.refresh()
        } catch {
          toast.error("Failed to delete")
          setHiddenIds((s) => {
            const n = new Set(s)
            n.delete(id)
            return n
          })
        }
      },
      onUndo: () => {
        setHiddenIds((s) => {
          const n = new Set(s)
          n.delete(id)
          return n
        })
      },
    })
  }, [applications, onDelete, router, selectedId, undo])

  const handleDismiss = useCallback(async (id: string) => {
    try {
      await onDelete(id)
      toast("Review dismissed")
      router.refresh()
    } catch {
      toast.error("Failed to dismiss")
    }
  }, [onDelete, router])

  const handleApprove = useCallback(async (id: string, status: applicationStatus) => {
    try {
      await onApproveReview(id, status)
      router.refresh()
    } catch {
      toast.error("Failed to approve")
    }
  }, [onApproveReview, router])

  const shortcuts = useMemo(() => {
    const setStatus = (idx: number) => async () => {
      if (!selectedApp) return
      const next = KANBAN_COLUMN_ORDER[idx]
      if (!next || next === selectedApp.status) return
      await handleStatusChange(selectedApp.id, selectedApp.status, next)
    }
    return {
      j: () => {
        if (nonReview.length === 0) return
        if (selectedIndex < 0) setSelectedId(nonReview[0].id)
        else if (selectedIndex < nonReview.length - 1)
          setSelectedId(nonReview[selectedIndex + 1].id)
      },
      k: () => {
        if (nonReview.length === 0) return
        if (selectedIndex > 0) setSelectedId(nonReview[selectedIndex - 1].id)
      },
      t: () => setView("table"),
      g: () => setView("kanban"),
      d: () => {
        if (selectedApp) handleDelete(selectedApp.id)
      },
      "1": setStatus(0),
      "2": setStatus(1),
      "3": setStatus(2),
      "4": setStatus(3),
      "5": setStatus(4),
      "?": () => setCheatsheetOpen((v) => !v),
      y: () => {
        const first = reviewItems[0]
        if (first) handleApprove(first.id, applicationStatus.APPLIED)
      },
      n: () => {
        const first = reviewItems[0]
        if (first) handleDismiss(first.id)
      },
      Escape: () => {
        if (paletteOpen) closePalette()
        else if (cheatsheetOpen) setCheatsheetOpen(false)
        else if (selectedId) setSelectedId(null)
      },
    }
  }, [
    nonReview,
    reviewItems,
    selectedIndex,
    selectedApp,
    selectedId,
    setView,
    handleDelete,
    handleApprove,
    handleDismiss,
    handleStatusChange,
    paletteOpen,
    cheatsheetOpen,
    closePalette,
  ])

  useKeyboardShortcuts(shortcuts)

  return (
    <>
    <div className="flex flex-col h-full rounded-lg border border-border overflow-hidden">
      {/* Unified header spanning both panels */}
      <UnifiedHeader
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
      />

      {/* Content area: table + sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Table/Kanban panel */}
        <div className={`flex-1 overflow-y-auto ${selectedApp ? "border-r border-border" : ""}`}>
          {view === "kanban" ? (
            <KanbanBoard
              applications={visibleApplications}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onStatusChange={handleStatusChange}
              onApproveReview={handleApprove}
              onDismissReview={handleDismiss}
            />
          ) : (
            <ApplicationTable
              applications={visibleApplications}
              onStatusChange={handleStatusChange}
              onNotesSave={async () => {}}
              onApproveReview={handleApprove}
              onDismiss={handleDismiss}
              onDelete={handleDelete}
              onSelectApp={setSelectedId}
              selectedAppId={selectedId}
              filterStatus={filterStatus}
              onFilterChange={setFilterStatus}
            />
          )}
        </div>

        {/* Sidebar panel */}
        <AnimatePresence>
          {selectedApp && (
            <Sidebar
              app={selectedApp}
              onUpdate={handleUpdate}
              onPrev={handlePrev}
              onNext={handleNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
              onDelete={() => handleDelete(selectedApp.id)}
              onClose={() => setSelectedId(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Shared footer spanning both panels */}
      <TableFooter counts={counts} total={visibleApplications.length} />
    </div>

    <CommandPalette
      applications={nonReview}
      selectedId={selectedId}
      onSelectApp={setSelectedId}
      onStatusChange={handleStatusChange}
    />
    <KeyboardCheatsheet open={cheatsheetOpen} onClose={() => setCheatsheetOpen(false)} />
    </>
  )
}
