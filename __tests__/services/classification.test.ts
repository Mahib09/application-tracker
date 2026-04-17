import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock all external dependencies
const { mockHaikuTriage, mockSonnetClassify, mockFetchFullEmail } = vi.hoisted(() => ({
  mockHaikuTriage: vi.fn(),
  mockSonnetClassify: vi.fn(),
  mockFetchFullEmail: vi.fn(),
}))

vi.mock("@/server/services/classification/filter", () => ({
  isDeterministicallyFiltered: vi.fn().mockReturnValue(false),
}))
vi.mock("@/server/services/classification/triage", () => ({
  haikuTriage: mockHaikuTriage,
}))
vi.mock("@/server/services/classification/classify", () => ({
  sonnetClassify: mockSonnetClassify,
}))
vi.mock("@/server/services/gmail.service", () => ({
  fetchFullEmail: mockFetchFullEmail,
}))

import { isDeterministicallyFiltered } from "@/server/services/classification/filter"

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.mocked(isDeterministicallyFiltered).mockReturnValue(false)
  mockHaikuTriage.mockResolvedValue([])
  mockSonnetClassify.mockResolvedValue([])
  mockFetchFullEmail.mockResolvedValue("Full email body text")
})

function makeEmail(id: string): import("@/server/services/gmail.service").EmailRaw {
  return {
    messageId: id,
    subject: "Software Engineer at Acme",
    snippet: "We received your application",
    date: new Date("2025-03-01"),
    from: "hr@acme.com",
    companyHint: "Acme",
    isATS: false,
    listUnsubscribe: null,
    labelIds: ["INBOX"],
  }
}

function makeResult(id: string, status = "APPLIED", confidence = 0.95) {
  return {
    messageId: id,
    company: "Acme Corp",
    roleTitle: "Software Engineer",
    status,
    location: null,
    date: new Date("2025-03-01"),
    confidence,
  }
}

describe("classifyPipeline", () => {
  it("returns empty results and zero stats for empty input", async () => {
    const { classifyPipeline } = await import("@/server/services/classification.service")
    const { results, stats } = await classifyPipeline([], {} as any)
    expect(results).toEqual([])
    expect(stats.filteredCount).toBe(0)
    expect(stats.sonnetCallCount).toBe(0)
  })

  it("increments filteredCount for emails dropped by deterministic filter", async () => {
    vi.mocked(isDeterministicallyFiltered).mockReturnValue(true)
    const { classifyPipeline } = await import("@/server/services/classification.service")
    const { stats } = await classifyPipeline([makeEmail("msg-1")], {} as any)
    expect(stats.filteredCount).toBe(1)
    expect(mockHaikuTriage).not.toHaveBeenCalled()
  })

  it("drops NO emails from Haiku and counts triageNoCount", async () => {
    mockHaikuTriage.mockResolvedValue([{ messageId: "msg-1", result: "NO" }])
    const { classifyPipeline } = await import("@/server/services/classification.service")
    const { stats } = await classifyPipeline([makeEmail("msg-1")], {} as any)
    expect(stats.triageNoCount).toBe(1)
    expect(mockSonnetClassify).not.toHaveBeenCalled()
  })

  it("passes YES emails to Sonnet and counts triageYesCount", async () => {
    mockHaikuTriage.mockResolvedValue([{ messageId: "msg-1", result: "YES" }])
    mockSonnetClassify.mockResolvedValue([makeResult("msg-1")])
    const { classifyPipeline } = await import("@/server/services/classification.service")
    const { stats } = await classifyPipeline([makeEmail("msg-1")], {} as any)
    expect(stats.triageYesCount).toBe(1)
    expect(mockSonnetClassify).toHaveBeenCalledOnce()
  })

  it("passes UNCERTAIN emails to Sonnet and counts triageUncertainCount", async () => {
    mockHaikuTriage.mockResolvedValue([{ messageId: "msg-1", result: "UNCERTAIN" }])
    mockSonnetClassify.mockResolvedValue([makeResult("msg-1")])
    const { classifyPipeline } = await import("@/server/services/classification.service")
    const { stats } = await classifyPipeline([makeEmail("msg-1")], {} as any)
    expect(stats.triageUncertainCount).toBe(1)
    expect(mockSonnetClassify).toHaveBeenCalledOnce()
  })

  it("auto-commits results with confidence > 0.9 (keeps original status)", async () => {
    mockHaikuTriage.mockResolvedValue([{ messageId: "msg-1", result: "YES" }])
    mockSonnetClassify.mockResolvedValue([makeResult("msg-1", "APPLIED", 0.95)])
    const { classifyPipeline } = await import("@/server/services/classification.service")
    const { results, stats } = await classifyPipeline([makeEmail("msg-1")], {} as any)
    expect(stats.autoCommitCount).toBe(1)
    expect(results[0].status).toBe("APPLIED")
  })

  it("flags results with confidence 0.7–0.9 (keeps status, increments reviewFlagCount)", async () => {
    mockHaikuTriage.mockResolvedValue([{ messageId: "msg-1", result: "YES" }])
    mockSonnetClassify.mockResolvedValue([makeResult("msg-1", "APPLIED", 0.8)])
    const { classifyPipeline } = await import("@/server/services/classification.service")
    const { results, stats } = await classifyPipeline([makeEmail("msg-1")], {} as any)
    expect(stats.reviewFlagCount).toBe(1)
    expect(results[0].status).toBe("APPLIED")
  })

  it("forces NEEDS_REVIEW for confidence < 0.7 (increments manualQueueCount)", async () => {
    mockHaikuTriage.mockResolvedValue([{ messageId: "msg-1", result: "YES" }])
    mockSonnetClassify.mockResolvedValue([makeResult("msg-1", "APPLIED", 0.5)])
    const { classifyPipeline } = await import("@/server/services/classification.service")
    const { results, stats } = await classifyPipeline([makeEmail("msg-1")], {} as any)
    expect(stats.manualQueueCount).toBe(1)
    expect(results[0].status).toBe("NEEDS_REVIEW")
  })

  it("produces NEEDS_REVIEW for emails where fetchFullEmail fails", async () => {
    mockHaikuTriage.mockResolvedValue([{ messageId: "msg-1", result: "YES" }])
    mockFetchFullEmail.mockRejectedValue(new Error("network error"))
    const { classifyPipeline } = await import("@/server/services/classification.service")
    const { results } = await classifyPipeline([makeEmail("msg-1")], {} as any)
    expect(results[0].status).toBe("NEEDS_REVIEW")
    expect(results[0].confidence).toBe(0)
    expect(mockSonnetClassify).not.toHaveBeenCalled()
  })

  it("counts sonnetCallCount as number of batches (ceil(emails/10))", async () => {
    mockHaikuTriage.mockResolvedValue([
      { messageId: "msg-1", result: "YES" },
      { messageId: "msg-2", result: "YES" },
    ])
    mockSonnetClassify.mockResolvedValue([
      makeResult("msg-1"),
      makeResult("msg-2"),
    ])
    const { classifyPipeline } = await import("@/server/services/classification.service")
    const { stats } = await classifyPipeline([makeEmail("msg-1"), makeEmail("msg-2")], {} as any)
    // 2 emails → 1 batch (ceil(2/10) = 1)
    expect(stats.sonnetCallCount).toBe(1)
  })
})

