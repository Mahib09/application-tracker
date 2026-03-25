import { prisma } from "@/server/lib/prisma"
import { getGmailClient, fetchEmailsSince } from "@/server/services/gmail.service"
import { classifyStage1, classifyStage2Plus, type ClassificationResult } from "@/server/services/classification.service"

export interface SyncResult {
  synced: number
  updated: number
  ghosted: number
  skipped: boolean
  cooldownMs: number
  lastSyncedAt: Date
}

const COOLDOWN_MS = 15 * 60 * 1000 // 15 minutes
const GHOSTED_AFTER_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// ─── Status upgrade logic ────────────────────────────────────────────────────

const STATUS_PRIORITY: Record<string, number> = {
  NEEDS_REVIEW: 0,
  GHOSTED: 1,
  APPLIED: 2,
  INTERVIEW: 3,
  OFFER: 4,
}

function shouldUpgradeStatus(existing: string, incoming: string): boolean {
  // OFFER is terminal positive — never override
  if (existing === "OFFER") return false
  // REJECTED always wins (terminal negative state)
  if (incoming === "REJECTED") return true
  // NEEDS_REVIEW never downgrades a real classification
  if (incoming === "NEEDS_REVIEW") return false
  // Otherwise upgrade only, never downgrade
  return (STATUS_PRIORITY[incoming] ?? -1) > (STATUS_PRIORITY[existing] ?? -1)
}

// ─── Upsert helper ───────────────────────────────────────────────────────────

async function upsertResult(
  userId: string,
  result: ClassificationResult,
): Promise<"created" | "updated" | "skipped"> {
  const existing = await prisma.application.findFirst({
    where: { userId, company: result.company, roleTitle: result.roleTitle },
  })

  if (existing) {
    if (shouldUpgradeStatus(existing.status as string, result.status)) {
      await prisma.application.update({
        where: { id: existing.id },
        data: { status: result.status as any },
      })
      return "updated"
    }
    return "skipped"
  }

  await prisma.application.create({
    data: {
      userId,
      company: result.company,
      roleTitle: result.roleTitle,
      status: result.status as any,
      source: "GMAIL" as any,
      appliedAt: result.date,
    },
  })
  return "created"
}

// ─── Main sync ───────────────────────────────────────────────────────────────

export async function syncApplications(userId: string): Promise<SyncResult> {
  // 1. Load SyncState
  const syncState = await prisma.syncState.findUnique({ where: { userId } })
  const lastSyncedAt = syncState?.lastSyncedAt ?? null

  // 2. Cooldown check
  if (lastSyncedAt) {
    const elapsed = Date.now() - lastSyncedAt.getTime()
    if (elapsed < COOLDOWN_MS) {
      return {
        skipped: true,
        cooldownMs: COOLDOWN_MS - elapsed,
        synced: 0,
        updated: 0,
        ghosted: 0,
        lastSyncedAt,
      }
    }
  }

  const now = new Date()

  try {
    // 3. Refresh token once at sync start
    const gmailClient = await getGmailClient(userId)

    // 4. Fetch emails — never look back more than 3 months
    const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000
    const threeMonthsAgo = new Date(Date.now() - THREE_MONTHS_MS)
    const fetchSince = lastSyncedAt && lastSyncedAt > threeMonthsAgo ? lastSyncedAt : threeMonthsAgo
    const emails = await fetchEmailsSince(gmailClient, fetchSince)

    let synced = 0
    let updated = 0

    // 5. Stage 1: regex classify — persist immediately, no AI dependency
    const { classified: stage1Results, unclassified } = classifyStage1(emails)
    for (const result of stage1Results) {
      const r = await upsertResult(userId, result)
      if (r === "created") synced++
      else if (r === "updated") updated++
    }

    // 6. Stage 2+: AI classify remaining — persist as results arrive
    const stage2Results = await classifyStage2Plus(unclassified, gmailClient)
    for (const result of stage2Results) {
      const r = await upsertResult(userId, result)
      if (r === "created") synced++
      else if (r === "updated") updated++
    }

    // 7. GHOSTED sweep — runs after new emails processed
    const ghostedResult = await prisma.application.updateMany({
      where: {
        userId,
        source: "GMAIL" as any,
        status: { in: ["APPLIED", "INTERVIEW"] as any[] },
        updatedAt: { lt: new Date(Date.now() - GHOSTED_AFTER_MS) },
      },
      data: { status: "GHOSTED" as any },
    })
    const ghosted = ghostedResult.count

    // 8. Update SyncState to SUCCESS
    await prisma.syncState.upsert({
      where: { userId },
      update: { lastSyncedAt: now, lastSyncStatus: "SUCCESS" as any, lastSyncError: null },
      create: { userId, lastSyncedAt: now, lastSyncStatus: "SUCCESS" as any },
    })

    return { synced, updated, ghosted, skipped: false, cooldownMs: 0, lastSyncedAt: now }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await prisma.syncState.upsert({
      where: { userId },
      update: { lastSyncStatus: "FAIL" as any, lastSyncError: message },
      create: { userId, lastSyncStatus: "FAIL" as any, lastSyncError: message },
    })

    throw error
  }
}
