"use client"
import { useState, useCallback } from "react"
import { applicationStatus, applicationSource } from "@/app/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { STATUS_CONFIG, STATUS_DISPLAY_ORDER } from "@/lib/constants"
import { EmptyState } from "@/components/ui/empty-state"
import ApplicationDetail from "@/components/ApplicationDetail"
import { Inbox, ChevronDown, ChevronRight } from "lucide-react"

export interface Application {
  id: string
  company: string
  roleTitle: string
  status: applicationStatus
  source: applicationSource
  appliedAt: Date | null
  location: string | null
  notes: string | null
  confidence: number | null
  jobUrl: string | null
  manuallyEdited: boolean
  sourceEmailId: string | null
}

interface Props {
  applications: Application[]
  onStatusChange: (id: string, prev: applicationStatus, next: applicationStatus) => Promise<void>
  onNotesSave: (id: string, notes: string) => Promise<void>
}

export default function ApplicationTable({ applications, onStatusChange, onNotesSave }: Props) {
  const [filterStatus, setFilterStatus] = useState<applicationStatus | "ALL">("ALL")
  const [statusOverrides, setStatusOverrides] = useState<Record<string, applicationStatus>>({})
  const [notesOverrides, setNotesOverrides] = useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<applicationStatus>>(new Set())

  const handleStatusChange = useCallback(
    async (id: string, prev: applicationStatus, next: applicationStatus) => {
      setStatusOverrides((s) => ({ ...s, [id]: next }))
      try { await onStatusChange(id, prev, next) }
      catch { setStatusOverrides((s) => ({ ...s, [id]: prev })) }
    },
    [onStatusChange],
  )

  const handleNotesSave = useCallback(
    async (id: string, notes: string) => {
      const original = notesOverrides[id]
      setNotesOverrides((s) => ({ ...s, [id]: notes }))
      try { await onNotesSave(id, notes) }
      catch {
        setNotesOverrides((s) =>
          original !== undefined
            ? { ...s, [id]: original }
            : (() => { const n = { ...s }; delete n[id]; return n })()
        )
      }
    },
    [onNotesSave, notesOverrides],
  )

  const toggleGroup = (status: applicationStatus) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  // NEEDS_REVIEW items live in ReviewQueue, not here
  const nonReview = applications.filter(
    (a) => (statusOverrides[a.id] ?? a.status) !== applicationStatus.NEEDS_REVIEW,
  )
  const filtered = nonReview.filter(
    (a) => filterStatus === "ALL" || (statusOverrides[a.id] ?? a.status) === filterStatus,
  )

  // Group by status in pipeline order
  const grouped = STATUS_DISPLAY_ORDER.map((status) => ({
    status,
    items: filtered
      .filter((a) => (statusOverrides[a.id] ?? a.status) === status)
      .sort((a, b) => (b.appliedAt?.getTime() ?? 0) - (a.appliedAt?.getTime() ?? 0)),
  })).filter(({ items }) => items.length > 0)

  if (filtered.length === 0) {
    return (
      <div>
        <FilterBar filterStatus={filterStatus} onChange={setFilterStatus} />
        <EmptyState
          icon={<Inbox className="size-8" />}
          title="No applications yet"
          description="Click Sync Now to import from Gmail, or wait for the next automatic sync."
        />
      </div>
    )
  }

  return (
    <div>
      <FilterBar filterStatus={filterStatus} onChange={setFilterStatus} />
      <div className="space-y-4">
        {grouped.map(({ status, items }) => {
          const isCollapsed = collapsedGroups.has(status)
          const cfg = STATUS_CONFIG[status]
          return (
            <Card key={status}>
              {/* Group header */}
              <button
                className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors rounded-t-[inherit]"
                onClick={() => toggleGroup(status)}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed
                    ? <ChevronRight className="size-4 text-slate-400" />
                    : <ChevronDown className="size-4 text-slate-400" />
                  }
                  <Badge variant="outline" className={`${cfg.className} text-xs`}>
                    {cfg.label}
                  </Badge>
                  <span className="text-xs text-slate-400">{items.length}</span>
                </div>
              </button>

              {!isCollapsed && (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.flatMap((app) => {
                        const currentStatus = statusOverrides[app.id] ?? app.status
                        const currentNotes = notesOverrides[app.id] !== undefined
                          ? notesOverrides[app.id]
                          : (app.notes ?? "")
                        const isExpanded = expandedId === app.id

                        return [
                          <TableRow
                            key={app.id}
                            className={isExpanded ? "bg-slate-50 border-b-0" : "cursor-pointer"}
                            onClick={() => setExpandedId(isExpanded ? null : app.id)}
                          >
                            <TableCell className="font-medium text-slate-900">{app.company}</TableCell>
                            <TableCell className="text-slate-700">{app.roleTitle}</TableCell>
                            <TableCell className="text-slate-500">
                              {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "—"}
                            </TableCell>
                            <TableCell className="text-slate-500">{app.location ?? "—"}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  app.source === applicationSource.GMAIL
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                }
                              >
                                {app.source === applicationSource.GMAIL ? "Gmail" : "Manual"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-slate-400 max-w-35 truncate">
                              {currentNotes
                                ? currentNotes.slice(0, 40) + (currentNotes.length > 40 ? "…" : "")
                                : <span className="text-slate-300">—</span>}
                            </TableCell>
                          </TableRow>,
                          isExpanded && (
                            <TableRow key={`${app.id}-detail`} className="bg-slate-50 hover:bg-slate-50">
                              <TableCell colSpan={6} className="p-0 border-t border-slate-100">
                                <ApplicationDetail
                                  app={app}
                                  currentStatus={currentStatus}
                                  currentNotes={currentNotes}
                                  onStatusChange={(next) => handleStatusChange(app.id, currentStatus, next)}
                                  onNotesSave={(notes) => handleNotesSave(app.id, notes)}
                                  onClose={() => setExpandedId(null)}
                                />
                              </TableCell>
                            </TableRow>
                          ),
                        ].filter(Boolean)
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function FilterBar({
  filterStatus,
  onChange,
}: {
  filterStatus: applicationStatus | "ALL"
  onChange: (v: applicationStatus | "ALL") => void
}) {
  return (
    <div className="mb-4">
      <select
        aria-label="Filter by status"
        className="rounded-md border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={filterStatus}
        onChange={(e) => onChange(e.target.value as applicationStatus | "ALL")}
      >
        <option value="ALL">All statuses</option>
        {STATUS_DISPLAY_ORDER.map((s) => (
          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
        ))}
      </select>
    </div>
  )
}
