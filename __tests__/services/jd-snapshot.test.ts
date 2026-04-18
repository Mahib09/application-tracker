import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── fetchJobDescription ─────────────────────────────────────────────────────

describe("fetchJobDescription", () => {
  it("returns stripped text from successful HTML response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => "<html><body><p>Software Engineer role at Acme. We need React skills.</p></body></html>",
      headers: { get: () => "text/html" },
    })

    const { fetchJobDescription } = await import("@/server/services/jd-snapshot.service")
    const result = await fetchJobDescription("https://jobs.acme.com/swe")

    expect(result).not.toBeNull()
    expect(result).toContain("Software Engineer role at Acme")
    expect(result).not.toContain("<p>")
  })

  it("returns null on non-ok HTTP response (e.g. 404)", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: async () => "Not found" })

    const { fetchJobDescription } = await import("@/server/services/jd-snapshot.service")
    const result = await fetchJobDescription("https://jobs.acme.com/gone")

    expect(result).toBeNull()
  })

  it("returns null when fetch throws (timeout / network error)", async () => {
    mockFetch.mockRejectedValue(new Error("AbortError"))

    const { fetchJobDescription } = await import("@/server/services/jd-snapshot.service")
    const result = await fetchJobDescription("https://jobs.acme.com/timeout")

    expect(result).toBeNull()
  })

  it("caps snapshot at 10 000 chars even for large responses", async () => {
    const big = "x".repeat(50_000)
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => big,
      headers: { get: () => "text/plain" },
    })

    const { fetchJobDescription } = await import("@/server/services/jd-snapshot.service")
    const result = await fetchJobDescription("https://jobs.acme.com/big")

    expect(result).not.toBeNull()
    expect(result!.length).toBeLessThanOrEqual(10_000)
  })
})
