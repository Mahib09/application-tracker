import { describe, it, expect } from "vitest"

// Type-level test: verify ClassificationResult accepts confidence
describe("ClassificationResult type", () => {
  it("accepts optional confidence field", async () => {
    const { sanitizeResult } = await import("@/server/services/classification.service")
    // If this compiles and runs, the type is correct
    const result = sanitizeResult({
      messageId: "m1",
      company: "Stripe",
      roleTitle: "Software Engineer",
      status: "APPLIED",
      location: null,
      date: new Date(),
      confidence: 0.9,
    })
    expect(result.confidence).toBe(0.9)
  })
})
