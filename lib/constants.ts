import { applicationStatus } from "@/app/generated/prisma/enums"

export const STATUS_CONFIG: Record<applicationStatus, { label: string; className: string; icon: string }> = {
  [applicationStatus.APPLIED]:      { label: "Applied",      className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50",       icon: "Send" },
  [applicationStatus.INTERVIEW]:    { label: "Interview",    className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50",   icon: "Calendar" },
  [applicationStatus.OFFER]:        { label: "Offer",        className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50", icon: "CheckCircle" },
  [applicationStatus.REJECTED]:     { label: "Rejected",     className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",           icon: "XCircle" },
  [applicationStatus.GHOSTED]:      { label: "Ghosted",      className: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-50", icon: "Clock" },
  [applicationStatus.NEEDS_REVIEW]: { label: "Needs Review", className: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-50", icon: "AlertCircle" },
}

/** Hex colors per status — used for borders, dots, charts */
export const STATUS_COLORS: Record<applicationStatus, string> = {
  [applicationStatus.APPLIED]:      "#3B82F6",
  [applicationStatus.INTERVIEW]:    "#F59E0B",
  [applicationStatus.OFFER]:        "#22C55E",
  [applicationStatus.REJECTED]:     "#EF4444",
  [applicationStatus.GHOSTED]:      "#8B5CF6",
  [applicationStatus.NEEDS_REVIEW]: "#7C3AED",
}

/** Display order for pipeline grouping (most actionable first) */
export const STATUS_DISPLAY_ORDER: applicationStatus[] = [
  applicationStatus.INTERVIEW,
  applicationStatus.APPLIED,
  applicationStatus.OFFER,
  applicationStatus.REJECTED,
  applicationStatus.GHOSTED,
]

/** Kanban column order (pipeline left-to-right) */
export const KANBAN_COLUMN_ORDER: applicationStatus[] = [
  applicationStatus.APPLIED,
  applicationStatus.INTERVIEW,
  applicationStatus.OFFER,
  applicationStatus.REJECTED,
  applicationStatus.GHOSTED,
]
