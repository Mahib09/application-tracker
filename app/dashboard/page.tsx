import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { listApplications, updateApplication, deleteApplication } from "@/server/services/application.service"
import { prisma } from "@/server/lib/prisma"
import { applicationStatus } from "@/app/generated/prisma/enums"
import DashboardShell from "@/components/layout/DashboardShell"
import DashboardContent from "@/components/dashboard/DashboardContent"
import OnboardingEmptyState from "@/components/OnboardingEmptyState"

const COOLDOWN_MS = 15 * 60 * 1000

function computeCooldownMs(lastSyncedAt: Date | null): number {
  if (!lastSyncedAt) return 0
  return Math.max(0, COOLDOWN_MS - (Date.now() - lastSyncedAt.getTime()))
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = session.user.id
  const [applications, syncState] = await Promise.all([
    listApplications(userId),
    prisma.syncState.findUnique({ where: { userId } }),
  ])

  const cooldownMs = computeCooldownMs(syncState?.lastSyncedAt ?? null)
  const isFirstTimeUser = applications.length === 0 && !syncState

  async function handleStatusChange(_id: string, _prev: applicationStatus, _next: applicationStatus) {
    "use server"
    await updateApplication(userId, _id, { status: _next })
  }

  async function handleUpdate(_id: string, patch: Record<string, unknown>) {
    "use server"
    await updateApplication(userId, _id, patch as Parameters<typeof updateApplication>[2])
  }

  async function handleDelete(_id: string) {
    "use server"
    await deleteApplication(userId, _id)
  }

  async function handleApproveReview(_id: string, _status: applicationStatus) {
    "use server"
    await updateApplication(userId, _id, { status: _status })
  }

  if (isFirstTimeUser) {
    return (
      <DashboardShell lastSyncedAt={null} cooldownMs={0} hideToolbar>
        <OnboardingEmptyState />
      </DashboardShell>
    )
  }

  return (
    <DashboardShell
      lastSyncedAt={syncState?.lastSyncedAt ?? null}
      cooldownMs={cooldownMs}
    >
      <DashboardContent
        applications={applications}
        onStatusChange={handleStatusChange}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onApproveReview={handleApproveReview}
      />
    </DashboardShell>
  )
}
