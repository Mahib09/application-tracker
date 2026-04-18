import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/server/lib/prisma", () => ({
  prisma: {
    syncState: { findUnique: vi.fn(), upsert: vi.fn() },
    application: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    statusChange: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

vi.mock("@/server/services/gmail.service", () => ({
  getGmailClient: vi.fn(),
  fetchEmailsSince: vi.fn(),
}))

vi.mock("@/server/services/classification.service", () => ({
  classifyPipeline: vi.fn(),
  roleTitlesSimilar: vi.fn(),
  companySimilar: vi.fn(),
}))

import { prisma } from "@/server/lib/prisma"
import { getGmailClient, fetchEmailsSince } from "@/server/services/gmail.service"
import { classifyPipeline, roleTitlesSimilar, companySimilar } from "@/server/services/classification.service"

const MOCK_CLIENT = { token: "mock-oauth-client" } as any
const NOW = new Date("2025-03-24T12:00:00Z")

const ZERO_STATS = {
  filteredCount: 0, haikuCallCount: 0, triageYesCount: 0,
  triageNoCount: 0, triageUncertainCount: 0, sonnetCallCount: 0,
  autoCommitCount: 0, reviewFlagCount: 0, manualQueueCount: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.setSystemTime(NOW)
  vi.mocked(getGmailClient).mockResolvedValue(MOCK_CLIENT)
  vi.mocked(fetchEmailsSince).mockResolvedValue([])
  vi.mocked(classifyPipeline).mockResolvedValue({ results: [], stats: ZERO_STATS })
  vi.mocked(prisma.syncState.upsert).mockResolvedValue({} as any)
  vi.mocked(prisma.application.updateMany).mockResolvedValue({ count: 0 } as any)
  vi.mocked(prisma.application.findMany).mockResolvedValue([])
  vi.mocked(roleTitlesSimilar).mockReturnValue(false)
  vi.mocked(companySimilar).mockReturnValue(false)
})

// ─── Cooldown ────────────────────────────────────────────────────────────────

describe("syncApplications — cooldown", () => {
  it("returns skipped:true when synced within the last 15 minutes", async () => {
    const recentSync = new Date(NOW.getTime() - 5 * 60 * 1000) // 5 min ago
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue({
      userId: "user-1",
      lastSyncedAt: recentSync,
      lastSyncStatus: "SUCCESS",
      lastSyncError: null,
      updatedAt: recentSync,
    } as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(result.skipped).toBe(true)
    expect(result.cooldownMs).toBeGreaterThan(0)
    expect(getGmailClient).not.toHaveBeenCalled()
  })

  it("proceeds when no SyncState exists (first sync)", async () => {
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    expect(getGmailClient).toHaveBeenCalledOnce()
  })

  it("proceeds when last sync was more than 15 minutes ago", async () => {
    const oldSync = new Date(NOW.getTime() - 20 * 60 * 1000) // 20 min ago
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue({
      userId: "user-1",
      lastSyncedAt: oldSync,
      lastSyncStatus: "SUCCESS",
      lastSyncError: null,
      updatedAt: oldSync,
    } as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    expect(getGmailClient).toHaveBeenCalledOnce()
  })
})

// ─── Token refresh ───────────────────────────────────────────────────────────

describe("syncApplications — token refresh", () => {
  it("calls getGmailClient once at the start, not per email", async () => {
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [
        { messageId: "m1", company: "Acme", roleTitle: "Engineer", status: "APPLIED", date: NOW, location: null },
        { messageId: "m2", company: "Beta", roleTitle: "Designer", status: "INTERVIEW", date: NOW, location: null },
      ],
      stats: ZERO_STATS,
    })
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.application.create).mockResolvedValue({} as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    expect(getGmailClient).toHaveBeenCalledTimes(1)
    expect(getGmailClient).toHaveBeenCalledWith("user-1")
  })
})

// ─── Upsert logic ────────────────────────────────────────────────────────────

