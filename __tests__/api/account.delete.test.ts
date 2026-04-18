import { describe, it, expect, vi } from "vitest"

vi.mock("@/server/auth", () => ({ auth: vi.fn() }))
vi.mock("@/server/lib/prisma", () => ({
  prisma: {
    oauthToken: { deleteMany: vi.fn() },
    user: { delete: vi.fn() },
  },
}))

import { auth } from "@/server/auth"
import { prisma } from "@/server/lib/prisma"
import { DELETE as deleteGmail } from "@/app/api/account/gmail/route"
import { DELETE as deleteAccount } from "@/app/api/account/route"

describe("DELETE /api/account/gmail", () => {
  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const res = await deleteGmail()
    expect(res.status).toBe(401)
  })

  it("deletes OauthToken and returns 200", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(prisma.oauthToken.deleteMany).mockResolvedValue({ count: 1 } as any)
    const res = await deleteGmail()
    expect(res.status).toBe(200)
    expect(prisma.oauthToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    })
  })
})

describe("DELETE /api/account", () => {
  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const res = await deleteAccount()
    expect(res.status).toBe(401)
  })

  it("deletes the user and cascades, returns 200", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
    vi.mocked(prisma.user.delete).mockResolvedValue({} as any)
    const res = await deleteAccount()
    expect(res.status).toBe(200)
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } })
  })
})
