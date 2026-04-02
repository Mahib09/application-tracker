import { auth, signOut } from "@/server/auth"
import { redirect } from "next/navigation"
import { listApplications, updateApplication } from "@/server/services/application.service"
import { prisma } from "@/server/lib/prisma"
import { applicationStatus } from "@/app/generated/prisma/enums"
import StatsBar from "@/components/StatsBar"
import ApplicationTable from "@/components/ApplicationTable"
import SyncButton from "@/components/SyncButton"
import DevResetButton from "@/components/DevResetButton"

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

  async function handleStatusChange(_id: string, _prev: applicationStatus, _next: applicationStatus) {
    "use server"
    await updateApplication(userId, _id, { status: _next })
  }

  async function handleNotesSave(_id: string, _notes: string) {
    "use server"
    await updateApplication(userId, _id, { notes: _notes })
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
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
        <StatsBar applications={applications} />
        <SyncButton lastSyncedAt={syncState?.lastSyncedAt ?? null} cooldownMs={cooldownMs} />
        {/* DEV ONLY — remove before production */}
        <DevResetButton />
        <ApplicationTable
          applications={applications}
          onStatusChange={handleStatusChange}
          onNotesSave={handleNotesSave}
        />
      </div>
    </main>
  )
}