describe("syncApplications — application upsert", () => {
  beforeEach(() => {
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)
  })

  it("creates a new application when no existing record matches", async () => {
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{ messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "APPLIED", date: NOW, location: null }],
      stats: ZERO_STATS,
    })
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.application.create).mockResolvedValue({} as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ company: "Acme Corp", roleTitle: "Engineer", status: "APPLIED" }),
      })
    )
    expect(result.synced).toBe(1)
    expect(result.updated).toBe(0)
  })

  it("updates status when incoming email is newer than existing record", async () => {
    const olderDate = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{ messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "INTERVIEW", date: NOW, location: null }],
      stats: ZERO_STATS,
    })
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-1", status: "APPLIED", appliedAt: olderDate, location: null,
    } as any)
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "INTERVIEW", appliedAt: NOW }),
      })
    )
    expect(result.updated).toBe(1)
  })

  it("skips when incoming email is older than existing record", async () => {
    const newerDate = new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000) // 5 days in future
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{ messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "APPLIED", date: NOW, location: null }],
      stats: ZERO_STATS,
    })
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-1", status: "INTERVIEW", appliedAt: newerDate, location: null,
    } as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).not.toHaveBeenCalled()
    expect(result.updated).toBe(0)
    expect(result.synced).toBe(0)
  })

  it("newer REJECTED overrides existing INTERVIEW", async () => {
    const olderDate = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{ messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "REJECTED", date: NOW, location: null }],
      stats: ZERO_STATS,
    })
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-1", status: "INTERVIEW", appliedAt: olderDate, location: null,
    } as any)
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED" }) })
    )
    expect(result.updated).toBe(1)
  })

  it("newer OFFER overrides existing INTERVIEW", async () => {
    const olderDate = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{ messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "OFFER", date: NOW, location: null }],
      stats: ZERO_STATS,
    })
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-1", status: "INTERVIEW", appliedAt: olderDate, location: null,
    } as any)
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "OFFER" }) })
    )
    expect(result.updated).toBe(1)
  })

  it("creates application with NEEDS_REVIEW from pipeline", async () => {
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{ messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "NEEDS_REVIEW", date: NOW, location: null }],
      stats: ZERO_STATS,
    })
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.application.create).mockResolvedValue({} as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "NEEDS_REVIEW" }),
      })
    )
    expect(result.synced).toBe(1)
  })

  it("tier 2: merges incoming with role into existing empty-role record and fills roleTitle", async () => {
    const existing = {
      id: "app-1", company: "Shake Shack", roleTitle: "", status: "INTERVIEW",
      appliedAt: new Date(NOW.getTime() - 4 * 24 * 60 * 60 * 1000), location: null,
    }
    vi.mocked(prisma.application.findFirst)
      .mockResolvedValueOnce(null)             // tier 1: no exact match
      .mockResolvedValueOnce(existing as any)  // tier 2: company + empty role
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{
        messageId: "m1", company: "Shake Shack", roleTitle: "Crew Member Training",
        status: "REJECTED", date: NOW, location: null,
      }],
      stats: ZERO_STATS,
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-1" },
        data: expect.objectContaining({ status: "REJECTED", roleTitle: "Crew Member Training" }),
      })
    )
    expect(result.updated).toBe(1)
  })

  it("tier 2.5: merges Float-style role title variations via similarity", async () => {
    const existing = {
      id: "app-2", company: "Float", roleTitle: "Software Developer - Frontend / Mobile",
      status: "APPLIED", appliedAt: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000), location: null,
    }
    vi.mocked(prisma.application.findFirst)
      .mockResolvedValueOnce(null)  // tier 1
      .mockResolvedValueOnce(null)  // tier 2 (no empty-role record)
    vi.mocked(prisma.application.findMany).mockResolvedValueOnce([existing as any])
    vi.mocked(roleTitlesSimilar).mockReturnValue(true)
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{
        messageId: "m2", company: "Float", roleTitle: "Frontend/Mobile Development (Senior)",
        status: "REJECTED", date: NOW, location: null,
      }],
      stats: ZERO_STATS,
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-2" },
        data: expect.objectContaining({ status: "REJECTED" }),
      })
    )
    expect(result.updated).toBe(1)
  })

  it("tier 3: company-only match when incoming has no role, preserves existing roleTitle", async () => {
    const existing = {
      id: "app-3", company: "HelloFresh", roleTitle: "Software Developer",
      status: "APPLIED", appliedAt: new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000), location: null,
    }
    vi.mocked(prisma.application.findFirst)
      .mockResolvedValueOnce(null)             // tier 1: no exact match
      // tier 2 and tier 2.5 are skipped when roleTitle is "" — no extra calls needed
      .mockResolvedValueOnce(existing as any)  // tier 3: company-only match
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{
        messageId: "m3", company: "HelloFresh", roleTitle: "",
        status: "REJECTED", date: NOW, location: null,
      }],
      stats: ZERO_STATS,
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-3" },
        data: expect.objectContaining({ status: "REJECTED", roleTitle: "Software Developer" }),
      })
    )
    expect(result.updated).toBe(1)
  })

  it("no merge for two different non-empty roles at same company — creates new record", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.application.findMany).mockResolvedValue([])
    vi.mocked(prisma.application.create).mockResolvedValue({} as any)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{
        messageId: "m4", company: "Scotiabank", roleTitle: "Full Stack Developer",
        status: "REJECTED", date: NOW, location: null,
      }],
      stats: ZERO_STATS,
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.create).toHaveBeenCalledOnce()
    expect(result.synced).toBe(1)
    expect(result.updated).toBe(0)
  })

  it("terminal OFFER: not overwritten by APPLIED", async () => {
    const existing = {
      id: "app-5", company: "Acme", roleTitle: "Engineer", status: "OFFER",
      appliedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000), location: null,
    }
    vi.mocked(prisma.application.findFirst).mockResolvedValue(existing as any)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{
        messageId: "m5", company: "Acme", roleTitle: "Engineer",
        status: "APPLIED", date: NOW, location: null,
      }],
      stats: ZERO_STATS,
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).not.toHaveBeenCalled()
    expect(result.updated).toBe(0)
  })

  it("terminal REJECTED: not overwritten by APPLIED", async () => {
    const existing = {
      id: "app-6", company: "Acme", roleTitle: "Engineer", status: "REJECTED",
      appliedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000), location: null,
    }
    vi.mocked(prisma.application.findFirst).mockResolvedValue(existing as any)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{
        messageId: "m6", company: "Acme", roleTitle: "Engineer",
        status: "APPLIED", date: NOW, location: null,
      }],
      stats: ZERO_STATS,
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).not.toHaveBeenCalled()
    expect(result.updated).toBe(0)
  })

  it("REJECTED can be overwritten by OFFER", async () => {
    const existing = {
      id: "app-7", company: "Acme", roleTitle: "Engineer", status: "REJECTED",
      appliedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000), location: null,
    }
    vi.mocked(prisma.application.findFirst).mockResolvedValue(existing as any)
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{
        messageId: "m7", company: "Acme", roleTitle: "Engineer",
        status: "OFFER", date: NOW, location: null,
      }],
      stats: ZERO_STATS,
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "OFFER" }) })
    )
    expect(result.updated).toBe(1)
  })

  it("INTERVIEW not downgraded to APPLIED even when APPLIED email is newer", async () => {
    const existing = {
      id: "app-8", company: "Acme", roleTitle: "Engineer", status: "INTERVIEW",
      appliedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000), location: null,
    }
    vi.mocked(prisma.application.findFirst).mockResolvedValue(existing as any)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{
        messageId: "m8", company: "Acme", roleTitle: "Engineer",
        status: "APPLIED", date: NOW, location: null,
      }],
      stats: ZERO_STATS,
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).not.toHaveBeenCalled()
    expect(result.updated).toBe(0)
  })

  it("field enrichment: fills empty roleTitle on terminal REJECTED record without changing status", async () => {
    const existing = {
      id: "app-9", company: "Scotiabank", roleTitle: "", status: "REJECTED",
      appliedAt: NOW, location: null,
    }
    vi.mocked(prisma.application.findFirst)
      .mockResolvedValueOnce(null)             // tier 1
      .mockResolvedValueOnce(existing as any)  // tier 2
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{
        messageId: "m9", company: "Scotiabank", roleTitle: "Full Stack Developer",
        status: "APPLIED", date: new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000), location: null,
      }],
      stats: ZERO_STATS,
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-9" },
        data: expect.objectContaining({ roleTitle: "Full Stack Developer" }),
      })
    )
    expect(prisma.application.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "APPLIED" }) })
    )
    expect(result.updated).toBe(1)
  })
})

