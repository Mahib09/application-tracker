"use client"
import { useState, useCallback, useMemo } from "react"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { STATUS_COLORS, STATUS_CONFIG } from "@/lib/constants"
import { type Application } from "@/types/application"
import BulkActionBar from "@/components/dashboard/BulkActionBar"
import RowContextMenu from "@/components/dashboard/RowContextMenu"
import { Button } from "@/components/ui/button"
import { Check, X, ArrowUp, ArrowDown } from "lucide-react"

type SortField = "company" | "roleTitle" | "appliedAt" | "daysSince"
type SortDir = "asc" | "desc"

interface Props {
  applications: Application[]
  onStatusChange: (id: string, prev: applicationStatus, next: applicationStatus) => Promise<void>
  onNotesSave: (id: string, notes: string) => Promise<void>
  onApproveReview: (id: string, status: applicationStatus) => Promise<void>
  onDismiss: (id: string) => Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onSelectApp: (id: string) => void
  selectedAppId: string | null
  filterStatus: applicationStatus | "ALL"
  onFilterChange: (status: applicationStatus | "ALL") => void
}

function relativeDate(date: Date | null): string {
  if (!date) return "—"
  const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return "Today"
  if (days === 1) return "1d ago"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function daysSince(date: Date | null): number {
  if (!date) return 0
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

export default function ApplicationTable({
  applications,
  onStatusChange,
  onApproveReview,
  onDismiss,
  onDelete,
  onSelectApp,
  selectedAppId,
  filterStatus,
  onFilterChange,
}: Props) {
  const [sortField, setSortField] = useState<SortField>("appliedAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [statusOverrides, setStatusOverrides] = useState<Record<string, applicationStatus>>({})
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; appId: string } | null>(null)

  const effectiveStatus = (app: Application) => statusOverrides[app.id] ?? app.status

  // Separate review items from regular items
  const reviewItems = applications.filter((a) => effectiveStatus(a) === applicationStatus.NEEDS_REVIEW)
  const regularItems = applications.filter((a) => effectiveStatus(a) !== applicationStatus.NEEDS_REVIEW)

  // Filter
  const filtered = filterStatus === "ALL"
    ? regularItems
    : regularItems.filter((a) => effectiveStatus(a) === filterStatus)

  // Sort
  const sorted = useMemo(() => {
    const items = [...filtered]
    items.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "company": cmp = a.company.localeCompare(b.company); break
        case "roleTitle": cmp = a.roleTitle.localeCompare(b.roleTitle); break
        case "appliedAt": cmp = (a.appliedAt?.getTime() ?? 0) - (b.appliedAt?.getTime() ?? 0); break
        case "daysSince": cmp = daysSince(a.appliedAt) - daysSince(b.appliedAt); break
      }
      return sortDir === "desc" ? -cmp : cmp
    })
    return items
  }, [filtered, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortField(field); setSortDir("desc") }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkStatusChange = async (status: applicationStatus) => {
    const ids = Array.from(selected)
    for (const id of ids) {
      const app = applications.find((a) => a.id === id)
      if (app) {
        setStatusOverrides((s) => ({ ...s, [id]: status }))
        await onStatusChange(id, effectiveStatus(app), status)
      }
    }
    setSelected(new Set())
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selected)
    for (const id of ids) await onDelete(id)
    setSelected(new Set())
  }

  const handleRowStatusChange = useCallback(async (id: string, next: applicationStatus) => {
    const app = applications.find((a) => a.id === id)
    if (!app) return
    const prev = effectiveStatus(app)
    setStatusOverrides((s) => ({ ...s, [id]: next }))
    try { await onStatusChange(id, prev, next) }
    catch { setStatusOverrides((s) => ({ ...s, [id]: prev })) }
  }, [applications, onStatusChange, statusOverrides])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === "asc"
      ? <ArrowUp className="size-3 inline ml-1" />
      : <ArrowDown className="size-3 inline ml-1" />
  }

  const anySelected = selected.size > 0

  return (
    <div className="bg-card overflow-hidden">
      {/* Review items */}
      {reviewItems.length > 0 && (
        <div className="border-b border-border bg-violet-50/50 dark:bg-violet-950/20">
          <div className="px-4 py-2 text-xs font-medium text-violet-700 dark:text-violet-300">
            {reviewItems.length} item{reviewItems.length !== 1 ? "s" : ""} need review
          </div>
          {reviewItems.map((app) => (
            <div
              key={app.id}
              className="flex items-center justify-between px-4 py-2 border-t border-violet-100 dark:border-violet-900/30 hover:bg-violet-50/80 dark:hover:bg-violet-950/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm text-foreground">{app.company}</span>
                <span className="text-sm text-muted-foreground">{app.roleTitle}</span>
                {app.confidence != null && (
                  <span className="text-xs text-violet-600 dark:text-violet-400 tabular-nums">
                    {Math.round(app.confidence * 100)}% confidence
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="success"
                  size="xs"
                  onClick={() => onApproveReview(app.id, applicationStatus.APPLIED)}
                >
                  <Check className="size-3" />
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onDismiss(app.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="w-10 px-2 py-2.5" />
              <th className="text-left px-3 py-2.5 font-medium cursor-pointer select-none" onClick={() => toggleSort("company")}>
                Company<SortIcon field="company" />
              </th>
              <th className="text-left px-3 py-2.5 font-medium cursor-pointer select-none" onClick={() => toggleSort("roleTitle")}>
                Role<SortIcon field="roleTitle" />
              </th>
              <th className="text-left px-3 py-2.5 font-medium">Status</th>
              <th className="text-left px-3 py-2.5 font-medium cursor-pointer select-none" onClick={() => toggleSort("appliedAt")}>
                Date Applied<SortIcon field="appliedAt" />
              </th>
              <th className="hidden lg:table-cell text-left px-3 py-2.5 font-medium cursor-pointer select-none" onClick={() => toggleSort("daysSince")}>
                Days Since<SortIcon field="daysSince" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && reviewItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {filterStatus === "ALL"
                    ? "No applications yet."
                    : (
                      <>
                        No applications match this filter.{" "}
                        <button
                          className="underline underline-offset-2 hover:text-foreground"
                          onClick={() => onFilterChange("ALL")}
                        >
                          Clear filter
                        </button>
                      </>
                    )}
                </td>
              </tr>
            )}
            {sorted.map((app, i) => {
              const status = effectiveStatus(app)
              const isSelected = selected.has(app.id)
              const isActive = selectedAppId === app.id
              const days = daysSince(app.appliedAt)
              const ghostWarning = status === applicationStatus.APPLIED && days >= 20
              const stagger = Math.min(i, 12) * 20

              return (
                <tr
                  key={app.id}
                  className={`
                    border-b border-border/50 cursor-pointer transition-colors
                    animate-in fade-in slide-in-from-bottom-1 duration-200
                    ${isActive ? "bg-muted/70" : "hover:bg-muted/40"}
                    ${anySelected ? "" : "group"}
                  `}
                  style={{ borderLeft: `3px solid ${STATUS_COLORS[status]}`, animationDelay: `${stagger}ms` }}
                  onClick={() => onSelectApp(app.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ x: e.clientX, y: e.clientY, appId: app.id })
                  }}
                >
                  {/* Checkbox */}
                  <td className="px-2 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(app.id) }}
                      onClick={(e) => e.stopPropagation()}
                      className={`size-3.5 rounded border-border ${anySelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                    />
                  </td>

                  <td className="px-3 py-2.5 font-medium text-foreground">{app.company}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{app.roleTitle}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[status] }} />
                      <span className="text-muted-foreground">{STATUS_CONFIG[status].label}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground" title={app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : undefined}>
                    {relativeDate(app.appliedAt)}
                  </td>
                  <td className={`hidden lg:table-cell px-3 py-2.5 tabular-nums ${ghostWarning ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
                    {days > 0 ? `${days}d` : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        count={selected.size}
        onChangeStatus={handleBulkStatusChange}
        onDelete={handleBulkDelete}
        onDeselect={() => setSelected(new Set())}
      />

      {/* Context menu */}
      {contextMenu && (
        <RowContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={() => onSelectApp(contextMenu.appId)}
          onChangeStatus={(s) => handleRowStatusChange(contextMenu.appId, s)}
          onDelete={() => onDelete(contextMenu.appId)}
        />
      )}
    </div>
  )
}

