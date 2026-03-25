import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/server/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/server/services/sync.service", () => ({
  syncApplications: vi.fn(),
}))

import { auth } from "@/server/auth"
import { syncApplications } from "@/server/services/sync.service"

const MOCK_SYNC_RESULT = {
  synced: 5,
  updated: 2,
  ghosted: 1,
  skipped: false,
  cooldownMs: 0,
  lastSyncedAt: new Date("2025-03-24T12:00:00Z"),
}

describe("POST /api/sync", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { POST } = await import("@/app/api/sync/route")
    const res = await POST()

    expect(res.status).toBe(401)
  })

  it("calls syncApplications with the session userId", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(syncApplications).mockResolvedValue(MOCK_SYNC_RESULT)

    const { POST } = await import("@/app/api/sync/route")
    await POST()

    expect(syncApplications).toHaveBeenCalledWith("user-1")
  })

  it("returns 200 with SyncResult on success", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(syncApplications).mockResolvedValue(MOCK_SYNC_RESULT)

    const { POST } = await import("@/app/api/sync/route")
    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ synced: 5, updated: 2, ghosted: 1, skipped: false })
  })

  it("returns 200 with skipped:true when cooldown is active", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(syncApplications).mockResolvedValue({
      ...MOCK_SYNC_RESULT,
      skipped: true,
      cooldownMs: 600_000,
    })

    const { POST } = await import("@/app/api/sync/route")
    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.skipped).toBe(true)
    expect(body.cooldownMs).toBe(600_000)
  })
})
