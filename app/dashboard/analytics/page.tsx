import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { listApplications } from "@/server/services/application.service"
import DashboardShell from "@/components/layout/DashboardShell"
import { prisma } from "@/server/lib/prisma"
import WeeklySummary from "@/components/dashboard/WeeklySummary"

const COOLDOWN_MS = 15 * 60 * 1000

function computeCooldownMs(lastSyncedAt: Date | null): number {
  if (!lastSyncedAt) return 0
  return Math.max(0, COOLDOWN_MS - (Date.now() - lastSyncedAt.getTime()))
}

export default async function AnalyticsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = session.user.id
  const [applications, syncState] = await Promise.all([
    listApplications(userId),
    prisma.syncState.findUnique({ where: { userId } }),
  ])

  const cooldownMs = computeCooldownMs(syncState?.lastSyncedAt ?? null)

  return (
    <DashboardShell
      lastSyncedAt={syncState?.lastSyncedAt ?? null}
      cooldownMs={cooldownMs}
    >
      <div className="py-4 space-y-6">
        <h1 className="text-lg font-semibold text-foreground">Analytics</h1>
        <WeeklySummary applications={applications} />
      </div>
    </DashboardShell>
  )
}
