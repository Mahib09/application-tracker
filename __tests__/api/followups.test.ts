import { describe, it, expect, vi } from "vitest"

vi.mock("@/server/auth", () => ({ auth: vi.fn() }))
vi.mock("@/server/services/followup.service", () => ({
  listPendingFollowUps: vi.fn(),
  draftFollowUp: vi.fn(),
  markFollowedUp: vi.fn(),
}))

import { auth } from "@/server/auth"
import { listPendingFollowUps, draftFollowUp, markFollowedUp } from "@/server/services/followup.service"
import { GET } from "@/app/api/followups/route"
import { POST as postDraft } from "@/app/api/applications/[id]/draft-followup/route"
import { POST as postMarkFollowedUp } from "@/app/api/applications/[id]/mark-followed-up/route"

describe("GET /api/followups", () => {
  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns 200 with pending follow-ups for authenticated user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(listPendingFollowUps).mockResolvedValue([{ id: "app-1" }] as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
  })
})

describe("POST /api/applications/[id]/draft-followup", () => {
  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const req = new Request("http://localhost", { method: "POST" })
    const res = await postDraft(req, { params: Promise.resolve({ id: "app-1" }) })
    expect(res.status).toBe(401)
  })

  it("returns 200 with draft on success", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(draftFollowUp).mockResolvedValue({ draft: "Hi, following up on my application." })
    const req = new Request("http://localhost", { method: "POST" })
    const res = await postDraft(req, { params: Promise.resolve({ id: "app-1" }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.draft).toBe("Hi, following up on my application.")
  })
})

describe("POST /api/applications/[id]/mark-followed-up", () => {
  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const req = new Request("http://localhost", { method: "POST" })
    const res = await postMarkFollowedUp(req, { params: Promise.resolve({ id: "app-1" }) })
    expect(res.status).toBe(401)
  })

  it("returns 200 on success", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(markFollowedUp).mockResolvedValue(undefined as any)
    const req = new Request("http://localhost", { method: "POST" })
    const res = await postMarkFollowedUp(req, { params: Promise.resolve({ id: "app-1" }) })
    expect(res.status).toBe(200)
  })
})
