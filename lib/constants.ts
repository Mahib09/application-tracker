import { applicationStatus } from "@/app/generated/prisma/enums"

export const STATUS_CONFIG: Record<applicationStatus, { label: string; className: string }> = {
  [applicationStatus.APPLIED]:      { label: "Applied",      className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50" },
  [applicationStatus.INTERVIEW]:    { label: "Interview",    className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50" },
  [applicationStatus.OFFER]:        { label: "Offer",        className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50" },
  [applicationStatus.REJECTED]:     { label: "Rejected",     className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50" },
  [applicationStatus.GHOSTED]:      { label: "Ghosted",      className: "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-50" },
  [applicationStatus.NEEDS_REVIEW]: { label: "Needs Review", className: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-50" },
}

/** Display order for pipeline grouping (most actionable first) */
export const STATUS_DISPLAY_ORDER: applicationStatus[] = [
  applicationStatus.INTERVIEW,
  applicationStatus.APPLIED,
  applicationStatus.OFFER,
  applicationStatus.REJECTED,
  applicationStatus.GHOSTED,
]
