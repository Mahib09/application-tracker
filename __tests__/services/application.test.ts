import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/server/lib/prisma", () => ({
  prisma: {
    application: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    statusChange: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { prisma } from "@/server/lib/prisma"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("overrideClassification", () => {
  it("sets manuallyEdited=true and updates supplied fields", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-1", userId: "user-1", status: "NEEDS_REVIEW",
    } as any)
    vi.mocked(prisma.application.update).mockResolvedValue({ id: "app-1" } as any)

    const { overrideClassification } = await import("@/server/services/application.service")
    await overrideClassification("user-1", "app-1", { company: "Acme Corp" })

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-1" },
        data: expect.objectContaining({ manuallyEdited: true, company: "Acme Corp" }),
      })
    )
  })

  it("logs StatusChange with trigger MANUAL when status changes", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-2", userId: "user-1", status: "NEEDS_REVIEW",
    } as any)
    const txUpdate = vi.fn().mockResolvedValue({ id: "app-2" })
    const txStatusChange = vi.fn().mockResolvedValue({})
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn({ application: { update: txUpdate }, statusChange: { create: txStatusChange } })
    )

    const { overrideClassification } = await import("@/server/services/application.service")
    await overrideClassification("user-1", "app-2", { status: "APPLIED" as any })

    expect(txStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: "app-2",
          fromStatus: "NEEDS_REVIEW",
          toStatus: "APPLIED",
          trigger: "MANUAL",
        }),
      })
    )
  })

  it("does not log StatusChange when status does not change", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-3", userId: "user-1", status: "APPLIED",
    } as any)
    vi.mocked(prisma.application.update).mockResolvedValue({ id: "app-3" } as any)

    const { overrideClassification } = await import("@/server/services/application.service")
    await overrideClassification("user-1", "app-3", { company: "New Co" })

    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.application.update).toHaveBeenCalled()
  })

  it("throws when application not found", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null)

    const { overrideClassification } = await import("@/server/services/application.service")
    await expect(
      overrideClassification("user-1", "app-404", { company: "X" })
    ).rejects.toThrow("application not found")
  })
})

// ─── updateApplication tags ──────────────────────────────────────────────────

describe("updateApplication — tags", () => {
  it("persists a tags array update", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-1", userId: "user-1", status: "APPLIED",
    } as any)
    vi.mocked(prisma.application.update).mockResolvedValue({ id: "app-1" } as any)

    const { updateApplication } = await import("@/server/services/application.service")
    await updateApplication("user-1", "app-1", { tags: ["react", "frontend"] } as any)

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-1" },
        data: expect.objectContaining({ tags: ["react", "frontend"] }),
      })
    )
  })

  it("enforces max 10 tags", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-1", userId: "user-1", status: "APPLIED",
    } as any)

    const { updateApplication } = await import("@/server/services/application.service")
    const tooMany = Array.from({ length: 11 }, (_, i) => `tag${i}`)
    await expect(
      updateApplication("user-1", "app-1", { tags: tooMany } as any)
    ).rejects.toThrow("Too many tags")
  })

  it("enforces max 20 chars per tag", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue({
      id: "app-1", userId: "user-1", status: "APPLIED",
    } as any)

    const { updateApplication } = await import("@/server/services/application.service")
    await expect(
      updateApplication("user-1", "app-1", { tags: ["a".repeat(21)] } as any)
    ).rejects.toThrow("Tag too long")
  })
})