// ─── preprocessText ──────────────────────────────────────────────────────────

describe("preprocessText", () => {
  it("truncates to 500 chars in snippet mode (default)", async () => {
    const { preprocessText } = await import("@/server/services/classification.service")
    expect(preprocessText("Subject", "a".repeat(1000)).length).toBeLessThanOrEqual(500)
  })

  it("truncates to 800 chars in body mode", async () => {
    const { preprocessText } = await import("@/server/services/classification.service")
    const result = preprocessText("Subject", "a".repeat(1000), "body")
    expect(result.length).toBeLessThanOrEqual(800)
    expect(result.length).toBeGreaterThan(500)
  })

  it("truncates to 2000 chars in sonnet mode", async () => {
    const { preprocessText } = await import("@/server/services/classification.service")
    const result = preprocessText("Subject", "a".repeat(3000), "sonnet")
    expect(result.length).toBeLessThanOrEqual(2000)
    expect(result.length).toBeGreaterThan(800)
  })

  it("strips PII (email, phone, url, salary) in all modes", async () => {
    const { preprocessText } = await import("@/server/services/classification.service")
    const result = preprocessText(
      "Subject",
      "Contact recruiter@company.com or call 555-123-4567. Visit https://jobs.co. Salary $120,000"
    )
    expect(result).toContain("[email]")
    expect(result).toContain("[phone]")
    expect(result).toContain("[url]")
    expect(result).toContain("[salary]")
  })
})

// ─── Re-exports still work ───────────────────────────────────────────────────

describe("re-exports", () => {
  it("exports roleTitlesSimilar", async () => {
    const mod = await import("@/server/services/classification.service")
    expect(typeof mod.roleTitlesSimilar).toBe("function")
  })

  it("exports normalizeRoleTitle", async () => {
    const mod = await import("@/server/services/classification.service")
    expect(typeof mod.normalizeRoleTitle).toBe("function")
  })
})
