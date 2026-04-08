import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock("@anthropic-ai/sdk", () => ({
  default: function AnthropicMock() {
    return { messages: { create: mockCreate } }
  },
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

function makeEmail(id: string, subject = "Software Engineer at Acme"): import("@/server/services/gmail.service").EmailRaw {
  return {
    messageId: id, subject, snippet: "snippet", date: new Date(),
    from: "hr@acme.com", companyHint: "Acme", isATS: false,
    listUnsubscribe: null, labelIds: [],
  }
}

describe("haikuTriage", () => {
  it("returns empty array for empty input without calling API", async () => {
    const { haikuTriage } = await import("@/server/services/classification/triage")
    const results = await haikuTriage([])
    expect(results).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("returns YES for a clearly job-related email", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify([{ id: "msg-1", result: "YES" }]) }],
    })
    const { haikuTriage } = await import("@/server/services/classification/triage")
    const results = await haikuTriage([makeEmail("msg-1")])
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({ messageId: "msg-1", result: "YES" })
  })

  it("returns NO for a non-job email", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify([{ id: "msg-1", result: "NO" }]) }],
    })
    const { haikuTriage } = await import("@/server/services/classification/triage")
    const results = await haikuTriage([makeEmail("msg-1", "Your package has shipped")])
    expect(results[0].result).toBe("NO")
  })

  it("returns UNCERTAIN for ambiguous email", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify([{ id: "msg-1", result: "UNCERTAIN" }]) }],
    })
    const { haikuTriage } = await import("@/server/services/classification/triage")
    const results = await haikuTriage([makeEmail("msg-1", "Following up")])
    expect(results[0].result).toBe("UNCERTAIN")
  })

  it("returns all UNCERTAIN on API failure (fail-open)", async () => {
    mockCreate.mockRejectedValue(new Error("API error"))
    const { haikuTriage } = await import("@/server/services/classification/triage")
    const results = await haikuTriage([makeEmail("msg-1"), makeEmail("msg-2")])
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.result === "UNCERTAIN")).toBe(true)
  })

  it("returns all UNCERTAIN on malformed JSON response", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "not valid json" }] })
    const { haikuTriage } = await import("@/server/services/classification/triage")
    const results = await haikuTriage([makeEmail("msg-1")])
    expect(results[0].result).toBe("UNCERTAIN")
  })

  it("batches 25 emails into 2 API calls (batch size 20)", async () => {
    const response = JSON.stringify(
      Array.from({ length: 20 }, (_, i) => ({ id: `msg-${i}`, result: "YES" }))
    )
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: response }] })
    const { haikuTriage } = await import("@/server/services/classification/triage")
    const emails = Array.from({ length: 25 }, (_, i) => makeEmail(`msg-${i}`))
    await haikuTriage(emails)
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it("uses claude-haiku-4-5-20251001 model", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify([{ id: "msg-1", result: "YES" }]) }],
    })
    const { haikuTriage } = await import("@/server/services/classification/triage")
    await haikuTriage([makeEmail("msg-1")])
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5-20251001" })
    )
  })
})
