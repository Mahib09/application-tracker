import { type Application, type StatusChangeRecord } from "@/types/application"
import { applicationStatus, applicationSource } from "@/app/generated/prisma/enums"

const MS_PER_DAY = 1000 * 60 * 60 * 24

// ─── Response rate ────────────────────────────────────────────────────────────

export function computeResponseRate(
  applications: Application[],
  windowDays: number,
  now = new Date()
) {
  const cutoff = new Date(now.getTime() - windowDays * MS_PER_DAY)
  const inWindow = applications.filter(
    (a) => a.appliedAt && new Date(a.appliedAt) >= cutoff
  )
  const responded = inWindow.filter((a) =>
    a.status === applicationStatus.INTERVIEW ||
    a.status === applicationStatus.OFFER ||
    a.status === applicationStatus.REJECTED
  )
  const total = inWindow.length
  return {
    total,
    responded: responded.length,
    rate: total === 0 ? 0 : responded.length / total,
  }
}

// ─── Ghost rate ───────────────────────────────────────────────────────────────

export function computeGhostRate(applications: Application[], now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * MS_PER_DAY)
  const eligible = applications.filter(
    (a) => a.appliedAt && new Date(a.appliedAt) < cutoff
  )
  const ghosted = eligible.filter((a) => a.status === applicationStatus.GHOSTED)
  const total = eligible.length
  return {
    eligible: total,
    ghosted: ghosted.length,
    rate: total === 0 ? 0 : ghosted.length / total,
  }
}

// ─── Median time-to-first-response ───────────────────────────────────────────

export function computeMedianResponseDays(
  applications: Application[],
  statusChanges: StatusChangeRecord[]
): number | null {
  const appMap = new Map(applications.map((a) => [a.id, a]))

  // Group changes by applicationId, keep only first transition away from APPLIED
  const firstResponseMap = new Map<string, StatusChangeRecord>()
  for (const change of statusChanges) {
    if (change.fromStatus !== applicationStatus.APPLIED) continue
    if (!change.eventDate) continue
    const existing = firstResponseMap.get(change.applicationId)
    if (!existing || new Date(change.eventDate) < new Date(existing.eventDate!)) {
      firstResponseMap.set(change.applicationId, change)
    }
  }

  const durations: number[] = []
  for (const [appId, change] of firstResponseMap) {
    const app = appMap.get(appId)
    if (!app?.appliedAt || !change.eventDate) continue
    const days = (new Date(change.eventDate).getTime() - new Date(app.appliedAt).getTime()) / MS_PER_DAY
    if (days >= 0) durations.push(days)
  }

  if (durations.length === 0) return null
  durations.sort((a, b) => a - b)
  const mid = Math.floor(durations.length / 2)
  return durations.length % 2 === 0
    ? (durations[mid - 1] + durations[mid]) / 2
    : durations[mid]
}

// ─── Weekly application buckets (last 12 weeks) ───────────────────────────────

export function computeWeeklyBuckets(applications: Application[], now = new Date()) {
  const WEEKS = 12
  // Align to start of current week (Monday)
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const dayOfWeek = (startOfToday.getDay() + 6) % 7 // 0=Mon … 6=Sun
  const startOfThisWeek = new Date(startOfToday.getTime() - dayOfWeek * MS_PER_DAY)

  const buckets = Array.from({ length: WEEKS }, (_, i) => {
    const weekStart = new Date(startOfThisWeek.getTime() - (WEEKS - 1 - i) * 7 * MS_PER_DAY)
    const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY)
    const label = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    return { label, weekStart, weekEnd, count: 0 }
  })

  for (const app of applications) {
    if (app.status === applicationStatus.NEEDS_REVIEW) continue
    if (!app.appliedAt) continue
    const d = new Date(app.appliedAt)
    const bucket = buckets.find((b) => d >= b.weekStart && d < b.weekEnd)
    if (bucket) bucket.count++
  }

  return buckets.map(({ label, count }) => ({ label, count }))
}

// ─── Status funnel ────────────────────────────────────────────────────────────

export function computeStatusFunnel(applications: Application[]) {
  const total = applications.filter((a) => a.status !== applicationStatus.NEEDS_REVIEW).length
  const interviews = applications.filter(
    (a) => a.status === applicationStatus.INTERVIEW
  ).length
  const offers = applications.filter((a) => a.status === applicationStatus.OFFER).length
  return {
    total,
    interviews,
    offers,
    interviewRate: total === 0 ? 0 : interviews / total,
    offerRate: total === 0 ? 0 : offers / total,
  }
}

// ─── Source breakdown ─────────────────────────────────────────────────────────

export function computeSourceBreakdown(applications: Application[]) {
  const gmail = applications.filter((a) => a.source === applicationSource.GMAIL).length
  const manual = applications.filter((a) => a.source === applicationSource.MANUAL).length
  return { gmail, manual, total: gmail + manual }
}
