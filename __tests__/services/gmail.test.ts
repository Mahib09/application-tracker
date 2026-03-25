import { describe, it, expect, vi, beforeEach } from "vitest"

// Hoist mock fns so they're available inside vi.mock factories
const {
  mockSetCredentials,
  mockRefreshAccessToken,
  mockOAuth2Instance,
  mockMessagesList,
  mockMessagesGet,
  OAuth2Ctor,
} = vi.hoisted(() => {
  const mockSetCredentials = vi.fn()
  const mockRefreshAccessToken = vi.fn()
  const mockOAuth2Instance = {
    setCredentials: mockSetCredentials,
    refreshAccessToken: mockRefreshAccessToken,
    credentials: {} as Record<string, unknown>,
  }
  // Must be a regular function — arrow functions cannot be used with `new`
  function OAuth2Ctor() { return mockOAuth2Instance }
  const mockMessagesList = vi.fn()
  const mockMessagesGet = vi.fn()
  return {
    mockSetCredentials,
    mockRefreshAccessToken,
    mockOAuth2Instance,
    mockMessagesList,
    mockMessagesGet,
    OAuth2Ctor,
  }
})

vi.mock("googleapis", () => ({
  google: {
    auth: { OAuth2: OAuth2Ctor },
    gmail: vi.fn(() => ({
      users: { messages: { list: mockMessagesList, get: mockMessagesGet } },
    })),
  },
}))

vi.mock("@/server/lib/prisma", () => ({
  prisma: {
    oauthToken: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma } from "@/server/lib/prisma"

// Helper: base64url encode a string
function b64url(str: string) {
  return Buffer.from(str).toString("base64url")
}

// ─── extractBodyText ────────────────────────────────────────────────────────

describe("extractBodyText", () => {
  beforeEach(() => vi.clearAllMocks())

  it("decodes a text/plain payload", async () => {
    const { extractBodyText } = await import("@/server/services/gmail.service")
    const payload = {
      mimeType: "text/plain",
      body: { data: b64url("Hello plain world") },
    }
    expect(extractBodyText(payload)).toBe("Hello plain world")
  })

  it("decodes a text/html payload and strips tags", async () => {
    const { extractBodyText } = await import("@/server/services/gmail.service")
    const payload = {
      mimeType: "text/html",
      body: { data: b64url("<p>Hello <b>World</b></p>") },
    }
    const result = extractBodyText(payload)
    expect(result).toContain("Hello")
    expect(result).toContain("World")
    expect(result).not.toContain("<p>")
    expect(result).not.toContain("<b>")
  })

  it("recurses multipart and prefers text/plain over text/html", async () => {
    const { extractBodyText } = await import("@/server/services/gmail.service")
    const payload = {
      mimeType: "multipart/alternative",
      body: { data: "" },
      parts: [
        { mimeType: "text/plain", body: { data: b64url("Plain version") } },
        { mimeType: "text/html", body: { data: b64url("<p>HTML version</p>") } },
      ],
    }
    expect(extractBodyText(payload)).toBe("Plain version")
  })

  it("returns empty string for unknown mime type", async () => {
    const { extractBodyText } = await import("@/server/services/gmail.service")
    const payload = { mimeType: "application/pdf", body: { data: "" } }
    expect(extractBodyText(payload)).toBe("")
  })
})

// ─── getGmailClient ─────────────────────────────────────────────────────────

describe("getGmailClient", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns configured OAuth2 client when token is valid", async () => {
    const futureExpiry = new Date(Date.now() + 3_600_000) // 1 hour from now
    vi.mocked(prisma.oauthToken.findUnique).mockResolvedValue({
      userId: "user-1",
      accessToken: "acc-token",
      refreshToken: "ref-token",
      expiresAt: futureExpiry,
      scope: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const { getGmailClient } = await import("@/server/services/gmail.service")
    const client = await getGmailClient("user-1")

    expect(client).toBe(mockOAuth2Instance)
    expect(mockSetCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: "acc-token", refresh_token: "ref-token" })
    )
    expect(mockRefreshAccessToken).not.toHaveBeenCalled()
  })

  it("refreshes token when within 60s of expiry and writes new token to DB", async () => {
    const soonExpiry = new Date(Date.now() + 30_000) // expires in 30s
    vi.mocked(prisma.oauthToken.findUnique).mockResolvedValue({
      userId: "user-1",
      accessToken: "old-acc",
      refreshToken: "ref-token",
      expiresAt: soonExpiry,
      scope: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const newExpiry = Date.now() + 3_600_000
    mockRefreshAccessToken.mockResolvedValue({
      credentials: { access_token: "new-acc", expiry_date: newExpiry },
    })
    vi.mocked(prisma.oauthToken.update).mockResolvedValue({} as any)

    const { getGmailClient } = await import("@/server/services/gmail.service")
    await getGmailClient("user-1")

    expect(mockRefreshAccessToken).toHaveBeenCalledOnce()
    expect(prisma.oauthToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        data: expect.objectContaining({ accessToken: "new-acc" }),
      })
    )
  })

  it("throws when no OauthToken found for user", async () => {
    vi.mocked(prisma.oauthToken.findUnique).mockResolvedValue(null)

    const { getGmailClient } = await import("@/server/services/gmail.service")
    await expect(getGmailClient("user-1")).rejects.toThrow()
  })
})

// ─── fetchEmailsSince ────────────────────────────────────────────────────────

describe("fetchEmailsSince", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns EmailRaw array with correct fields", async () => {
    mockMessagesList.mockResolvedValue({
      data: { messages: [{ id: "msg-1" }] },
    })
    mockMessagesGet.mockResolvedValue({
      data: {
        id: "msg-1",
        snippet: "We received your application",
        payload: {
          headers: [
            { name: "Subject", value: "Application received - Engineer at Acme" },
            { name: "Date", value: "Mon, 10 Mar 2025 10:00:00 +0000" },
          ],
        },
      },
    })

    const { fetchEmailsSince } = await import("@/server/services/gmail.service")
    const results = await fetchEmailsSince(mockOAuth2Instance as any)

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      messageId: "msg-1",
      snippet: "We received your application",
      subject: "Application received - Engineer at Acme",
    })
    expect(results[0].date).toBeInstanceOf(Date)
  })

  it("includes after: filter in query when since is provided", async () => {
    mockMessagesList.mockResolvedValue({ data: { messages: [] } })

    const since = new Date("2025-01-01T00:00:00Z")
    const { fetchEmailsSince } = await import("@/server/services/gmail.service")
    await fetchEmailsSince(mockOAuth2Instance as any, since)

    expect(mockMessagesList).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("after:"),
      })
    )
  })

  it("returns empty array when no messages found", async () => {
    mockMessagesList.mockResolvedValue({ data: { messages: [] } })

    const { fetchEmailsSince } = await import("@/server/services/gmail.service")
    const results = await fetchEmailsSince(mockOAuth2Instance as any)

    expect(results).toEqual([])
    expect(mockMessagesGet).not.toHaveBeenCalled()
  })

  it("includes subject keywords and ATS sender domains in query", async () => {
    mockMessagesList.mockResolvedValue({ data: { messages: [] } })

    const { fetchEmailsSince } = await import("@/server/services/gmail.service")
    await fetchEmailsSince(mockOAuth2Instance as any)

    const query: string = mockMessagesList.mock.calls[0][0].q
    expect(query).toContain("interview")
    expect(query).toContain("greenhouse.io")
  })
})
