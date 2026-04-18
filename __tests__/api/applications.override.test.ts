import { describe, it, expect, vi } from "vitest"

vi.mock("@/server/auth", () => ({ auth: vi.fn() }))
vi.mock("@/server/services/application.service", () => ({
  overrideClassification: vi.fn(),
}))

import { auth } from "@/server/auth"
import { overrideClassification } from "@/server/services/application.service"
import { POST } from "@/app/api/applications/[id]/override/route"

function makeRequest(body: object) {
  return new Request("http://localhost/api/applications/app-1/override", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/applications/[id]/override", () => {
  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const res = await POST(makeRequest({ status: "APPLIED" }), { params: Promise.resolve({ id: "app-1" }) })
    expect(res.status).toBe(401)
  })

  it("returns 404 when application not found (different user)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(overrideClassification).mockRejectedValue(new Error("application not found"))
    const res = await POST(makeRequest({ status: "APPLIED" }), { params: Promise.resolve({ id: "app-other" }) })
    expect(res.status).toBe(404)
  })

  it("returns 200 with updated application on success", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(overrideClassification).mockResolvedValue({ id: "app-1", status: "APPLIED" } as any)
    const res = await POST(makeRequest({ status: "APPLIED" }), { params: Promise.resolve({ id: "app-1" }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe("app-1")
  })
})
