"use client"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

interface Application { status: applicationStatus }
interface Props { applications: Application[] }

const STATUS_CONFIG: Record<applicationStatus, { label: string; className: string }> = {
  [applicationStatus.APPLIED]:      { label: "Applied",      className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50" },
  [applicationStatus.INTERVIEW]:    { label: "Interview",    className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50" },
  [applicationStatus.OFFER]:        { label: "Offer",        className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50" },
  [applicationStatus.REJECTED]:     { label: "Rejected",     className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50" },
  [applicationStatus.GHOSTED]:      { label: "Ghosted",      className: "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-50" },
  [applicationStatus.NEEDS_REVIEW]: { label: "Needs Review", className: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-50" },
}

export default function StatsBar({ applications }: Props) {
  const counts = Object.values(applicationStatus).reduce(
    (acc, s) => { acc[s] = applications.filter((a) => a.status === s).length; return acc },
    {} as Record<applicationStatus, number>,
  )

  return (
    <Card className="mb-6">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums text-2xl font-semibold text-slate-900">{applications.length}</span>
            <span className="text-sm text-slate-500">Total</span>
          </div>
          <div className="w-px h-6 bg-slate-200" />
          {Object.values(applicationStatus).map((s) => (
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
