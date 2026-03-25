import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock Anthropic SDK
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}))

vi.mock("@anthropic-ai/sdk", () => ({
  default: function AnthropicMock() {
    return { messages: { create: mockCreate } }
  },
}))

// Mock gmail service (fetchFullEmail used in Stage 3)
vi.mock("@/server/services/gmail.service", () => ({
  fetchFullEmail: vi.fn(),
}))

import { fetchFullEmail } from "@/server/services/gmail.service"

// ─── preprocessText ──────────────────────────────────────────────────────────

describe("preprocessText", () => {
  beforeEach(() => vi.clearAllMocks())

  it("strips HTML tags", async () => {
    const { preprocessText } = await import("@/server/services/classification.service")
    const result = preprocessText("Subject", "<p>Hello <b>World</b></p>")
    expect(result).not.toContain("<p>")
    expect(result).not.toContain("<b>")
    expect(result).toContain("Hello")
    expect(result).toContain("World")
  })

  it("replaces email addresses with [email]", async () => {
    const { preprocessText } = await import("@/server/services/classification.service")
    const result = preprocessText("Subject", "Contact us at recruiter@company.com for details")
    expect(result).toContain("[email]")
    expect(result).not.toContain("recruiter@company.com")
  })

  it("replaces phone numbers with [phone]", async () => {
    const { preprocessText } = await import("@/server/services/classification.service")
    const result = preprocessText("Subject", "Call us at 555-123-4567 to schedule")
    expect(result).toContain("[phone]")
    expect(result).not.toContain("555-123-4567")
  })

  it("replaces URLs with [url]", async () => {
    const { preprocessText } = await import("@/server/services/classification.service")
    const result = preprocessText("Subject", "Visit https://company.com/jobs to apply")
    expect(result).toContain("[url]")
    expect(result).not.toContain("https://company.com/jobs")
  })

  it("truncates to 500 characters", async () => {
    const { preprocessText } = await import("@/server/services/classification.service")
    const longText = "a".repeat(1000)
    const result = preprocessText("Subject", longText)
    expect(result.length).toBeLessThanOrEqual(500)
  })
})

// ─── extractCompanyAndRole ───────────────────────────────────────────────────

describe("extractCompanyAndRole", () => {
  beforeEach(() => vi.clearAllMocks())

  it("parses '<Role> at <Company>' pattern", async () => {
    const { extractCompanyAndRole } = await import("@/server/services/classification.service")
    const result = extractCompanyAndRole("Software Engineer at Acme Corp")
    expect(result).toMatchObject({ company: "Acme Corp", roleTitle: "Software Engineer" })
  })

  it("parses '<Company> - <Role>' pattern", async () => {
    const { extractCompanyAndRole } = await import("@/server/services/classification.service")
    const result = extractCompanyAndRole("Acme Corp - Software Engineer")
    expect(result).toMatchObject({ company: "Acme Corp", roleTitle: "Software Engineer" })
  })

  it("parses 'Your application to <Company>' pattern", async () => {
    const { extractCompanyAndRole } = await import("@/server/services/classification.service")
    const result = extractCompanyAndRole("Your application to Acme Corp")
    expect(result).toMatchObject({ company: "Acme Corp", roleTitle: "Unknown Role" })
  })

  it("returns null for unrecognized subject format", async () => {
    const { extractCompanyAndRole } = await import("@/server/services/classification.service")
    const result = extractCompanyAndRole("Thanks for reaching out!")
    expect(result).toBeNull()
  })
})

// ─── classifyWithRegex ───────────────────────────────────────────────────────

describe("classifyWithRegex", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns OFFER for 'offer letter' in subject", async () => {
    const { classifyWithRegex } = await import("@/server/services/classification.service")
    expect(classifyWithRegex("Your offer letter from Acme Corp", "")).toBe("OFFER")
  })

  it("returns OFFER for 'pleased to offer' in snippet", async () => {
    const { classifyWithRegex } = await import("@/server/services/classification.service")
    expect(classifyWithRegex("Congratulations", "We are pleased to offer you the position")).toBe("OFFER")
  })

  it("returns INTERVIEW for 'interview' in subject", async () => {
    const { classifyWithRegex } = await import("@/server/services/classification.service")
    expect(classifyWithRegex("Interview invitation - Engineer at Acme", "")).toBe("INTERVIEW")
  })

  it("returns INTERVIEW for 'phone screen' in snippet", async () => {
    const { classifyWithRegex } = await import("@/server/services/classification.service")
    expect(classifyWithRegex("Next steps", "We'd like to schedule a phone screen with you")).toBe("INTERVIEW")
  })

  it("returns APPLIED for 'application received' in snippet", async () => {
    const { classifyWithRegex } = await import("@/server/services/classification.service")
    expect(classifyWithRegex("Thank you", "We have received your application")).toBe("APPLIED")
  })

  it("returns REJECTED for 'not moving forward' in snippet", async () => {
    const { classifyWithRegex } = await import("@/server/services/classification.service")
    expect(classifyWithRegex("Update on your application", "We will not be moving forward with your application")).toBe("REJECTED")
  })

  it("returns null for unrecognized text", async () => {
    const { classifyWithRegex } = await import("@/server/services/classification.service")
    expect(classifyWithRegex("Hello", "Just checking in")).toBeNull()
  })
})

