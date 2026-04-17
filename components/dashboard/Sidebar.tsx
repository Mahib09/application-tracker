"use client"
import { useState, useEffect } from "react"
import { applicationStatus, applicationSource } from "@/app/generated/prisma/enums"
import { type Application, type StatusChangeRecord } from "@/types/application"
import { STATUS_CONFIG, STATUS_COLORS, STATUS_DISPLAY_ORDER } from "@/lib/constants"
import InlineEdit from "@/components/dashboard/InlineEdit"
import SidebarTimeline from "@/components/dashboard/SidebarTimeline"
import { Badge } from "@/components/ui/badge"
import { motion } from "motion/react"
import { useReducedMotion } from "@/lib/hooks/useReducedMotion"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"
import { ExternalLink } from "lucide-react"

interface Props {
  app: Application
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
}

export default function Sidebar({ app, onUpdate }: Props) {
  const [statusHistory, setStatusHistory] = useState<StatusChangeRecord[]>([])
  const [statusDropdown, setStatusDropdown] = useState(false)
  const reduced = useReducedMotion()
  const isMobile = useMediaQuery("(max-width: 767px)")

  const initial = reduced ? { opacity: 0 } : isMobile ? { y: "100%" } : { x: "100%" }
  const animate = reduced ? { opacity: 1 } : isMobile ? { y: 0 } : { x: 0 }
  const exitTo = reduced ? { opacity: 0 } : isMobile ? { y: "100%" } : { x: "100%" }
  const transition = reduced
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 400, damping: 35 } as const)

  useEffect(() => {
    fetch(`/api/applications/${app.id}/history`)
      .then((r) => r.json())
      .then((data) => setStatusHistory(data))
      .catch(() => setStatusHistory([]))
  }, [app.id])

  const handleStatusChange = (status: applicationStatus) => {
    setStatusDropdown(false)
    onUpdate(app.id, { status })
  }

  return (
      <motion.aside
        key="sidebar"
        initial={initial}
        animate={animate}
        exit={exitTo}
        transition={transition}
        className={
          isMobile
            ? "fixed inset-x-0 bottom-0 z-40 max-h-[85vh] rounded-t-2xl border-t border-border bg-card overflow-y-auto shadow-2xl"
            : "w-2/5 shrink-0 bg-card overflow-y-auto"
        }
      >
        {/* Body */}
        <div className="px-4 py-4 space-y-4">
          {/* Status */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <div className="relative">
              <button
                onClick={() => setStatusDropdown(!statusDropdown)}
                className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[app.status] }} />
                {STATUS_CONFIG[app.status].label}
              </button>
              {statusDropdown && (
                <div className="absolute top-full mt-1 left-0 z-20 rounded-lg border border-border bg-card shadow-lg py-1 min-w-36">
                  {STATUS_DISPLAY_ORDER.map((s) => (
                    <button
                      key={s}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left"
                      onClick={() => handleStatusChange(s)}
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Company */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Company</label>
            <InlineEdit
              value={app.company}
              onSave={(v) => onUpdate(app.id, { company: v })}
              className="text-sm font-medium text-foreground"
            />
          </div>

          {/* Role */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
            <InlineEdit
              value={app.roleTitle}
              onSave={(v) => onUpdate(app.id, { roleTitle: v })}
              className="text-sm text-foreground"
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
            <InlineEdit
              value={app.location ?? ""}
              onSave={(v) => onUpdate(app.id, { location: v })}
              placeholder="Add location"
              className="text-sm text-foreground"
            />
          </div>

          {/* Date Applied */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Date Applied</label>
            <span className="text-sm text-foreground">
              {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "—"}
            </span>
          </div>

          {/* Source */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Source</label>
            <Badge
              variant="outline"
              className={app.source === applicationSource.GMAIL
                ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800"
                : ""}
            >
              {app.source === applicationSource.GMAIL ? "Gmail" : "Manual"}
            </Badge>
          </div>

          {/* URL */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Job URL</label>
            {app.jobUrl ? (
              <a
                href={app.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {new URL(app.jobUrl).hostname}
                <ExternalLink className="size-3" />
              </a>
            ) : (
              <InlineEdit
                value=""
                onSave={(v) => onUpdate(app.id, { jobUrl: v })}
                placeholder="Add URL"
                className="text-sm"
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
            <InlineEdit
              value={app.notes ?? ""}
              onSave={(v) => onUpdate(app.id, { notes: v })}
              placeholder="Add notes..."
              as="textarea"
              className="text-sm text-foreground"
            />
          </div>

          {/* Confidence */}
          {app.confidence != null && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">AI Confidence</label>
              <span className="text-sm tabular-nums text-foreground">{Math.round(app.confidence * 100)}%</span>
            </div>
          )}

          {/* Timeline */}
          {statusHistory.length > 0 && (
            <div className="pt-2 border-t border-border">
              <label className="text-xs font-medium text-muted-foreground mb-3 block">Timeline</label>
              <SidebarTimeline history={statusHistory} />
            </div>
          )}
        </div>
      </motion.aside>
  )
}
