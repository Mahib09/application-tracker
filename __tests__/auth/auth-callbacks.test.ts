import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/server/lib/prisma", () => ({
  prisma: {
    user: { upsert: vi.fn(), findUnique: vi.fn() },
    oauthToken: { upsert: vi.fn() },
  },
}))

import { prisma } from "@/server/lib/prisma"

describe("handleSignIn", () => {
  beforeEach(() => vi.clearAllMocks())

  it("upserts user and stores tokens, returns true", async () => {
    const mockUser = { id: "uuid-123", email: "test@example.com", name: "Test", image: null }
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(prisma.oauthToken.upsert).mockResolvedValue({} as any)

    const { handleSignIn } = await import("@/server/services/auth.service")
    const result = await handleSignIn({
      email: "test@example.com",
      name: "Test",
      image: null,
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      scope: "openid email",
    })

    expect(result).toBe(true)
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "test@example.com" } })
    )
    expect(prisma.oauthToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "uuid-123" },
        create: expect.objectContaining({ accessToken: "access-123" }),
      })
    )
  })

  it("returns false when no refresh token (blocks sign-in)", async () => {
    const { handleSignIn } = await import("@/server/services/auth.service")
    const result = await handleSignIn({
      email: "test@example.com", name: "Test", image: null,
      accessToken: "access-123", refreshToken: null,
      expiresAt: null, scope: null,
    })
    expect(result).toBe(false)
    expect(prisma.user.upsert).not.toHaveBeenCalled()
  })
})
