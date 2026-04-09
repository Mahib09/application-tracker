import { prisma } from "@/server/lib/prisma";
import {
  getGmailClient,
  fetchEmailsSince,
} from "@/server/services/gmail.service";
import {
  classifyPipeline,
  roleTitlesSimilar,
  type ClassificationResult,
} from "@/server/services/classification.service";

export interface SyncResult {
  synced: number;
  updated: number;
  ghosted: number;
  skipped: boolean;
  cooldownMs: number;
  lastSyncedAt: Date;
}

const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
const GHOSTED_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Upsert helper ───────────────────────────────────────────────────────────

// STATUS_PRIORITY governs which status "wins" when two emails conflict.
// REJECTED is intentionally equal to INTERVIEW (both 4) so that a newer rejection
// email can replace an older interview record via the date tiebreaker.
// TERMINAL_STATUSES provides the guard that prevents INTERVIEW from overwriting
// REJECTED — the two structures are load-bearing against each other.
const STATUS_PRIORITY: Record<string, number> = {
  OFFER: 5,
  INTERVIEW: 4,
  REJECTED: 4, // equal to INTERVIEW so a newer rejection can replace an older interview
  GHOSTED: 3,
  APPLIED: 2,
  NEEDS_REVIEW: 1,
};

const TERMINAL_STATUSES = new Set(["OFFER", "REJECTED"]);

async function upsertResult(
  userId: string,
  result: ClassificationResult,
): Promise<"created" | "updated" | "skipped"> {
  // ── Tier 1: exact match (company + roleTitle, case insensitive) ──────────────
  let existing = await prisma.application.findFirst({
    where: {
      userId,
      company: { equals: result.company, mode: "insensitive" },
      roleTitle: { equals: result.roleTitle, mode: "insensitive" },
    },
  });

  // ── Tier 2: incoming has role, find existing with same company + empty role ──
  if (!existing && result.roleTitle !== "") {
    existing = await prisma.application.findFirst({
      where: {
        userId,
        company: { equals: result.company, mode: "insensitive" },
        roleTitle: { equals: "", mode: "insensitive" },
      },
      orderBy: { appliedAt: "desc" },
    });
  }

  // ── Tier 2.5: same company, non-empty roles, normalized similarity ≥ 60% ────
  if (!existing && result.roleTitle !== "") {
    const candidates = await prisma.application.findMany({
      where: {
        userId,
        company: { equals: result.company, mode: "insensitive" },
        NOT: { roleTitle: "" },
      },
      orderBy: { appliedAt: "desc" },
    });
    existing =
      candidates.find((c) =>
        roleTitlesSimilar(c.roleTitle, result.roleTitle),
      ) ?? null;
  }

  // ── Tier 3: incoming has no role — match most recent record for this company ─
  if (!existing && result.roleTitle === "") {
    existing = await prisma.application.findFirst({
      where: {
        userId,
        company: { equals: result.company, mode: "insensitive" },
      },
      orderBy: { appliedAt: "desc" },
    });
  }

  if (existing) {
    const existingPriority = STATUS_PRIORITY[existing.status] ?? 0;
    const newPriority = STATUS_PRIORITY[result.status] ?? 0;

    // Field enrichment: fill empty roleTitle and null location from incoming
    const enrichedRole =
      existing.roleTitle === "" && result.roleTitle !== ""
        ? result.roleTitle
        : existing.roleTitle;
    const enrichedLocation =
      existing.location === null && result.location !== null
        ? result.location
        : existing.location;

    // ── Terminal protection ────────────────────────────────────────────────────
    // OFFER is never overwritten. REJECTED yields only to OFFER.
    if (TERMINAL_STATUSES.has(existing.status)) {
      // Only REJECTED can yield — and only to OFFER. OFFER never yields to anything.
      const isRejectedYieldingToOffer =
        existing.status === "REJECTED" && result.status === "OFFER";
      if (!isRejectedYieldingToOffer) {
        const hasEnrichment =
          enrichedRole !== existing.roleTitle ||
          enrichedLocation !== existing.location;
        if (hasEnrichment) {
          await prisma.application.update({
            where: { id: existing.id },
            data: { roleTitle: enrichedRole, location: enrichedLocation },
          });
          return "updated";
        }
        return "skipped";
      }
      // REJECTED → OFFER falls through to normal update logic below
    }

    // ── Status update condition ───────────────────────────────────────────────
    const shouldUpdateStatus =
      newPriority > existingPriority ||
      (newPriority === existingPriority && result.date > existing.appliedAt);

    // Only advance appliedAt when the status is also advancing — prevents a late
    // APPLIED auto-reply from updating the date on an INTERVIEW/REJECTED record
    const shouldUpdateDate =
      shouldUpdateStatus && result.date > existing.appliedAt;

    const hasChanges =
      shouldUpdateStatus ||
      shouldUpdateDate ||
      enrichedRole !== existing.roleTitle ||
      enrichedLocation !== existing.location;

    if (!hasChanges) return "skipped";

    await prisma.application.update({
      where: { id: existing.id },
      data: {
        status: shouldUpdateStatus ? (result.status as any) : existing.status,
        appliedAt: shouldUpdateDate ? result.date : existing.appliedAt,
        roleTitle: enrichedRole,
        location: enrichedLocation,
      },
    });
    return "updated";
  }

  // ── No match: create new record ───────────────────────────────────────────────
  await prisma.application.create({
    data: {
      userId,
      company: result.company,
      roleTitle: result.roleTitle,
      status: result.status as any,
      source: "GMAIL" as any,
      appliedAt: result.date,
      location: result.location ?? null,
    },
  });
  return "created";
}

