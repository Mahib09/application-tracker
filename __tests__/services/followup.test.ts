import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock("@/server/lib/prisma", () => ({
  prisma: {
    application: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

import { prisma } from "@/server/lib/prisma"

const NOW = new Date("2026-04-17T12:00:00Z")

beforeEach(() => {
  vi.clearAllMocks()
  vi.setSystemTime(NOW)
})

// ─── listPendingFollowUps ────────────────────────────────────────────────────

describe("listPendingFollowUps", () => {
  it("queries applications with APPLIED status older than daysThreshold", async () => {
    vi.mocked(prisma.application.findMany).mockResolvedValue([])
    const { listPendingFollowUps } = await import("@/server/services/followup.service")
    await listPendingFollowUps("user-1")

    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          status: "APPLIED",
        }),
      })
    )
  })

  it("returns only apps with appliedAt older than daysThreshold (default 10)", async () => {
    const old = { id: "app-old", company: "Acme", appliedAt: new Date("2026-04-01"), lastFollowUpAt: null }
    const recent = { id: "app-recent", company: "Beta", appliedAt: new Date("2026-04-16"), lastFollowUpAt: null }
    vi.mocked(prisma.application.findMany).mockResolvedValue([old, recent] as any)

    const { listPendingFollowUps } = await import("@/server/services/followup.service")
    const result = await listPendingFollowUps("user-1")

    // Service should filter in the query (where clause); we verify the DB call included a date filter
    const call = vi.mocked(prisma.application.findMany).mock.calls[0][0]
    const where = (call?.where as any)
    expect(where.appliedAt?.lt).toBeDefined()
  })

  it("excludes apps followed up within the last 14 days", async () => {
    vi.mocked(prisma.application.findMany).mockResolvedValue([])
    const { listPendingFollowUps } = await import("@/server/services/followup.service")
    await listPendingFollowUps("user-1")

    const call = vi.mocked(prisma.application.findMany).mock.calls[0][0]
    const where = (call?.where as any)
    // lastFollowUpAt should be null OR older than 14 days
    expect(where.OR).toBeDefined()
  })
})

// ─── draftFollowUp ───────────────────────────────────────────────────────────

describe("draftFollowUp", () => {
  it("calls Haiku and returns the draft text", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-1", company: "Acme", roleTitle: "Engineer",
      sourceEmailSubject: "Application received", sourceEmailSnippet: "Thanks for applying",
      appliedAt: new Date("2026-04-01"),
    } as any)

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Hi, I wanted to follow up on my application." }],
    })

    const { draftFollowUp } = await import("@/server/services/followup.service")
    const result = await draftFollowUp("user-1", "app-1")

    expect(result.draft).toBe("Hi, I wanted to follow up on my application.")
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5-20251001" })
    )
  })

  it("throws when application not found", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
    const { draftFollowUp } = await import("@/server/services/followup.service")
    await expect(draftFollowUp("user-1", "app-404")).rejects.toThrow("application not found")
  })
})

// ─── markFollowedUp ──────────────────────────────────────────────────────────

describe("markFollowedUp", () => {
  it("sets lastFollowUpAt to now", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue({ id: "app-1" } as any)
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)

    const { markFollowedUp } = await import("@/server/services/followup.service")
    await markFollowedUp("user-1", "app-1")

    expect(prisma.application.update).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: { lastFollowUpAt: NOW },
    })
  })

  it("throws when application not found", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
    const { markFollowedUp } = await import("@/server/services/followup.service")
    await expect(markFollowedUp("user-1", "app-404")).rejects.toThrow("application not found")
  })
})
