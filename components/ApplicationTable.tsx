"use client"
import { useState, useCallback } from "react"
import { applicationStatus, applicationSource } from "@/app/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

export interface Application {
  id: string
  company: string
  roleTitle: string
  status: applicationStatus
  source: applicationSource
  appliedAt: Date | null
  location: string | null
  notes: string | null
  gmailMessageId: string | null
}

interface Props {
  applications: Application[]
  onStatusChange: (id: string, prev: applicationStatus, next: applicationStatus) => Promise<void>
  onNotesSave: (id: string, notes: string) => Promise<void>
}

const STATUS_CONFIG: Record<applicationStatus, { label: string; className: string }> = {
  [applicationStatus.APPLIED]:      { label: "Applied",      className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50" },
  [applicationStatus.INTERVIEW]:    { label: "Interview",    className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50" },
  [applicationStatus.OFFER]:        { label: "Offer",        className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50" },
  [applicationStatus.REJECTED]:     { label: "Rejected",     className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50" },
  [applicationStatus.GHOSTED]:      { label: "Ghosted",      className: "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-50" },
  [applicationStatus.NEEDS_REVIEW]: { label: "Needs Review", className: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-50" },
}

type SortKey = "company" | "roleTitle" | "status" | "appliedAt"

export default function ApplicationTable({ applications, onStatusChange, onNotesSave }: Props) {
  const [filterStatus, setFilterStatus] = useState<applicationStatus | "ALL">("ALL")
  const [sortKey, setSortKey] = useState<SortKey>("appliedAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [statusOverrides, setStatusOverrides] = useState<Record<string, applicationStatus>>({})
  const [notesOverrides, setNotesOverrides] = useState<Record<string, string>>({})
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("asc") }
  }

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

  const filtered = applications.filter(
    (a) => filterStatus === "ALL" || (statusOverrides[a.id] ?? a.status) === filterStatus,
  )
  const sorted = [...filtered].sort((a, b) => {
    const va = sortKey === "appliedAt"
      ? (a.appliedAt?.getTime() ?? 0)
      : ((statusOverrides[a.id] ?? a[sortKey] ?? "") as string | number)
    const vb = sortKey === "appliedAt"
      ? (b.appliedAt?.getTime() ?? 0)
      : ((statusOverrides[b.id] ?? b[sortKey] ?? "") as string | number)
    if (va < vb) return sortDir === "asc" ? -1 : 1
    if (va > vb) return sortDir === "asc" ? 1 : -1
    return 0
  })

  const SortIndicator = ({ k }: { k: SortKey }) => (
    <span className="ml-1 text-slate-400">{sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
  )

  return (
    <div>
      <div className="mb-4">
        <select
          aria-label="Filter by status"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as applicationStatus | "ALL")}
        >
          <option value="ALL">All statuses</option>
          {Object.values(applicationStatus).map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-slate-400 text-sm">No applications yet. Click Sync Now to import from Gmail.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {(["company", "roleTitle", "status", "appliedAt"] as SortKey[]).map((k) => (
                    <TableHead
                      key={k}
                      className="cursor-pointer select-none hover:text-slate-900"
                      onClick={() => handleSort(k)}
                    >
                      {k === "roleTitle" ? "Role" : k === "appliedAt" ? "Date" : k.charAt(0).toUpperCase() + k.slice(1)}
                      <SortIndicator k={k} />
                    </TableHead>
                  ))}
                  <TableHead>Notes</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.flatMap((app) => {
                  const currentStatus = statusOverrides[app.id] ?? app.status
                  const currentNotes = notesOverrides[app.id] !== undefined
                    ? notesOverrides[app.id]
                    : (app.notes ?? "")
                  const isExpanded = expandedNotes === app.id

                  return [
                    <TableRow key={app.id}>
                      <TableCell className="font-medium text-slate-900">{app.company}</TableCell>
                      <TableCell className="text-slate-700">{app.roleTitle}</TableCell>
                      <TableCell>
                        <select
                          aria-label="status"
                          value={currentStatus}
                          onChange={(e) =>
                            handleStatusChange(app.id, currentStatus, e.target.value as applicationStatus)
                          }
                          className={`rounded-full px-2 py-0.5 text-xs font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 ${STATUS_CONFIG[currentStatus].className}`}
                        >
                          {Object.values(applicationStatus).map((s) => (
                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <button
                          className="text-slate-400 hover:text-slate-600 text-xs text-left focus:outline-none focus:underline"
                          onClick={() => setExpandedNotes(isExpanded ? null : app.id)}
                        >
                          {currentNotes
                            ? currentNotes.slice(0, 30) + (currentNotes.length > 30 ? "…" : "")
                            : <span className="text-slate-300">Add note</span>}
                        </button>
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
                          {app.source}
                        </Badge>
                      </TableCell>
                    </TableRow>,
                    isExpanded && (
                      <TableRow key={`${app.id}-notes`} className="bg-slate-50">
                        <TableCell colSpan={7} className="pb-3">
                          <Textarea
                            autoFocus
                            defaultValue={currentNotes}
                            rows={3}
                            placeholder="Add notes…"
                            className="resize-none text-sm"
                            onBlur={(e) => {
                              if (e.target.value !== currentNotes) handleNotesSave(app.id, e.target.value)
                              setExpandedNotes(null)
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ),
                  ].filter(Boolean)
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
