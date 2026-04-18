import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/server/lib/prisma"
import DashboardShell from "@/components/layout/DashboardShell"
import ReviewQueueClient from "@/components/dashboard/ReviewQueueClient"

export default async function ReviewPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = session.user.id

  const [reviewItems, syncState] = await Promise.all([
    prisma.application.findMany({
      where: { userId, status: "NEEDS_REVIEW" },
      orderBy: { confidence: "asc" },
    }),
    prisma.syncState.findUnique({ where: { userId } }),
  ])

  const cooldownMs = syncState?.lastSyncedAt
    ? Math.max(0, 15 * 60 * 1000 - (Date.now() - syncState.lastSyncedAt.getTime()))
    : 0

  return (
    <DashboardShell lastSyncedAt={syncState?.lastSyncedAt ?? null} cooldownMs={cooldownMs} hideToolbar>
      <div className="py-4 space-y-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-foreground">Review queue</h1>
          {reviewItems.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              {reviewItems.length}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Applications the AI was uncertain about. Accept or reclassify each one.
        </p>
        <ReviewQueueClient items={reviewItems as any} />
      </div>
    </DashboardShell>
  )
}