// ─── Company name variant matching ───────────────────────────────────────────

describe("syncApplications — company name similarity (Tier 2.75)", () => {
  it("merges incoming 'Autism Today' with existing 'Autism Today Foundation'", async () => {
    const existing = {
      id: "app-variant", company: "Autism Today Foundation", roleTitle: "Volunteer Developer",
      status: "APPLIED", appliedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000), location: null,
    }
    // Tiers 1, 2, 2.5, 3 all fail (different company name)
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.application.findMany)
      .mockResolvedValueOnce([])            // tier 2.5: same-company candidates
      .mockResolvedValueOnce([existing as any]) // tier 2.75: all-user applications
    // companySimilar returns true for "Autism Today" ↔ "Autism Today Foundation"
    vi.mocked(companySimilar).mockReturnValue(true)
    vi.mocked(roleTitlesSimilar).mockReturnValue(true)
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{
        messageId: "m-variant", company: "Autism Today", roleTitle: "Volunteer Developer",
        status: "INTERVIEW", date: NOW, location: null,
      }],
      stats: ZERO_STATS,
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.create).not.toHaveBeenCalled()
    expect(result.updated).toBe(1)
  })
})

// ─── SyncState updates ───────────────────────────────────────────────────────

describe("syncApplications — SyncState", () => {
  it("updates SyncState to SUCCESS on completion", async () => {
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    expect(prisma.syncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        update: expect.objectContaining({ lastSyncStatus: "SUCCESS" }),
      })
    )
  })

  it("updates SyncState to FAIL and re-throws on error", async () => {
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)
    vi.mocked(getGmailClient).mockRejectedValue(new Error("Token expired"))

    const { syncApplications } = await import("@/server/services/sync.service")
    await expect(syncApplications("user-1")).rejects.toThrow("Token expired")

    expect(prisma.syncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ lastSyncStatus: "FAIL", lastSyncError: "Token expired" }),
      })
    )
  })

  it("writes pipeline stats to SyncState on success", async () => {
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [],
      stats: {
        filteredCount: 5, haikuCallCount: 1, triageYesCount: 3,
        triageNoCount: 2, triageUncertainCount: 0, sonnetCallCount: 3,
        autoCommitCount: 2, reviewFlagCount: 1, manualQueueCount: 0,
      },
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    expect(prisma.syncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          filteredCount: 5,
          haikuCallCount: 1,
          triageYesCount: 3,
          sonnetCallCount: 3,
          autoCommitCount: 2,
        }),
      })
    )
  })
})

