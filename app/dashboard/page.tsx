import { auth, signOut } from "@/server/auth"
import { redirect } from "next/navigation"
import { listApplications, updateApplication, deleteApplication } from "@/server/services/application.service"
import { prisma } from "@/server/lib/prisma"
import { applicationStatus } from "@/app/generated/prisma/enums"
import StatsBar from "@/components/StatsBar"
import ApplicationTable from "@/components/ApplicationTable"
import SyncButton from "@/components/SyncButton"
import ReviewQueue from "@/components/ReviewQueue"
import OnboardingEmptyState from "@/components/OnboardingEmptyState"
import AddApplicationDialog from "@/components/AddApplicationDialog"

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
  const needsReview = applications.filter((a) => a.status === applicationStatus.NEEDS_REVIEW)
  const isFirstTimeUser = applications.length === 0 && !syncState

  async function handleStatusChange(_id: string, _prev: applicationStatus, _next: applicationStatus) {
    "use server"
    await updateApplication(userId, _id, { status: _next })
  }

  async function handleNotesSave(_id: string, _notes: string) {
    "use server"
    await updateApplication(userId, _id, { notes: _notes })
  }

  async function handleApproveReview(_id: string, _status: applicationStatus) {
    "use server"
    await updateApplication(userId, _id, { status: _status })
  }

  async function handleDismissApplication(_id: string) {
    "use server"
    await deleteApplication(userId, _id)
  }

  async function handleBulkApprove(_ids: string[]) {
    "use server"
    await Promise.all(
      _ids.map((id) => updateApplication(userId, id, { status: applicationStatus.APPLIED })),
    )
  }

  if (isFirstTimeUser) {
    return (
      <main className="min-h-screen bg-slate-50">
        <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Application Tracker</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{session.user.name}</span>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }) }}>
              <button type="submit" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <OnboardingEmptyState />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Zone A: Header */}
      <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Application Tracker</h1>
        <div className="flex items-center gap-4">
          <AddApplicationDialog />
          <SyncButton lastSyncedAt={syncState?.lastSyncedAt ?? null} cooldownMs={cooldownMs} compact />
          <div className="w-px h-5 bg-slate-200" />
          <span className="text-sm text-slate-500">{session.user.name}</span>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }) }}>
            <button type="submit" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <StatsBar applications={applications} />

        {/* Zone B: Review Queue — only when items exist */}
        {needsReview.length > 0 && (
          <ReviewQueue
            applications={needsReview.map((a) => ({
              id: a.id,
              company: a.company,
              roleTitle: a.roleTitle,
              status: a.status,
              appliedAt: a.appliedAt,
              location: a.location,
              confidence: a.confidence,
            }))}
            onApprove={handleApproveReview}
            onDismiss={handleDismissApplication}
            onBulkApprove={handleBulkApprove}
          />
        )}

        {/* Zone C: Application Table */}
        <ApplicationTable
          applications={applications}
          onStatusChange={handleStatusChange}
          onNotesSave={handleNotesSave}
        />
      </div>
    </main>
  )
}
