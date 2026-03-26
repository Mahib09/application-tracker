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

  it("strips salary figures with dollar sign", async () => {
    const { preprocessText } = await import("@/server/services/classification.service")
    const result = preprocessText("Subject", "The salary is $120,000 per year")
    expect(result).toContain("[salary]")
    expect(result).not.toContain("120,000")
  })

  it("strips salary figures with currency codes", async () => {
    const { preprocessText } = await import("@/server/services/classification.service")
    const result = preprocessText("Subject", "Compensation: CAD $95,000 - $110,000")
    expect(result).toContain("[salary]")
    expect(result).not.toContain("95,000")
  })

  it("truncates to 500 chars in snippet mode (default)", async () => {
    const { preprocessText } = await import("@/server/services/classification.service")
    const result = preprocessText("Subject", "a".repeat(1000))
    expect(result.length).toBeLessThanOrEqual(500)
  })

  it("truncates to 800 chars in body mode", async () => {
    const { preprocessText } = await import("@/server/services/classification.service")
    const result = preprocessText("Subject", "a".repeat(1000), "body")
    expect(result.length).toBeLessThanOrEqual(800)
    expect(result.length).toBeGreaterThan(500)
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
    expect(result).toMatchObject({ company: "Acme Corp", roleTitle: "" })
  })

  it("returns null for unrecognized subject format", async () => {
    const { extractCompanyAndRole } = await import("@/server/services/classification.service")
    const result = extractCompanyAndRole("Thanks for reaching out!")
    expect(result).toBeNull()
  })

  it("strips Re: prefix before parsing", async () => {
    const { extractCompanyAndRole } = await import("@/server/services/classification.service")
    const result = extractCompanyAndRole("Re: Software Engineer at Google")
    expect(result).toMatchObject({ company: "Google", roleTitle: "Software Engineer" })
  })

  it("strips Fwd: prefix before parsing", async () => {
    const { extractCompanyAndRole } = await import("@/server/services/classification.service")
    const result = extractCompanyAndRole("Fwd: Backend Engineer at Notion")
    expect(result).toMatchObject({ company: "Notion", roleTitle: "Backend Engineer" })
  })

  it("parses 'Thank you for applying to <Company>'", async () => {
    const { extractCompanyAndRole } = await import("@/server/services/classification.service")
    const result = extractCompanyAndRole("Thank you for applying to Stripe")
    expect(result).toMatchObject({ company: "Stripe", roleTitle: "" })
  })

  it("parses 'Interview for <Role> at <Company>'", async () => {
    const { extractCompanyAndRole } = await import("@/server/services/classification.service")
    const result = extractCompanyAndRole("Interview for Backend Engineer at Notion")
    expect(result).toMatchObject({ company: "Notion", roleTitle: "Backend Engineer" })
  })

  it("parses em dash '<Company> — <Role>'", async () => {
    const { extractCompanyAndRole } = await import("@/server/services/classification.service")
    const result = extractCompanyAndRole("Acme Corp — Product Designer")
    expect(result).toMatchObject({ company: "Acme Corp", roleTitle: "Product Designer" })
  })

  it("parses '<Company> has received your'", async () => {
    const { extractCompanyAndRole } = await import("@/server/services/classification.service")
    const result = extractCompanyAndRole("Google has received your application")
    expect(result).toMatchObject({ company: "Google", roleTitle: "" })
  })

  it("returns null when dash pattern produces a role with more than 6 words", async () => {
    const { extractCompanyAndRole } = await import("@/server/services/classification.service")
    // "Thank You for Your Interest in the Fullstack Engineer Opportunity" = 10 words
    const result = extractCompanyAndRole("MLSE - Thank You for Your Interest in the Fullstack Engineer Opportunity")
    expect(result).toBeNull()
  })

  it("still extracts correctly when dash pattern role is 6 words or fewer", async () => {
    const { extractCompanyAndRole } = await import("@/server/services/classification.service")
    const result = extractCompanyAndRole("Acme Corp - Senior Software Engineer")
    expect(result).toMatchObject({ company: "Acme Corp", roleTitle: "Senior Software Engineer" })
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

  it("returns APPLIED for 'application confirmation' in subject", async () => {
    const { classifyWithRegex } = await import("@/server/services/classification.service")
    expect(classifyWithRegex("Application confirmation from Stripe", "")).toBe("APPLIED")
  })

  it("returns INTERVIEW for 'would like to invite you' in subject", async () => {
    const { classifyWithRegex } = await import("@/server/services/classification.service")
    expect(classifyWithRegex("We'd like to invite you to interview", "")).toBe("INTERVIEW")
  })

  it("returns REJECTED for 'after careful consideration' in subject", async () => {
    const { classifyWithRegex } = await import("@/server/services/classification.service")
    expect(classifyWithRegex("After careful consideration we will not be moving forward", "")).toBe("REJECTED")
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

  it("returns empty company and roleTitle when AI returns null for those fields", async () => {
    const aiResponse = JSON.stringify([
      { messageId: "msg-1", company: null, roleTitle: null, status: "APPLIED", location: null },
    ])
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: aiResponse }] })

    const { classifyWithAI } = await import("@/server/services/classification.service")
    const input = [{ messageId: "msg-1", subject: "Application received", text: "snippet", date: new Date() }]
    const results = await classifyWithAI(input)

    expect(results[0].company).toBe("")
    expect(results[0].roleTitle).toBe("")
  })

  it("does not return Unknown or Unknown Role from parse failure fallback", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "not valid json {{{" }] })

    const { classifyWithAI } = await import("@/server/services/classification.service")
    const input = [{ messageId: "msg-1", subject: "Update", text: "snippet", date: new Date() }]
    const results = await classifyWithAI(input)

    expect(results[0].company).not.toBe("Unknown")
    expect(results[0].roleTitle).not.toBe("Unknown Role")
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

  it("Stage 2 unresolvable emails are included as NEEDS_REVIEW", async () => {
    const aiResponse = JSON.stringify([
      { messageId: "msg-1", company: "Acme Corp", roleTitle: "Engineer", status: "NEEDS_REVIEW" },
    ])
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: aiResponse }] })

    const { classifyBatch } = await import("@/server/services/classification.service")
    const emails = [
      { messageId: "msg-1", subject: "Update", snippet: "See details inside", date: new Date() },
    ]
    const results = await classifyBatch(emails, {} as any)
    expect(results[0].status).toBe("NEEDS_REVIEW")
    // No Stage 3: fetchFullEmail should NOT be called
  })

  it("AI response omitting non-job emails means they are discarded", async () => {
    // AI returns empty array (discarded the newsletter)
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "[]" }] })

    const { classifyBatch } = await import("@/server/services/classification.service")
    const emails = [
      { messageId: "msg-1", subject: "Weekly Newsletter", snippet: "Top stories this week", date: new Date() },
    ]
    const results = await classifyBatch(emails, {} as any)
    expect(results).toHaveLength(0)
  })

  it("Stage 3 is triggered when Stage 2 returns missing roleTitle", async () => {
    // Stage 2: company found but no role
    const stage2Response = JSON.stringify([
      { messageId: "msg-1", company: "Google", roleTitle: null, status: "APPLIED", location: null },
    ])
    // Stage 3: role found from body
    const stage3Response = JSON.stringify([
      { messageId: "msg-1", company: "Google", roleTitle: "Software Engineer", status: "APPLIED", location: null },
    ])
    mockCreate
      .mockResolvedValueOnce({ content: [{ type: "text", text: stage2Response }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: stage3Response }] })
    vi.mocked(fetchFullEmail).mockResolvedValue("We are pleased to confirm your application for the Software Engineer role.")

    const { classifyBatch } = await import("@/server/services/classification.service")
    const emails = [
      { messageId: "msg-1", subject: "Your application to Google", snippet: "We received it", date: new Date() },
    ]
    const results = await classifyBatch(emails, {} as any)

    expect(fetchFullEmail).toHaveBeenCalledWith({}, "msg-1")
    expect(results[0].roleTitle).toBe("Software Engineer")
  })

  it("Stage 3 is triggered when Stage 2 returns missing company", async () => {
    const stage2Response = JSON.stringify([
      { messageId: "msg-1", company: null, roleTitle: "Software Engineer", status: "APPLIED", location: null },
    ])
    const stage3Response = JSON.stringify([
      { messageId: "msg-1", company: "Stripe", roleTitle: "Software Engineer", status: "APPLIED", location: null },
    ])
    mockCreate
      .mockResolvedValueOnce({ content: [{ type: "text", text: stage2Response }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: stage3Response }] })
    vi.mocked(fetchFullEmail).mockResolvedValue("Thank you for applying to Stripe.")

    const { classifyBatch } = await import("@/server/services/classification.service")
    const emails = [
      { messageId: "msg-1", subject: "Application confirmation", snippet: "We received it", date: new Date() },
    ]
    const results = await classifyBatch(emails, {} as any)

    expect(results[0].company).toBe("Stripe")
  })

  it("Stage 3 is NOT triggered when Stage 2 resolves both company and role", async () => {
    const stage2Response = JSON.stringify([
      { messageId: "msg-1", company: "Stripe", roleTitle: "Software Engineer", status: "APPLIED", location: null },
    ])
    mockCreate.mockResolvedValueOnce({ content: [{ type: "text", text: stage2Response }] })

    const { classifyBatch } = await import("@/server/services/classification.service")
    const emails = [
      { messageId: "msg-1", subject: "Application confirmation", snippet: "snippet", date: new Date() },
    ]
    await classifyBatch(emails, {} as any)

    expect(fetchFullEmail).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it("Stage 3 falls back to NEEDS_REVIEW if body also unresolvable", async () => {
    const stage2Response = JSON.stringify([
      { messageId: "msg-1", company: "Acme", roleTitle: null, status: "APPLIED", location: null },
    ])
    const stage3Response = JSON.stringify([
      { messageId: "msg-1", company: "Acme", roleTitle: null, status: "NEEDS_REVIEW", location: null },
    ])
    mockCreate
      .mockResolvedValueOnce({ content: [{ type: "text", text: stage2Response }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: stage3Response }] })
    vi.mocked(fetchFullEmail).mockResolvedValue("Your application has been received.")

    const { classifyBatch } = await import("@/server/services/classification.service")
    const emails = [
      { messageId: "msg-1", subject: "Application update", snippet: "snippet", date: new Date() },
    ]
    const results = await classifyBatch(emails, {} as any)

    // Kept with partial data — company preserved, role empty
    expect(results[0].company).toBe("Acme")
    expect(results[0].status).toBe("NEEDS_REVIEW")
  })

  it("Stage 3 discards non-job emails identified from full body", async () => {
    // Stage 2 returns one field populated (company only) — triggers Stage 3
    const stage2Response = JSON.stringify([
      { messageId: "msg-1", company: "Acme", roleTitle: null, status: "NEEDS_REVIEW", location: null },
    ])
    // Stage 3 AI discards it (returns empty array)
    mockCreate
      .mockResolvedValueOnce({ content: [{ type: "text", text: stage2Response }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "[]" }] })
    vi.mocked(fetchFullEmail).mockResolvedValue("Meeting invite: standup at 9am")

    const { classifyBatch } = await import("@/server/services/classification.service")
    const emails = [
      { messageId: "msg-1", subject: "Invitation", snippet: "See calendar", date: new Date() },
    ]
    const results = await classifyBatch(emails, {} as any)

    expect(results).toHaveLength(0)
  })
})

