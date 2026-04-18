import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/server/lib/prisma"
import DashboardShell from "@/components/layout/DashboardShell"
import SettingsClient from "@/components/dashboard/SettingsClient"

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = session.user.id

  const [syncState, oauthToken] = await Promise.all([
    prisma.syncState.findUnique({ where: { userId } }),
    prisma.oauthToken.findUnique({ where: { userId } }),
  ])

  const now = new Date()
  const cooldownMs = syncState?.lastSyncedAt
    ? Math.max(0, 15 * 60 * 1000 - (now.getTime() - syncState.lastSyncedAt.getTime()))
    : 0

  return (
    <DashboardShell lastSyncedAt={syncState?.lastSyncedAt ?? null} cooldownMs={cooldownMs} hideToolbar scrollable>
      <SettingsClient
        user={{ name: session.user.name ?? null, email: session.user.email ?? "", image: session.user.image ?? null }}
        lastSyncedAt={syncState?.lastSyncedAt ?? null}
        gmailConnected={!!oauthToken}
      />
    </DashboardShell>
  )
}
