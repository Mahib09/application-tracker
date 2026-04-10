"use client"

import { useState } from "react"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { STATUS_CONFIG } from "@/lib/constants"
import { Check, Pencil, X, MapPin, Calendar, Building2 } from "lucide-react"

export interface ReviewApplication {
  id: string
  company: string
  roleTitle: string
  status: applicationStatus
  appliedAt: Date | null
  location: string | null
  confidence: number | null
}

interface Props {
  application: ReviewApplication
  onApprove: (id: string, status: applicationStatus) => Promise<void>
  onDismiss: (id: string) => Promise<void>
}

export default function ReviewCard({ application, onApprove, onDismiss }: Props) {
  const [editing, setEditing] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<applicationStatus>(applicationStatus.APPLIED)
  const [loading, setLoading] = useState(false)

  const confidencePercent = application.confidence != null
    ? Math.round(application.confidence * 100)
    : null

  const handleApprove = async () => {
    setLoading(true)
    try {
      await onApprove(application.id, editing ? selectedStatus : applicationStatus.APPLIED)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = async () => {
    setLoading(true)
    try {
      await onDismiss(application.id)
    } finally {
      setLoading(false)
    }
  }

  const editableStatuses = [
    applicationStatus.APPLIED,
    applicationStatus.INTERVIEW,
    applicationStatus.OFFER,
    applicationStatus.REJECTED,
  ]

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: application info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-900 truncate">{application.company}</span>
            </div>
            <p className="text-sm text-slate-600 truncate">{application.roleTitle}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {application.appliedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {new Date(application.appliedAt).toLocaleDateString()}
                </span>
              )}
              {application.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {application.location}
                </span>
              )}
            </div>
            {confidencePercent != null && (
              <div className="flex items-center gap-2 pt-1">
                <Progress value={confidencePercent} className="w-24" />
                <span className="text-xs text-slate-400">{confidencePercent}%</span>
              </div>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as applicationStatus)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {editableStatuses.map((s) => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
                <Button
                  variant="success"
                  size="xs"
                  onClick={handleApprove}
                  disabled={loading}
                >
                  <Check className="size-3" data-icon="inline-start" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setEditing(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="success"
                  size="sm"
                  onClick={handleApprove}
                  disabled={loading}
                >
                  <Check className="size-3.5" data-icon="inline-start" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                  disabled={loading}
                >
                  <Pencil className="size-3.5" data-icon="inline-start" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  disabled={loading}
                  className="text-slate-400 hover:text-red-600"
                >
                  <X className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
