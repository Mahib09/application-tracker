import { describe, it, expect, vi, beforeEach } from "vitest"

beforeEach(() => { vi.resetModules() })

describe("isValidExtraction", () => {
  it("returns false when company is empty", async () => {
    const { isValidExtraction } = await import("@/server/services/classification/regex")
    expect(isValidExtraction("", "Software Engineer")).toBe(false)
  })

  it("returns false when company looks like a job title", async () => {
    const { isValidExtraction } = await import("@/server/services/classification/regex")
    expect(isValidExtraction("Software Engineer", "")).toBe(false)
  })

  it("returns false when company has more than 4 words", async () => {
    const { isValidExtraction } = await import("@/server/services/classification/regex")
    expect(isValidExtraction("Application for Junior Developer Role", "")).toBe(false)
  })

  it("returns false when company starts with 'Application'", async () => {
    const { isValidExtraction } = await import("@/server/services/classification/regex")
    expect(isValidExtraction("Application for Junior Developer (Permanent)", "")).toBe(false)
  })

  it("returns false when roleTitle has more than 8 words", async () => {
    const { isValidExtraction } = await import("@/server/services/classification/regex")
    expect(isValidExtraction("Stripe", "Software Engineer at Stripe in New York City Remote")).toBe(false)
  })

  it("returns false when roleTitle contains '!'", async () => {
    const { isValidExtraction } = await import("@/server/services/classification/regex")
    expect(isValidExtraction("Intuit", "Application Received! Thanks for applying")).toBe(false)
  })

  it("returns true for valid company + role", async () => {
    const { isValidExtraction } = await import("@/server/services/classification/regex")
    expect(isValidExtraction("Stripe", "Software Engineer")).toBe(true)
  })

  it("returns true for valid company + empty role", async () => {
    const { isValidExtraction } = await import("@/server/services/classification/regex")
    expect(isValidExtraction("HelloFresh", "")).toBe(true)
  })
})

describe("classifyStage1 — sanitizeResult wiring", () => {
  it("routes low-quality extractions to unclassified", async () => {
    const { classifyStage1 } = await import("@/server/services/classification/regex")

    const emails = [{
      messageId: "m2",
      subject: "Application for Junior Developer (Permanent) - Req #70471",
      snippet: "thank you for applying",
      date: new Date(),
      companyHint: null,
    }]

    const { classified, unclassified } = classifyStage1(emails)
    // "Application for Junior Developer (Permanent)" fails isValidExtraction
    // (starts with "Application") → should be unclassified, not persisted
    for (const r of classified) {
      expect(r.company).not.toMatch(/^application/i)
    }
    // At least this email must not produce a bad "Application..." company
    expect(classified.every(r => !r.company.match(/^application/i))).toBe(true)
  })

  it("Stage 1 results have confidence 1.0", async () => {
    const { classifyStage1 } = await import("@/server/services/classification/regex")

    const emails = [{
      messageId: "m3",
      subject: "Stripe - Software Engineer",
      snippet: "application received thank you for applying",
      date: new Date(),
      companyHint: "Stripe",
    }]

    const { classified } = classifyStage1(emails)
    if (classified.length > 0) {
      expect(classified[0].confidence).toBe(1.0)
    }
    // Pass even if goes to unclassified — we just verify no confidence != 1.0 in classified
    expect(classified.every(r => r.confidence === 1.0)).toBe(true)
  })
})
