"use client"

import { applicationStatus, applicationSource } from "@/app/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { STATUS_CONFIG } from "@/lib/constants"
import { MapPin, ExternalLink, Mail, Pencil, Bot } from "lucide-react"

export interface DetailApplication {
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
}

interface Props {
  app: DetailApplication
  currentStatus: applicationStatus
  currentNotes: string
  onStatusChange: (next: applicationStatus) => void
  onNotesSave: (notes: string) => void
  onClose: () => void
}

export default function ApplicationDetail({
  app,
  currentStatus,
  currentNotes,
  onStatusChange,
  onNotesSave,
  onClose,
}: Props) {
  const confidencePercent = app.confidence != null ? Math.round(app.confidence * 100) : null

  return (
    <div className="grid grid-cols-2 gap-6 p-4">
      {/* Left column: metadata */}
      <div className="space-y-3">
        {app.location && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="size-3.5 text-slate-400 shrink-0" />
            {app.location}
          </div>
        )}
        {app.jobUrl && (
          <div className="flex items-center gap-2 text-sm">
            <ExternalLink className="size-3.5 text-slate-400 shrink-0" />
            <a
              href={app.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline truncate max-w-[200px]"
            >
              View job posting
            </a>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Mail className="size-3.5 text-slate-400 shrink-0" />
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
          {app.manuallyEdited && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Pencil className="size-3" />
              Edited
            </span>
          )}
        </div>
        {confidencePercent != null && (
          <div className="flex items-center gap-2 text-sm">
            <Bot className="size-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-2 flex-1">
              <Progress value={confidencePercent} className="w-20" />
              <span className="text-xs text-slate-400">{confidencePercent}% confidence</span>
            </div>
          </div>
        )}
        {/* Quick status change */}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-slate-500">Status:</span>
          <select
            aria-label="Change status"
            value={currentStatus}
            onChange={(e) => onStatusChange(e.target.value as applicationStatus)}
            className={`rounded-full px-2 py-0.5 text-xs font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 ${STATUS_CONFIG[currentStatus].className}`}
          >
            {Object.values(applicationStatus)
              .filter((s) => s !== applicationStatus.NEEDS_REVIEW)
              .map((s) => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
          </select>
        </div>
      </div>

      {/* Right column: notes */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5">Notes</p>
        <Textarea
          autoFocus
          defaultValue={currentNotes}
          rows={4}
          placeholder="Add notes about this application…"
          className="resize-none text-sm w-full"
          onBlur={(e) => {
            if (e.target.value !== currentNotes) onNotesSave(e.target.value)
            onClose()
          }}
        />
      </div>
    </div>
  )
}
