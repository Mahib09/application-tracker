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
  },
}))

vi.mock("@/server/services/gmail.service", () => ({
  getGmailClient: vi.fn(),
  fetchEmailsSince: vi.fn(),
}))

vi.mock("@/server/services/classification.service", () => ({
  classifyStage1: vi.fn(),
  classifyStage2Plus: vi.fn(),
  roleTitlesSimilar: vi.fn(),
}))

import { prisma } from "@/server/lib/prisma"
import { getGmailClient, fetchEmailsSince } from "@/server/services/gmail.service"
import { classifyStage1, classifyStage2Plus, roleTitlesSimilar } from "@/server/services/classification.service"

const MOCK_CLIENT = { token: "mock-oauth-client" } as any
const NOW = new Date("2025-03-24T12:00:00Z")

beforeEach(() => {
  vi.clearAllMocks()
  vi.setSystemTime(NOW)
  vi.mocked(getGmailClient).mockResolvedValue(MOCK_CLIENT)
  vi.mocked(fetchEmailsSince).mockResolvedValue([])
  vi.mocked(classifyStage1).mockReturnValue({ classified: [], unclassified: [] })
  vi.mocked(classifyStage2Plus).mockResolvedValue([])
  vi.mocked(prisma.syncState.upsert).mockResolvedValue({} as any)
  vi.mocked(prisma.application.updateMany).mockResolvedValue({ count: 0 } as any)
  vi.mocked(prisma.application.findMany).mockResolvedValue([])
  vi.mocked(roleTitlesSimilar).mockReturnValue(false)
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [
        { messageId: "m1", company: "Acme", roleTitle: "Engineer", status: "APPLIED", date: NOW, location: null },
        { messageId: "m2", company: "Beta", roleTitle: "Designer", status: "INTERVIEW", date: NOW, location: null },
      ],
      unclassified: [],
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{ messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "APPLIED", date: NOW, location: null }],
      unclassified: [],
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{ messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "INTERVIEW", date: NOW, location: null }],
      unclassified: [],
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{ messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "APPLIED", date: NOW, location: null }],
      unclassified: [],
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{ messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "REJECTED", date: NOW, location: null }],
      unclassified: [],
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{ messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "OFFER", date: NOW, location: null }],
      unclassified: [],
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

  it("creates application with NEEDS_REVIEW from Stage 2 fallback", async () => {
    vi.mocked(classifyStage1).mockReturnValue({ classified: [], unclassified: [
      { messageId: "m1", subject: "Some email", text: "snippet", date: NOW },
    ]})
    vi.mocked(classifyStage2Plus).mockResolvedValue([
      { messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "NEEDS_REVIEW", date: NOW, location: null },
    ])
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{
        messageId: "m1", company: "Shake Shack", roleTitle: "Crew Member Training",
        status: "REJECTED", date: NOW, location: null,
      }],
      unclassified: [],
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{
        messageId: "m2", company: "Float", roleTitle: "Frontend/Mobile Development (Senior)",
        status: "REJECTED", date: NOW, location: null,
      }],
      unclassified: [],
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{
        messageId: "m3", company: "HelloFresh", roleTitle: "",
        status: "REJECTED", date: NOW, location: null,
      }],
      unclassified: [],
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{
        messageId: "m4", company: "Scotiabank", roleTitle: "Full Stack Developer",
        status: "REJECTED", date: NOW, location: null,
      }],
      unclassified: [],
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{
        messageId: "m5", company: "Acme", roleTitle: "Engineer",
        status: "APPLIED", date: NOW, location: null,
      }],
      unclassified: [],
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{
        messageId: "m6", company: "Acme", roleTitle: "Engineer",
        status: "APPLIED", date: NOW, location: null,
      }],
      unclassified: [],
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{
        messageId: "m7", company: "Acme", roleTitle: "Engineer",
        status: "OFFER", date: NOW, location: null,
      }],
      unclassified: [],
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{
        messageId: "m8", company: "Acme", roleTitle: "Engineer",
        status: "APPLIED", date: NOW, location: null,
      }],
      unclassified: [],
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
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{
        messageId: "m9", company: "Scotiabank", roleTitle: "Full Stack Developer",
        status: "APPLIED", date: new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000), location: null,
      }],
      unclassified: [],
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
})

// ─── GHOSTED auto-detection ──────────────────────────────────────────────────

describe("syncApplications — GHOSTED sweep", () => {
  it("marks APPLIED/INTERVIEW GMAIL applications as GHOSTED after 30 days", async () => {
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.application.updateMany).mockResolvedValue({ count: 3 } as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          source: "GMAIL",
          status: expect.objectContaining({ in: expect.arrayContaining(["APPLIED", "INTERVIEW"]) }),
        }),
        data: { status: "GHOSTED" },
      })
    )
    expect(result.ghosted).toBe(3)
  })

  it("does not ghost OFFER or REJECTED applications", async () => {
    vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    const call = vi.mocked(prisma.application.updateMany).mock.calls[0][0]
    const statusIn = (call.where?.status as any)?.in as string[]
    expect(statusIn).not.toContain("OFFER")
    expect(statusIn).not.toContain("REJECTED")
  })
})