// ─── Full resync ─────────────────────────────────────────────────────────────

export interface FullResyncResult {
  synced: number
  updated: number
  ghosted: number
  deleted: number
  lastSyncedAt: Date
}

export async function fullResync(userId: string): Promise<FullResyncResult> {
  // 1. Delete all GMAIL-sourced applications for this user
  const { count: deleted } = await prisma.application.deleteMany({
    where: { userId, source: "GMAIL" as any },
  })

  // 2. Clear SyncState so cooldown doesn't block the immediate re-sync
  await prisma.syncState.upsert({
    where: { userId },
    update: { lastSyncedAt: null, lastSyncStatus: "SUCCESS" as any, lastSyncError: null },
    create: { userId, lastSyncStatus: "SUCCESS" as any },
  })

  // 3. Full sync from scratch (lastSyncedAt=null → uses full 1-year lookback)
  const result = await syncApplications(userId)

  return {
    synced: result.synced,
    updated: result.updated,
    ghosted: result.ghosted,
    deleted,
    lastSyncedAt: result.lastSyncedAt,
  }
}

// ─── Main sync ───────────────────────────────────────────────────────────────

export async function syncApplications(userId: string): Promise<SyncResult> {
  // 1. Load SyncState
  const syncState = await prisma.syncState.findUnique({ where: { userId } });
  const lastSyncedAt = syncState?.lastSyncedAt ?? null;

  // 2. Cooldown check
  if (lastSyncedAt) {
    const elapsed = Date.now() - lastSyncedAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      return {
        skipped: true,
        cooldownMs: COOLDOWN_MS - elapsed,
        synced: 0,
        updated: 0,
        ghosted: 0,
        lastSyncedAt,
      };
    }
  }

  const now = new Date();

  try {
    // 3. Refresh token once at sync start
    const gmailClient = await getGmailClient(userId);

    // 4. Fetch emails — never look back more than 3 months
    const THREE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;
    const threeMonthsAgo = new Date(Date.now() - THREE_MONTHS_MS);
    const fetchSince =
      lastSyncedAt && lastSyncedAt > threeMonthsAgo
        ? lastSyncedAt
        : threeMonthsAgo;
    const emails = await fetchEmailsSince(gmailClient, fetchSince);

    let synced = 0;
    let updated = 0;

    // 5. Classify — deterministic filter → Haiku triage → Sonnet extraction
    const { results, stats } = await classifyPipeline(emails, gmailClient);
    for (const result of results) {
      const r = await upsertResult(userId, result);
      if (r === "created") synced++;
      else if (r === "updated") updated++;
    }

    // 6. GHOSTED sweep — runs after new emails processed
    const ghostedResult = await prisma.application.updateMany({
      where: {
        userId,
        source: "GMAIL" as any,
        status: { in: ["APPLIED", "INTERVIEW"] as any[] },
        updatedAt: { lt: new Date(Date.now() - GHOSTED_AFTER_MS) },
      },
      data: { status: "GHOSTED" as any },
    });
    const ghosted = ghostedResult.count;

    // 7. Update SyncState to SUCCESS
    await prisma.syncState.upsert({
      where: { userId },
      update: {
        lastSyncedAt: now,
        lastSyncStatus: "SUCCESS" as any,
        lastSyncError: null,
        filteredCount: stats.filteredCount,
        haikuCallCount: stats.haikuCallCount,
        triageYesCount: stats.triageYesCount,
        triageNoCount: stats.triageNoCount,
        triageUncertainCount: stats.triageUncertainCount,
        sonnetCallCount: stats.sonnetCallCount,
        autoCommitCount: stats.autoCommitCount,
        reviewFlagCount: stats.reviewFlagCount,
        manualQueueCount: stats.manualQueueCount,
      },
      create: { userId, lastSyncedAt: now, lastSyncStatus: "SUCCESS" as any },
    });

    return {
      synced,
      updated,
      ghosted,
      skipped: false,
      cooldownMs: 0,
      lastSyncedAt: now,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await prisma.syncState.upsert({
      where: { userId },
      update: { lastSyncStatus: "FAIL" as any, lastSyncError: message },
      create: { userId, lastSyncStatus: "FAIL" as any, lastSyncError: message },
    });

    throw error;
  }
}