// ─── GHOSTED auto-detection ──────────────────────────────────────────────────

describe("syncApplications — GHOSTED sweep", () => {
  it("marks APPLIED/INTERVIEW GMAIL applications as GHOSTED after 30 days", async () => {
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.application.findMany).mockResolvedValue([
      { id: "a1", status: "APPLIED" },
      { id: "a2", status: "APPLIED" },
      { id: "a3", status: "INTERVIEW" },
    ] as any)
    vi.mocked(prisma.application.updateMany).mockResolvedValue({ count: 3 } as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          source: "GMAIL",
          status: expect.objectContaining({ in: expect.arrayContaining(["APPLIED", "INTERVIEW"]) }),
        }),
      })
    )
    expect(prisma.application.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["a1", "a2", "a3"] } },
        data: { status: "GHOSTED" },
      })
    )
    expect(prisma.statusChange.createMany).toHaveBeenCalled()
    expect(result.ghosted).toBe(3)
  })

  it("does not ghost OFFER or REJECTED applications", async () => {
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.application.findMany).mockResolvedValue([] as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    const ghostCall = vi.mocked(prisma.application.findMany).mock.calls.find(
      (c) => (c[0]?.where as any)?.source === "GMAIL"
    )
    expect(ghostCall).toBeDefined()
    const statusIn = ((ghostCall![0]!.where as any).status as any).in as string[]
    expect(statusIn).not.toContain("OFFER")
    expect(statusIn).not.toContain("REJECTED")
  })
})

// ─── Concurrent sync lock ───────────────────────────────────────────────────

