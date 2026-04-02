import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/server/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/server/services/sync.service", () => ({
  fullResync: vi.fn(),
}))

import { auth } from "@/server/auth"
import { fullResync } from "@/server/services/sync.service"

const MOCK_FULL_RESYNC_RESULT = {
  synced: 10,
  updated: 0,
  ghosted: 2,
  deleted: 8,
  skipped: false,
  cooldownMs: 0,
  lastSyncedAt: new Date("2025-03-24T12:00:00Z"),
}

describe("POST /api/sync/reset", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)

    const { POST } = await import("@/app/api/sync/reset/route")
    const res = await POST()

    expect(res.status).toBe(401)
  })

  it("calls fullResync with the session userId", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(fullResync).mockResolvedValue(MOCK_FULL_RESYNC_RESULT)

    const { POST } = await import("@/app/api/sync/reset/route")
    await POST()

    expect(fullResync).toHaveBeenCalledWith("user-1")
  })

  it("returns 200 with FullResyncResult including deleted count", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(fullResync).mockResolvedValue(MOCK_FULL_RESYNC_RESULT)

    const { POST } = await import("@/app/api/sync/reset/route")
    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ synced: 10, deleted: 8, skipped: false })
  })

  it("returns 500 with error message on failure", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(fullResync).mockRejectedValue(new Error("Gmail auth failed"))

    const { POST } = await import("@/app/api/sync/reset/route")
    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe("Gmail auth failed")
  })
})
