import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/server/lib/prisma", () => ({
  prisma: {
    application: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from "@/server/lib/prisma"

const NOW = new Date("2026-04-17T12:00:00Z")

function makeApp(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    userId: "user-1",
    company: "Acme",
    roleTitle: "Software Engineer",
    status: "APPLIED",
    source: "GMAIL",
    appliedAt: NOW,
    location: "Remote",
    jobUrl: "https://acme.com/jobs/1",
    confidence: 0.95,
    tags: ["react", "typescript"],
    manuallyEdited: false,
    notes: null,
    sourceEmailId: "msg-1",
    sourceEmailSubject: "Your application",
    sourceEmailSnippet: "Thank you",
    sourceEmailReceivedAt: NOW,
    interviewDate: null,
    interviewUrl: null,
    interviewer: null,
    interviewProvider: null,
    recruiterName: "Sarah",
    recruiterEmail: "sarah@acme.com",
    lastFollowUpAt: null,
    jobDescriptionSnapshot: null,
    jobDescriptionFetchedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    statusChanges: [
      {
        id: "sc-1",
        applicationId: "app-1",
        fromStatus: "APPLIED",
        toStatus: "APPLIED",
        trigger: "SYNC",
        eventDate: NOW,
        createdAt: NOW,
      },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── exportCsv ───────────────────────────────────────────────────────────────

describe("exportCsv", () => {
  it("returns a CSV string with header row", async () => {
    vi.mocked(prisma.application.findMany).mockResolvedValue([makeApp()] as any)
    const { exportCsv } = await import("@/server/services/export.service")
    const csv = await exportCsv("user-1")
    const lines = csv.split("\n")
    expect(lines[0]).toContain("id")
    expect(lines[0]).toContain("company")
    expect(lines[0]).toContain("status")
    expect(lines[0]).toContain("tags")
  })

  it("includes application data in data row", async () => {
    vi.mocked(prisma.application.findMany).mockResolvedValue([makeApp()] as any)
    const { exportCsv } = await import("@/server/services/export.service")
    const csv = await exportCsv("user-1")
    expect(csv).toContain("Acme")
    expect(csv).toContain("Software Engineer")
    expect(csv).toContain("APPLIED")
  })

  it("only queries for the requesting user (no cross-user PII)", async () => {
    vi.mocked(prisma.application.findMany).mockResolvedValue([])
    const { exportCsv } = await import("@/server/services/export.service")
    await exportCsv("user-1")
    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    )
  })
})

// ─── exportJson ──────────────────────────────────────────────────────────────

describe("exportJson", () => {
  it("returns valid JSON that round-trips through JSON.parse", async () => {
    vi.mocked(prisma.application.findMany).mockResolvedValue([makeApp()] as any)
    const { exportJson } = await import("@/server/services/export.service")
    const json = await exportJson("user-1")
    expect(() => JSON.parse(json)).not.toThrow()
    const parsed = JSON.parse(json)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed[0].company).toBe("Acme")
  })

  it("includes statusChanges in JSON export", async () => {
    vi.mocked(prisma.application.findMany).mockResolvedValue([makeApp()] as any)
    const { exportJson } = await import("@/server/services/export.service")
    const json = await exportJson("user-1")
    const parsed = JSON.parse(json)
    expect(Array.isArray(parsed[0].statusChanges)).toBe(true)
  })

  it("only queries for the requesting user", async () => {
    vi.mocked(prisma.application.findMany).mockResolvedValue([])
    const { exportJson } = await import("@/server/services/export.service")
    await exportJson("user-1")
    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    )
  })
})
