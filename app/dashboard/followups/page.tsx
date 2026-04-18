import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { listPendingFollowUps } from "@/server/services/followup.service"
import { prisma } from "@/server/lib/prisma"
import DashboardShell from "@/components/layout/DashboardShell"
import FollowUpsClient from "@/components/dashboard/FollowUpsClient"
import { type Application } from "@/types/application"

export default async function FollowUpsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = session.user.id

  const [items, syncState] = await Promise.all([
    listPendingFollowUps(userId),
    prisma.syncState.findUnique({ where: { userId } }),
  ])

  const now = new Date()
  const cooldownMs = syncState?.lastSyncedAt
    ? Math.max(0, 15 * 60 * 1000 - (now.getTime() - syncState.lastSyncedAt.getTime()))
    : 0

  return (
    <DashboardShell lastSyncedAt={syncState?.lastSyncedAt ?? null} cooldownMs={cooldownMs} hideToolbar scrollable>
      <div className="py-4 space-y-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-foreground">Follow-ups</h1>
          {items.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
              {items.length}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Applications with no response in 10+ days. Draft a follow-up message to send yourself.
        </p>
        <FollowUpsClient items={items as unknown as Application[]} />
      </div>
    </DashboardShell>
  )
}