// ─── classifyWithAI ──────────────────────────────────────────────────────────

describe("classifyWithAI", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls Claude API and returns ClassificationResult array", async () => {
    const aiResponse = JSON.stringify([
      { messageId: "msg-1", company: "Acme Corp", roleTitle: "Engineer", status: "APPLIED" },
    ])
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: aiResponse }],
    })

    const { classifyWithAI } = await import("@/server/services/classification.service")
    const input = [{ messageId: "msg-1", subject: "Application received", text: "We got your app", date: new Date() }]
    const results = await classifyWithAI(input)

    expect(mockCreate).toHaveBeenCalledOnce()
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ messageId: "msg-1", company: "Acme Corp", status: "APPLIED" })
  })

  it("returns empty array for empty input without calling API", async () => {
    const { classifyWithAI } = await import("@/server/services/classification.service")
    const results = await classifyWithAI([])
    expect(results).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("batches emails into groups of 20", async () => {
    const aiResponse = JSON.stringify(
      Array.from({ length: 25 }, (_, i) => ({
        messageId: `msg-${i}`,
        company: "Acme",
        roleTitle: "Engineer",
        status: "APPLIED",
      }))
    )
    // Return same response for both batches
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: aiResponse }] })

    const { classifyWithAI } = await import("@/server/services/classification.service")
    const input = Array.from({ length: 25 }, (_, i) => ({
      messageId: `msg-${i}`,
      subject: "Application",
      text: "received",
      date: new Date(),
    }))
    await classifyWithAI(input)

    // 25 emails → 2 batches (20 + 5)
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })
})

// ─── classifyBatch ───────────────────────────────────────────────────────────

describe("classifyBatch", () => {
  beforeEach(() => vi.clearAllMocks())

  it("Stage 1 classified emails do not reach Stage 2", async () => {
    const { classifyBatch } = await import("@/server/services/classification.service")

    const emails = [
      {
        messageId: "msg-1",
        subject: "Your offer letter from Acme Corp - Software Engineer",
        snippet: "Please review and sign",
        date: new Date(),
      },
    ]

    const results = await classifyBatch(emails, {} as any)

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe("OFFER")
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("Stage 2 AI is called only for Stage 1 unclassified emails", async () => {
    const aiResponse = JSON.stringify([
      { messageId: "msg-1", company: "Acme Corp", roleTitle: "Engineer", status: "APPLIED" },
    ])
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: aiResponse }] })

    const { classifyBatch } = await import("@/server/services/classification.service")

    const emails = [
      { messageId: "msg-1", subject: "Hello from Acme", snippet: "Just wanted to touch base", date: new Date() },
    ]

    const results = await classifyBatch(emails, {} as any)
    expect(mockCreate).toHaveBeenCalledOnce()
    expect(results[0].status).toBe("APPLIED")
  })

  it("Stage 3 re-fetches full body for Stage 2 unclassified emails", async () => {
    // Stage 2 returns NEEDS_REVIEW → triggers Stage 3
    const stage2Response = JSON.stringify([
      { messageId: "msg-1", company: "Acme Corp", roleTitle: "Engineer", status: "NEEDS_REVIEW" },
    ])
    // Stage 3 resolves it
    const stage3Response = JSON.stringify([
      { messageId: "msg-1", company: "Acme Corp", roleTitle: "Engineer", status: "INTERVIEW" },
    ])
    mockCreate
      .mockResolvedValueOnce({ content: [{ type: "text", text: stage2Response }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: stage3Response }] })

    vi.mocked(fetchFullEmail).mockResolvedValue("We would like to invite you for an interview")

    const { classifyBatch } = await import("@/server/services/classification.service")

    const emails = [
      { messageId: "msg-1", subject: "Update", snippet: "See details inside", date: new Date() },
    ]

    const results = await classifyBatch(emails, {} as any)

    expect(fetchFullEmail).toHaveBeenCalledWith({}, "msg-1")
    expect(results[0].status).toBe("INTERVIEW")
  })

  it("Stage 3 fallback sets status to NEEDS_REVIEW", async () => {
    const needsReviewResponse = JSON.stringify([
      { messageId: "msg-1", company: "Acme Corp", roleTitle: "Engineer", status: "NEEDS_REVIEW" },
    ])
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: needsReviewResponse }] })
    vi.mocked(fetchFullEmail).mockResolvedValue("Some ambiguous content")

    const { classifyBatch } = await import("@/server/services/classification.service")

    const emails = [
      { messageId: "msg-1", subject: "Update", snippet: "See details", date: new Date() },
    ]

    const results = await classifyBatch(emails, {} as any)
    expect(results[0].status).toBe("NEEDS_REVIEW")
  })
})