describe("syncApplications — IN_PROGRESS lock", () => {
  it("returns skipped when status is IN_PROGRESS and not stale", async () => {
    const recentUpdate = new Date(NOW.getTime() - 60_000) // 1 min ago
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue({
      userId: "user-1",
      lastSyncedAt: new Date(NOW.getTime() - 20 * 60 * 1000), // past cooldown
      lastSyncStatus: "IN_PROGRESS",
      lastSyncError: null,
      updatedAt: recentUpdate,
    } as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(result.skipped).toBe(true)
    expect(getGmailClient).not.toHaveBeenCalled()
  })

  it("allows sync when IN_PROGRESS is stale (>5 min)", async () => {
    const staleUpdate = new Date(NOW.getTime() - 6 * 60 * 1000) // 6 min ago
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue({
      userId: "user-1",
      lastSyncedAt: new Date(NOW.getTime() - 20 * 60 * 1000),
      lastSyncStatus: "IN_PROGRESS",
      lastSyncError: null,
      updatedAt: staleUpdate,
    } as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    expect(getGmailClient).toHaveBeenCalledOnce()
  })

  it("sets IN_PROGRESS before starting sync work", async () => {
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    // First upsert call should be the IN_PROGRESS lock
    const firstUpsert = vi.mocked(prisma.syncState.upsert).mock.calls[0]
    expect(firstUpsert[0]).toMatchObject({
      update: { lastSyncStatus: "IN_PROGRESS" },
    })
  })
})

// ─── Phase A: source email fields & interview fields ────────────────────────

describe("syncApplications — source email fields", () => {
  beforeEach(() => {
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)
  })

  it("writes sourceEmailSubject, sourceEmailSnippet, confidence, sourceEmailId on create", async () => {
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{
        messageId: "m1", company: "Acme", roleTitle: "Engineer", status: "APPLIED",
        date: NOW, location: null, confidence: 0.92,
        sourceEmailSubject: "Your application to Acme",
        sourceEmailSnippet: "Thank you for applying",
        sourceEmailReceivedAt: NOW,
      }],
      stats: ZERO_STATS,
    })
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.application.create).mockResolvedValue({ id: "app-new" } as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    expect(prisma.application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceEmailId: "m1",
          sourceEmailSubject: "Your application to Acme",
          sourceEmailSnippet: "Thank you for applying",
          sourceEmailReceivedAt: NOW,
          confidence: 0.92,
        }),
      })
    )
  })

  it("writes interview fields on create when status is INTERVIEW", async () => {
    const isoDate = "2025-04-10T15:00:00Z"
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{
        messageId: "m2", company: "Beta", roleTitle: "Dev", status: "INTERVIEW",
        date: NOW, location: null, confidence: 0.95,
        interviewDate: isoDate,
        interviewUrl: "https://zoom.us/j/99999",
        interviewer: "Bob",
        interviewProvider: "ZOOM",
      }],
      stats: ZERO_STATS,
    })
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.application.create).mockResolvedValue({ id: "app-int" } as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    expect(prisma.application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          interviewDate: new Date(isoDate),
          interviewUrl: "https://zoom.us/j/99999",
          interviewer: "Bob",
          interviewProvider: "ZOOM",
        }),
      })
    )
  })

  it("does NOT overwrite source email fields when manuallyEdited is true", async () => {
    const olderDate = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{
        messageId: "m3", company: "Acme", roleTitle: "Engineer", status: "INTERVIEW",
        date: NOW, location: null, confidence: 0.88,
        sourceEmailSubject: "New email subject",
        sourceEmailSnippet: "New snippet",
      }],
      stats: ZERO_STATS,
    })
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-manual", company: "Acme", roleTitle: "Engineer",
      status: "APPLIED", appliedAt: olderDate, location: null,
      manuallyEdited: true,
    } as any)
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ sourceEmailSubject: expect.anything() }),
      })
    )
  })
})

// ─── Phase B: recruiter fields written on create ─────────────────────────────

describe("syncApplications — recruiter fields", () => {
  beforeEach(() => {
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)
  })

  it("writes recruiterName and recruiterEmail on create", async () => {
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{
        messageId: "m-rec", company: "Acme", roleTitle: "Engineer", status: "APPLIED",
        date: NOW, location: null, confidence: 0.95,
        recruiterName: "Sarah Lee", recruiterEmail: "sarah@acme.com",
      }],
      stats: ZERO_STATS,
    })
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.application.create).mockResolvedValue({ id: "app-rec" } as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    expect(prisma.application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recruiterName: "Sarah Lee",
          recruiterEmail: "sarah@acme.com",
        }),
      })
    )
  })
})

// ─── StatusChange eventDate + initial creation ──────────────────────────────

describe("syncApplications — eventDate on StatusChange", () => {
  beforeEach(() => {
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)
  })

  it("creates initial StatusChange with eventDate when application is created", async () => {
    const emailDate = new Date("2025-03-10")
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{ messageId: "m1", company: "Acme", roleTitle: "Engineer", status: "APPLIED", date: emailDate, location: null }],
      stats: ZERO_STATS,
    })
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.application.findMany).mockResolvedValue([])
    vi.mocked(prisma.application.create).mockResolvedValue({ id: "app-new" } as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    expect(prisma.statusChange.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: "app-new",
          fromStatus: "APPLIED",
          toStatus: "APPLIED",
          trigger: "SYNC",
          eventDate: emailDate,
        }),
      })
    )
  })

  it("includes eventDate on StatusChange when status updates", async () => {
    const emailDate = new Date("2025-03-15")
    const olderDate = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000)
    vi.mocked(classifyPipeline).mockResolvedValue({
      results: [{ messageId: "m1", company: "Acme", roleTitle: "Engineer", status: "INTERVIEW", date: emailDate, location: null }],
      stats: ZERO_STATS,
    })
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-1", status: "APPLIED", appliedAt: olderDate, roleTitle: "Engineer", location: null,
    } as any)
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    expect(prisma.statusChange.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: "app-1",
          fromStatus: "APPLIED",
          toStatus: "INTERVIEW",
          eventDate: emailDate,
        }),
      })
    )
  })
})
