import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/server/lib/prisma", () => ({
  prisma: {
    syncState: { findUnique: vi.fn(), upsert: vi.fn() },
    application: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}))

vi.mock("@/server/services/gmail.service", () => ({
  getGmailClient: vi.fn(),
  fetchEmailsSince: vi.fn(),
}))

vi.mock("@/server/services/classification.service", () => ({
  classifyBatch: vi.fn(),
}))

import { prisma } from "@/server/lib/prisma"
import { getGmailClient, fetchEmailsSince } from "@/server/services/gmail.service"
import { classifyBatch } from "@/server/services/classification.service"

const MOCK_CLIENT = { token: "mock-oauth-client" } as any
const NOW = new Date("2025-03-24T12:00:00Z")

beforeEach(() => {
  vi.clearAllMocks()
  vi.setSystemTime(NOW)
  vi.mocked(getGmailClient).mockResolvedValue(MOCK_CLIENT)
  vi.mocked(fetchEmailsSince).mockResolvedValue([])
  vi.mocked(classifyBatch).mockResolvedValue([])
  vi.mocked(prisma.syncState.upsert).mockResolvedValue({} as any)
  vi.mocked(prisma.application.updateMany).mockResolvedValue({ count: 0 } as any)
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
    vi.mocked(classifyBatch).mockResolvedValue([
      { messageId: "m1", company: "Acme", roleTitle: "Engineer", status: "APPLIED", date: NOW },
      { messageId: "m2", company: "Beta", roleTitle: "Designer", status: "INTERVIEW", date: NOW },
    ])
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
    vi.mocked(classifyBatch).mockResolvedValue([
      { messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "APPLIED", date: NOW },
    ])
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

  it("upgrades status when incoming has higher priority than existing", async () => {
    vi.mocked(classifyBatch).mockResolvedValue([
      { messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "INTERVIEW", date: NOW },
    ])
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-1",
      status: "APPLIED",
    } as any)
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "INTERVIEW" }) })
    )
    expect(result.updated).toBe(1)
    expect(result.synced).toBe(0)
  })

  it("does not downgrade status when existing has higher priority", async () => {
    vi.mocked(classifyBatch).mockResolvedValue([
      { messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "APPLIED", date: NOW },
    ])
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-1",
      status: "INTERVIEW",
    } as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).not.toHaveBeenCalled()
    expect(prisma.application.create).not.toHaveBeenCalled()
    expect(result.updated).toBe(0)
    expect(result.synced).toBe(0)
  })

  it("REJECTED always overrides INTERVIEW", async () => {
    vi.mocked(classifyBatch).mockResolvedValue([
      { messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "REJECTED", date: NOW },
    ])
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-1",
      status: "INTERVIEW",
    } as any)
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED" }) })
    )
    expect(result.updated).toBe(1)
  })

  it("OFFER is never overridden by any status", async () => {
    vi.mocked(classifyBatch).mockResolvedValue([
      { messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "REJECTED", date: NOW },
    ])
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-1",
      status: "OFFER",
    } as any)

    const { syncApplications } = await import("@/server/services/sync.service")
    await syncApplications("user-1")

    expect(prisma.application.update).not.toHaveBeenCalled()
  })

  it("creates application with NEEDS_REVIEW for Stage 3 fallback", async () => {
    vi.mocked(classifyBatch).mockResolvedValue([
      { messageId: "m1", company: "Acme Corp", roleTitle: "Engineer", status: "NEEDS_REVIEW", date: NOW },
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
