import { render, screen, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import SyncButton from "@/components/SyncButton"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const mockFetch = vi.fn()
global.fetch = mockFetch

describe("SyncButton", () => {
  beforeEach(() => vi.clearAllMocks())

  it("auto-syncs on mount when cooldownMs is 0", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ synced: 3, skipped: false, cooldownMs: 0 }) })
    render(<SyncButton lastSyncedAt={null} cooldownMs={0} />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/sync", expect.objectContaining({ method: "POST" }))
    })
  })

  it("does NOT auto-sync when within cooldown", () => {
    render(<SyncButton lastSyncedAt={new Date()} cooldownMs={500_000} />)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("disables button during cooldown", () => {
    render(<SyncButton lastSyncedAt={new Date()} cooldownMs={500_000} />)
    expect(screen.getByRole("button")).toBeDisabled()
  })
})
