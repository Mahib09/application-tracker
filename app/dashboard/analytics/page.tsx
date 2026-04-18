import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { listApplications } from "@/server/services/application.service"
import { prisma } from "@/server/lib/prisma"
import DashboardShell from "@/components/layout/DashboardShell"
import AnalyticsDashboard from "@/components/dashboard/AnalyticsDashboard"
import {
  computeResponseRate,
  computeGhostRate,
  computeMedianResponseDays,
  computeWeeklyBuckets,
  computeStatusFunnel,
  computeSourceBreakdown,
} from "@/server/services/analytics.service"
import { type Application, type StatusChangeRecord } from "@/types/application"

function cooldown(lastSyncedAt: Date | null, now: Date) {
  if (!lastSyncedAt) return 0
  return Math.max(0, 15 * 60 * 1000 - (now.getTime() - lastSyncedAt.getTime()))
}

export default async function AnalyticsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = session.user.id
  const now = new Date()

  const [applications, syncState, statusChanges] = await Promise.all([
    listApplications(userId),
    prisma.syncState.findUnique({ where: { userId } }),
    prisma.statusChange.findMany({
      where: { application: { userId } },
      orderBy: { eventDate: "asc" },
    }),
  ])

  const apps = applications as unknown as Application[]
  const changes = statusChanges as unknown as StatusChangeRecord[]

  const metrics = {
    responseRate30: computeResponseRate(apps, 30, now),
    responseRate60: computeResponseRate(apps, 60, now),
    responseRate90: computeResponseRate(apps, 90, now),
    ghostRate: computeGhostRate(apps, now),
    medianDays: computeMedianResponseDays(apps, changes),
    weeklyBuckets: computeWeeklyBuckets(apps, now),
    funnel: computeStatusFunnel(apps),
    source: computeSourceBreakdown(apps),
  }

  return (
    <DashboardShell
      lastSyncedAt={syncState?.lastSyncedAt ?? null}
      cooldownMs={cooldown(syncState?.lastSyncedAt ?? null, now)}
      hideToolbar
    >
      <AnalyticsDashboard metrics={metrics} />
    </DashboardShell>
  )
}
