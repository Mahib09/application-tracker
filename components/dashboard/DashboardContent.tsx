"use client"
import { useState, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { type Application } from "@/types/application"
import { KANBAN_COLUMN_ORDER } from "@/lib/constants"
import ApplicationTable from "@/components/dashboard/ApplicationTable"
import KanbanBoard from "@/components/dashboard/KanbanBoard"
import Sidebar from "@/components/dashboard/Sidebar"
import CommandPalette from "@/components/dashboard/CommandPalette"
import KeyboardCheatsheet from "@/components/dashboard/KeyboardCheatsheet"
import WeeklySummary from "@/components/dashboard/WeeklySummary"
import { useCommandPalette } from "@/components/dashboard/CommandPaletteProvider"
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts"
import { useUndoAction } from "@/lib/hooks/useUndoAction"
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
      router.refresh()
    } catch {
      toast.error("Failed to update")
    }
  }, [onUpdate, router])

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
      const prev = selectedApp.status
      const appId = selectedApp.id
      try {
        await onStatusChange(appId, prev, next)
        router.refresh()
        undoToast(`Status → ${STATUS_CONFIG[next].label}`, async () => {
          await onStatusChange(appId, next, prev)
          router.refresh()
        })
      } catch {
        toast.error("Failed to change status")
      }
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
    onStatusChange,
    router,
    paletteOpen,
    cheatsheetOpen,
    closePalette,
  ])

  useKeyboardShortcuts(shortcuts)

  return (
    <div className="py-4">
    <div className="mb-4">
      <WeeklySummary applications={visibleApplications} />
    </div>
    <div className="flex flex-col md:flex-row gap-4">
      <div className={selectedApp ? "w-full md:w-3/5 transition-[width] duration-200" : "w-full"}>
        {view === "kanban" ? (
          <KanbanBoard
            applications={visibleApplications}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onStatusChange={onStatusChange}
            onApproveReview={handleApprove}
            onDismissReview={handleDismiss}
          />
        ) : (
          <ApplicationTable
            applications={visibleApplications}
            onStatusChange={onStatusChange}
            onNotesSave={async () => {}}
            onApproveReview={handleApprove}
            onDismiss={handleDismiss}
            onDelete={handleDelete}
            onSelectApp={setSelectedId}
            selectedAppId={selectedId}
          />
        )}
      </div>

      {selectedApp && (
        <div className="w-full md:w-2/5 min-h-[60vh]">
          <Sidebar
            key={selectedApp.id}
            app={selectedApp}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onClose={() => setSelectedId(null)}
            onPrev={handlePrev}
            onNext={handleNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
          />
        </div>
      )}

      <CommandPalette
        applications={nonReview}
        selectedId={selectedId}
        onSelectApp={setSelectedId}
        onStatusChange={onStatusChange}
      />
      <KeyboardCheatsheet open={cheatsheetOpen} onClose={() => setCheatsheetOpen(false)} />
    </div>
    </div>
  )
}
