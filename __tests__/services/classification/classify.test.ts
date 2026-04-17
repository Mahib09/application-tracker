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

/** Helper: build a tool_use response mimicking Anthropic's tool use format */
function toolResponse(results: Array<{
  messageId: string
  company: string | null
  roleTitle: string | null
  status: string
  location: string | null
  confidence: number
}>) {
  return {
    content: [{
      type: "tool_use",
      id: "toolu_test",
      name: "extract_applications",
      input: { results },
    }],
  }
}

describe("sonnetClassify", () => {
  it("returns empty array for empty input without API call", async () => {
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    const results = await sonnetClassify([])
    expect(results).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("extracts company, roleTitle, status, location, confidence from tool use response", async () => {
    mockCreate.mockResolvedValue(toolResponse([{
      messageId: "msg-1",
      company: "Acme Corp",
      roleTitle: "Software Engineer",
      status: "OFFER",
      location: "Remote",
      confidence: 0.95,
    }]))
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

  it("returns NEEDS_REVIEW for all emails in batch on API failure", async () => {
    mockCreate.mockRejectedValue(new Error("API error"))
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    const results = await sonnetClassify([makeInput()])
    expect(results[0].status).toBe("NEEDS_REVIEW")
    expect(results[0].confidence).toBe(0)
  })

  it("returns NEEDS_REVIEW for emails missing from tool response", async () => {
    // Sonnet returns result for msg-1 but not msg-2
    mockCreate.mockResolvedValue(toolResponse([{
      messageId: "msg-1",
      company: "Acme Corp",
      roleTitle: "Software Engineer",
      status: "OFFER",
      location: "Remote",
      confidence: 0.95,
    }]))
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    const results = await sonnetClassify([makeInput("msg-1"), makeInput("msg-2")])
    expect(results).toHaveLength(2)
    expect(results[0].status).toBe("OFFER")
    expect(results[1].status).toBe("NEEDS_REVIEW")
  })

  it("returns NEEDS_REVIEW on malformed tool response (no tool_use block)", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "not a tool call" }] })
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    const results = await sonnetClassify([makeInput()])
    expect(results[0].status).toBe("NEEDS_REVIEW")
  })

  it("uses claude-sonnet-4-6 model with tool_choice", async () => {
    mockCreate.mockResolvedValue(toolResponse([{
      messageId: "msg-1",
      company: "Acme Corp",
      roleTitle: "Software Engineer",
      status: "APPLIED",
      location: null,
      confidence: 0.9,
    }]))
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    await sonnetClassify([makeInput()])
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-6",
        tool_choice: { type: "tool", name: "extract_applications" },
      })
    )
  })

  it("applies postProcess — uses companyHint as fallback when company is null", async () => {
    mockCreate.mockResolvedValue(toolResponse([{
      messageId: "msg-1",
      company: null,
      roleTitle: "Software Engineer",
      status: "APPLIED",
      location: null,
      confidence: 0.85,
    }]))
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    const input = { ...makeInput(), companyHint: "Acme" }
    const results = await sonnetClassify([input])
    expect(results[0].company).toBe("Acme")
  })

  it("batches emails into groups of 10 and makes one API call per batch", async () => {
    mockCreate.mockImplementation(async (_args: unknown) => {
      // Return results for all emails in the batch prompt
      const args = _args as { messages: Array<{ content: string }> }
      const content = args.messages[0].content
      const ids = [...content.matchAll(/\[msg-(\d+)\]/g)].map((m) => `msg-${m[1]}`)
      return toolResponse(ids.map((id) => ({
        messageId: id,
        company: "Acme",
        roleTitle: "Engineer",
        status: "APPLIED",
        location: null,
        confidence: 0.9,
      })))
    })
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    const inputs = Array.from({ length: 15 }, (_, i) => makeInput(`msg-${i}`))
    const results = await sonnetClassify(inputs)
    expect(results).toHaveLength(15)
    // 15 emails → 2 batches (10 + 5)
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it("runs batches in parallel (not sequentially)", async () => {
    let concurrent = 0
    let maxConcurrent = 0
    mockCreate.mockImplementation(async (_args: unknown) => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise((r) => setTimeout(r, 20))
      concurrent--
      const args = _args as { messages: Array<{ content: string }> }
      const content = args.messages[0].content
      const ids = [...content.matchAll(/\[msg-(\d+)\]/g)].map((m) => `msg-${m[1]}`)
      return toolResponse(ids.map((id) => ({
        messageId: id,
        company: "Acme",
        roleTitle: "Engineer",
        status: "APPLIED",
        location: null,
        confidence: 0.9,
      })))
    })
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    // 25 emails → 3 batches, should run in parallel
    const inputs = Array.from({ length: 25 }, (_, i) => makeInput(`msg-${i}`))
    await sonnetClassify(inputs)
    expect(maxConcurrent).toBeGreaterThan(1)
  })

  it("handles partial batch failure — failed batch returns NEEDS_REVIEW, other batches succeed", async () => {
    let callCount = 0
    mockCreate.mockImplementation(async (_args: unknown) => {
      callCount++
      if (callCount === 1) throw new Error("rate limit")
      const args = _args as { messages: Array<{ content: string }> }
      const content = args.messages[0].content
      const ids = [...content.matchAll(/\[msg-(\d+)\]/g)].map((m) => `msg-${m[1]}`)
      return toolResponse(ids.map((id) => ({
        messageId: id,
        company: "Acme",
        roleTitle: "Engineer",
        status: "APPLIED",
        location: null,
        confidence: 0.9,
      })))
    })
    const { sonnetClassify } = await import("@/server/services/classification/classify")
    // 15 emails → 2 batches, first fails
    const inputs = Array.from({ length: 15 }, (_, i) => makeInput(`msg-${i}`))
    const results = await sonnetClassify(inputs)
    expect(results).toHaveLength(15)
    // First batch (10 emails) failed → NEEDS_REVIEW
    const needsReview = results.filter((r) => r.status === "NEEDS_REVIEW")
    const succeeded = results.filter((r) => r.status !== "NEEDS_REVIEW")
    expect(needsReview.length).toBe(10)
    expect(succeeded.length).toBe(5)
  })
})
