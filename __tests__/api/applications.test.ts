import { describe, it, expect, vi } from "vitest"

vi.mock("@/server/auth", () => ({ auth: vi.fn() }))
vi.mock("@/server/services/application.service", () => ({
  listApplications: vi.fn().mockResolvedValue([]),
  createApplication: vi.fn().mockResolvedValue({ id: "app-1" }),
}))

import { auth } from "@/server/auth"
import { GET, POST } from "@/app/api/applications/route"

describe("GET /api/applications", () => {
  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns 200 with applications for authenticated user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
    const res = await GET()
    expect(res.status).toBe(200)
  })
})

describe("POST /api/applications", () => {
  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const req = new Request("http://localhost/api/applications", {
      method: "POST",
      body: JSON.stringify({ company: "Acme", roleTitle: "SWE" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
