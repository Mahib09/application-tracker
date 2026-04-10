"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import ReviewCard, { type ReviewApplication } from "@/components/ReviewCard"
import { Kbd } from "@/components/ui/kbd"
import { CheckCheck, Sparkles } from "lucide-react"

interface Props {
  applications: ReviewApplication[]
  onApprove: (id: string, status: applicationStatus) => Promise<void>
  onDismiss: (id: string) => Promise<void>
  onBulkApprove: (ids: string[]) => Promise<void>
}

export default function ReviewQueue({ applications, onApprove, onDismiss, onBulkApprove }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const remaining = applications.filter((a) => !processedIds.has(a.id))
  const processedCount = processedIds.size
  const totalCount = applications.length

  // Keyboard shortcuts: A = approve top card, D = dismiss top card
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't fire if user is typing in an input/select/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (remaining.length === 0) return

      const top = remaining[0]
      if (e.key === "a" || e.key === "A") {
        e.preventDefault()
        handleApprove(top.id, applicationStatus.APPLIED)
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault()
        handleDismiss(top.id)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining])

  const handleApprove = async (id: string, status: applicationStatus) => {
    await onApprove(id, status)
    setProcessedIds((prev) => new Set(prev).add(id))
    router.refresh()
  }

  const handleDismiss = async (id: string) => {
    await onDismiss(id)
    setProcessedIds((prev) => new Set(prev).add(id))
    toast({ message: "Application dismissed", variant: "default" })
    router.refresh()
  }

  const handleBulkApprove = async () => {
    setBulkLoading(true)
    try {
      const ids = remaining.map((a) => a.id)
      await onBulkApprove(ids)
      setProcessedIds((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.add(id))
        return next
      })
      toast({ message: `Approved ${ids.length} application${ids.length !== 1 ? "s" : ""}`, variant: "success" })
      router.refresh()
    } finally {
      setBulkLoading(false)
    }
  }

  // All processed — show completion state
  if (remaining.length === 0 && totalCount > 0) {
    return (
      <div id="review-queue" className="mb-8">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Sparkles className="size-8 text-violet-400 mb-3" />
          <p className="text-sm font-medium text-slate-700">All caught up!</p>
          <p className="text-xs text-slate-400 mt-1">No items need your review.</p>
        </div>
      </div>
    )
  }

  // Nothing to review at all
  if (remaining.length === 0) return null

  return (
    <div id="review-queue" className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-900">
            {remaining.length} item{remaining.length !== 1 ? "s" : ""} need{remaining.length === 1 ? "s" : ""} your review
          </h2>
          {processedCount > 0 && (
            <span className="text-xs text-slate-400">
              {processedCount} of {totalCount} done
            </span>
          )}
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            <Kbd>A</Kbd> approve
            <Kbd>D</Kbd> dismiss
          </span>
        </div>
        {remaining.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkApprove}
            disabled={bulkLoading}
          >
            <CheckCheck className="size-3.5" data-icon="inline-start" />
            {bulkLoading ? "Approving..." : "Approve All"}
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {processedCount > 0 && (
        <div className="h-1 w-full rounded-full bg-slate-100 mb-4">
          <div
            className="h-1 rounded-full bg-violet-500 transition-all duration-300"
            style={{ width: `${(processedCount / totalCount) * 100}%` }}
          />
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {remaining.map((app) => (
          <ReviewCard
            key={app.id}
            application={app}
            onApprove={handleApprove}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  )
}
