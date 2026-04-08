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

function makeInput(id = "msg-1"): import("@/server/services/classification/classify").SonnetInput {
  return {
    messageId: id,
    subject: "Software Engineer at Acme Corp",
    sender: "hr@acme.com",
    body: "Dear candidate, we are pleased to offer you the Software Engineer position at Acme Corp.",
    date: new Date("2025-03-01"),
    companyHint: "Acme",
  }
}

const GOOD_RESPONSE = JSON.stringify({
  company: "Acme Corp",
  roleTitle: "Software Engineer",
  status: "OFFER",
  location: "Remote",
  confidence: 0.95,
})

describe("sonnetClassify", () => {
  it("returns empty array for empty input without API call", async () => {
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    const results = await sonnetClassify([])
    expect(results).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("extracts company, roleTitle, status, location, confidence from Sonnet response", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: GOOD_RESPONSE }] })
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    const results = await sonnetClassify([makeInput()])
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      messageId: "msg-1",
      company: "Acme Corp",
      roleTitle: "Software Engineer",
      status: "OFFER",
      confidence: 0.95,
    })
  })

  it("returns NEEDS_REVIEW with confidence 0 on individual API failure", async () => {
    mockCreate.mockRejectedValue(new Error("API error"))
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    const results = await sonnetClassify([makeInput()])
    expect(results[0].status).toBe("NEEDS_REVIEW")
    expect(results[0].confidence).toBe(0)
  })

  it("processes successful and failed emails in same batch independently", async () => {
    mockCreate
      .mockResolvedValueOnce({ content: [{ type: "text", text: GOOD_RESPONSE }] })
      .mockRejectedValueOnce(new Error("rate limit"))
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    const results = await sonnetClassify([makeInput("msg-1"), makeInput("msg-2")])
    expect(results).toHaveLength(2)
    expect(results[0].status).toBe("OFFER")
    expect(results[1].status).toBe("NEEDS_REVIEW")
  })

  it("returns NEEDS_REVIEW on malformed JSON response", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "not json" }] })
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    const results = await sonnetClassify([makeInput()])
    expect(results[0].status).toBe("NEEDS_REVIEW")
  })

  it("uses claude-sonnet-4-6 model", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: GOOD_RESPONSE }] })
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    await sonnetClassify([makeInput()])
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-sonnet-4-6" })
    )
  })

  it("applies postProcess — uses companyHint as fallback when company is null", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({
        company: null, roleTitle: "Software Engineer",
        status: "APPLIED", location: null, confidence: 0.85,
      }) }],
    })
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    const input = { ...makeInput(), companyHint: "Acme" }
    const results = await sonnetClassify([input])
    // postProcess fills company from companyHint when null
    expect(results[0].company).toBe("Acme")
  })

  it("limits concurrent calls to 5 (6th call starts only after one finishes)", async () => {
    let concurrent = 0
    let maxConcurrent = 0
    mockCreate.mockImplementation(async () => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise((r) => setTimeout(r, 10))
      concurrent--
      return { content: [{ type: "text", text: GOOD_RESPONSE }] }
    })
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    const inputs = Array.from({ length: 8 }, (_, i) => makeInput(`msg-${i}`))
    await sonnetClassify(inputs)
    expect(maxConcurrent).toBeLessThanOrEqual(5)
  })
})
