import { STATUS_COLORS, STATUS_CONFIG } from "@/lib/constants"
import { applicationStatus } from "@/app/generated/prisma/enums"

export type EmailCardProps = {
  id: string
  company: string
  subject: string
  snippet: string
  status: applicationStatus
  daysAgo: number
  variant: "inbox" | "kanban"
}

const INITIALS_COLORS: Record<string, string> = {
  Stripe: "#635BFF",
  Linear: "#5E6AD2",
  Vercel: "#000000",
  Anthropic: "#D97757",
}

function Avatar({ company }: { company: string }) {
  const bg = INITIALS_COLORS[company] ?? "#6366F1"
  return (
    <span
      className="inline-flex shrink-0 size-8 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: bg }}
    >
      {company[0]}
    </span>
  )
}

function StatusPill({ status }: { status: applicationStatus }) {
  const color = STATUS_COLORS[status]
  const label = STATUS_CONFIG[status].label
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
      style={{ backgroundColor: `${color}30`, border: `1px solid ${color}60` }}
    >
      <span
        className="inline-block size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}

export default function EmailCard({
  company,
  subject,
  snippet,
  status,
  daysAgo,
  variant,
}: Omit<EmailCardProps, "id">) {
  if (variant === "inbox") {
    return (
      <div className="flex items-start gap-3 px-4 py-3 border-b border-white/6 last:border-0">
        <Avatar company={company} />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-medium text-white/90 truncate">
              {company}
            </span>
            <span className="text-[11px] text-white/35 shrink-0 ml-2 font-mono">
              {daysAgo}d
            </span>
          </div>
          <p className="text-xs text-white/55 truncate mt-0.5">{subject}</p>
          <p className="text-xs text-white/30 truncate mt-0.5">{snippet}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/4 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Avatar company={company} />
        <span className="text-sm font-medium text-white/90">{company}</span>
      </div>
      <p className="text-xs text-white/50 leading-relaxed line-clamp-2">
        {snippet}
      </p>
      <StatusPill status={status} />
    </div>
  )
}