describe("sanitizeResult — artifact filtering", () => {
  beforeEach(() => vi.clearAllMocks())

  it("clears 'Application Confirmation' as roleTitle", async () => {
    const { sanitizeResult } = await import("@/server/services/classification.service")
    const result = sanitizeResult({
      messageId: "m1", company: "Stripe", roleTitle: "Application Confirmation",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.roleTitle).toBe("")
  })

  it("clears 'Application Update' as roleTitle", async () => {
    const { sanitizeResult } = await import("@/server/services/classification.service")
    const result = sanitizeResult({
      messageId: "m1", company: "Stripe", roleTitle: "Application Update",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.roleTitle).toBe("")
  })

  it("clears 'Application Received' as roleTitle", async () => {
    const { sanitizeResult } = await import("@/server/services/classification.service")
    const result = sanitizeResult({
      messageId: "m1", company: "Stripe", roleTitle: "Application Received",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.roleTitle).toBe("")
  })

  it("does NOT clear 'Application Security Engineer' (partial match guard)", async () => {
    const { sanitizeResult } = await import("@/server/services/classification.service")
    const result = sanitizeResult({
      messageId: "m1", company: "Stripe", roleTitle: "Application Security Engineer",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.roleTitle).toBe("Application Security Engineer")
  })

  it("swaps company to roleTitle when company is 'Junior Developer' and role is empty", async () => {
    const { sanitizeResult } = await import("@/server/services/classification.service")
    const result = sanitizeResult({
      messageId: "m1", company: "Junior Developer", roleTitle: "",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.company).toBe("")
    expect(result.roleTitle).toBe("Junior Developer")
  })

  it("swaps company to roleTitle when company is 'Software Engineer (entry)' and role is empty", async () => {
    const { sanitizeResult } = await import("@/server/services/classification.service")
    const result = sanitizeResult({
      messageId: "m1", company: "Software Engineer (entry)", roleTitle: "",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.company).toBe("")
    expect(result.roleTitle).toBe("Software Engineer (entry)")
  })

  it("does NOT swap when roleTitle is already populated", async () => {
    const { sanitizeResult } = await import("@/server/services/classification.service")
    const result = sanitizeResult({
      messageId: "m1", company: "Junior Developer", roleTitle: "Backend Engineer",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.company).toBe("Junior Developer")
    expect(result.roleTitle).toBe("Backend Engineer")
  })

  it("clears artifact roleTitle then leaves valid company intact (no swap)", async () => {
    const { sanitizeResult } = await import("@/server/services/classification.service")
    const result = sanitizeResult({
      messageId: "m1", company: "Google", roleTitle: "Application Confirmation",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.company).toBe("Google")
    expect(result.roleTitle).toBe("")
  })

  it("clears 'Application Status' as roleTitle", async () => {
    const { sanitizeResult } = await import("@/server/services/classification.service")
    const result = sanitizeResult({
      messageId: "m1", company: "Stripe", roleTitle: "Application Status",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.roleTitle).toBe("")
  })

  it("clears 'Your Application' as roleTitle", async () => {
    const { sanitizeResult } = await import("@/server/services/classification.service")
    const result = sanitizeResult({
      messageId: "m1", company: "Stripe", roleTitle: "Your Application",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.roleTitle).toBe("")
  })

  it("clears 'Thank you for applying' as roleTitle", async () => {
    const { sanitizeResult } = await import("@/server/services/classification.service")
    const result = sanitizeResult({
      messageId: "m1", company: "Stripe", roleTitle: "Thank you for applying",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.roleTitle).toBe("")
  })

  it("clears 'Thank you for your application' as roleTitle", async () => {
    const { sanitizeResult } = await import("@/server/services/classification.service")
    const result = sanitizeResult({
      messageId: "m1", company: "Stripe", roleTitle: "Thank you for your application",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.roleTitle).toBe("")
  })
})

describe("normalizeRoleTitle", () => {
  beforeEach(() => vi.clearAllMocks())

  it("strips level qualifiers", async () => {
    const { normalizeRoleTitle } = await import("@/server/services/classification.service")
    expect(normalizeRoleTitle("Senior Software Engineer")).toBe("software engineer")
    expect(normalizeRoleTitle("Junior Developer")).toBe("develop")
    expect(normalizeRoleTitle("Lead Frontend Engineer")).toBe("frontend engineer")
  })

  it("strips employment type qualifiers", async () => {
    const { normalizeRoleTitle } = await import("@/server/services/classification.service")
    expect(normalizeRoleTitle("Software Engineer, New Grad")).toBe("software engineer")
    expect(normalizeRoleTitle("Frontend Developer (Contract)")).toBe("frontend develop")
  })

  it("strips tech stack parentheticals", async () => {
    const { normalizeRoleTitle } = await import("@/server/services/classification.service")
    expect(normalizeRoleTitle("Full Stack Developer (React + Next.js)")).toBe("full stack develop")
  })

  it("normalizes developer/development to 'develop'", async () => {
    const { normalizeRoleTitle } = await import("@/server/services/classification.service")
    expect(normalizeRoleTitle("Software Developer")).toBe("software develop")
    expect(normalizeRoleTitle("Frontend Development")).toBe("frontend develop")
  })

  it("normalizes engineering to 'engineer'", async () => {
    const { normalizeRoleTitle } = await import("@/server/services/classification.service")
    expect(normalizeRoleTitle("Software Engineering")).toBe("software engineer")
  })

  it("normalizes punctuation to spaces", async () => {
    const { normalizeRoleTitle } = await import("@/server/services/classification.service")
    expect(normalizeRoleTitle("Frontend/Mobile Developer")).toBe("frontend mobile develop")
  })
})

describe("roleTitlesSimilar", () => {
  beforeEach(() => vi.clearAllMocks())

  it("matches Float-style role title variations (≥60% Jaccard)", async () => {
    const { roleTitlesSimilar } = await import("@/server/services/classification.service")
    expect(
      roleTitlesSimilar("Software Developer - Frontend / Mobile", "Frontend/Mobile Development (Senior)")
    ).toBe(true)
  })

  it("matches same title with different level qualifiers", async () => {
    const { roleTitlesSimilar } = await import("@/server/services/classification.service")
    expect(roleTitlesSimilar("Senior Software Engineer", "Software Engineer")).toBe(true)
  })

  it("does NOT match distinct roles (Software Engineer vs Software Developer)", async () => {
    const { roleTitlesSimilar } = await import("@/server/services/classification.service")
    expect(roleTitlesSimilar("Software Engineer", "Software Developer")).toBe(false)
  })

  it("does NOT match Full Stack Engineer vs Full Stack Developer (50% overlap)", async () => {
    const { roleTitlesSimilar } = await import("@/server/services/classification.service")
    expect(roleTitlesSimilar("Full Stack Engineer", "Full Stack Developer")).toBe(false)
  })

  it("returns false when either title is empty", async () => {
    const { roleTitlesSimilar } = await import("@/server/services/classification.service")
    expect(roleTitlesSimilar("", "Software Engineer")).toBe(false)
    expect(roleTitlesSimilar("Software Engineer", "")).toBe(false)
  })
})
