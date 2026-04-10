"use client"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { STATUS_CONFIG } from "@/lib/constants"
import { AlertCircle } from "lucide-react"

interface Application { status: applicationStatus }
interface Props {
  applications: Application[]
}

function scrollToReviewQueue() {
  document.getElementById("review-queue")?.scrollIntoView({ behavior: "smooth" })
}

export default function StatsBar({ applications }: Props) {
  const counts = Object.values(applicationStatus).reduce(
    (acc, s) => { acc[s] = applications.filter((a) => a.status === s).length; return acc },
    {} as Record<applicationStatus, number>,
  )

  const needsReviewCount = counts[applicationStatus.NEEDS_REVIEW]

  return (
    <Card className="mb-6">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums text-2xl font-semibold text-slate-900">{applications.length}</span>
            <span className="text-sm text-slate-500">Total</span>
          </div>
          <div className="w-px h-6 bg-slate-200" />

          {/* NEEDS_REVIEW badge — prominent + clickable */}
          {needsReviewCount > 0 && (
            <>
              <button
                onClick={scrollToReviewQueue}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold bg-violet-100 text-violet-700 border border-violet-300 hover:bg-violet-200 transition-colors cursor-pointer"
              >
                <AlertCircle className="size-3.5" />
                <span className="tabular-nums">{needsReviewCount}</span>
                <span>Need Review</span>
              </button>
              <div className="w-px h-6 bg-slate-200" />
            </>
          )}

          {/* Other status badges */}
          {Object.values(applicationStatus)
            .filter((s) => s !== applicationStatus.NEEDS_REVIEW)
            .map((s) => (
              <Badge
                key={s}
                variant="outline"
                data-testid={`stat-${s}`}
                className={`gap-1.5 tabular-nums ${STATUS_CONFIG[s].className}`}
              >
                <span>{counts[s]}</span>
                <span>{STATUS_CONFIG[s].label}</span>
              </Badge>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}
