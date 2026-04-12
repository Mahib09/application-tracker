import { describe, it, expect, beforeEach, vi } from "vitest"

// Reset module cache between tests so each import is fresh
beforeEach(() => { vi.resetModules() })

describe("rescueRole", () => {
  it("extracts role from 'applying to X Role'", async () => {
    const { rescueRole } = await import("@/server/services/classification/sanitize")
    expect(rescueRole("Application Received! Thanks for applying to the Software Developer 1 Role"))
      .toBe("Software Developer 1")
  })

  it("extracts role from 'for the X position'", async () => {
    const { rescueRole } = await import("@/server/services/classification/sanitize")
    expect(rescueRole("Thank you for applying for the Senior Engineer position"))
      .toBe("Senior Engineer")
  })

  it("returns null when no pattern matches", async () => {
    const { rescueRole } = await import("@/server/services/classification/sanitize")
    expect(rescueRole("We received your application")).toBeNull()
  })

  it("returns null for empty string", async () => {
    const { rescueRole } = await import("@/server/services/classification/sanitize")
    expect(rescueRole("")).toBeNull()
  })

  it("returns null for 'applying for the role' with no actual title", async () => {
    const { rescueRole } = await import("@/server/services/classification/sanitize")
    expect(rescueRole("Thank you for applying for the role")).toBeNull()
  })

  it("returns null for 'applying to the position' with no actual title", async () => {
    const { rescueRole } = await import("@/server/services/classification/sanitize")
    expect(rescueRole("We appreciate you applying to the position")).toBeNull()
  })
})

describe("sanitizeResult — new behaviors", () => {
  it("strips trailing ', PersonName' from company", async () => {
    const { sanitizeResult } = await import("@/server/services/classification/sanitize")
    const result = sanitizeResult({
      messageId: "m1", company: "MLSE, Mahib", roleTitle: "",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.company).toBe("MLSE")
  })

  it("does NOT strip ', Inc' from company", async () => {
    const { sanitizeResult } = await import("@/server/services/classification/sanitize")
    const result = sanitizeResult({
      messageId: "m1", company: "Acme, Inc", roleTitle: "",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.company).toBe("Acme, Inc")
  })

  it("clears roleTitle containing '!' and rescues role", async () => {
    const { sanitizeResult } = await import("@/server/services/classification/sanitize")
    const result = sanitizeResult({
      messageId: "m1", company: "Intuit",
      roleTitle: "Application Received! Thanks for applying to the Software Developer 1 Role",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.roleTitle).toBe("Software Developer 1")  // rescued
    expect(result.company).toBe("Intuit")
  })

  it("clears 'Thank You for Your Interest in the Fullstack Engineer Opportunity'", async () => {
    const { sanitizeResult } = await import("@/server/services/classification/sanitize")
    const result = sanitizeResult({
      messageId: "m1", company: "MLSE",
      roleTitle: "Thank You for Your Interest in the Fullstack Engineer Opportunity",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.roleTitle).toBe("")
  })

  it("preserves confidence field through sanitization", async () => {
    const { sanitizeResult } = await import("@/server/services/classification/sanitize")
    const result = sanitizeResult({
      messageId: "m1", company: "Stripe", roleTitle: "Software Engineer",
      status: "APPLIED", location: null, date: new Date(), confidence: 0.9,
    })
    expect(result.confidence).toBe(0.9)
  })
})

describe("sanitizeResult — data quality guards", () => {
  it("clears numeric-only company names", async () => {
    const { sanitizeResult } = await import("@/server/services/classification/sanitize")
    const result = sanitizeResult({
      messageId: "m1", company: "4867314", roleTitle: "Software Engineer",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.company).toBe("")
  })

  it("clears numeric company with dashes", async () => {
    const { sanitizeResult } = await import("@/server/services/classification/sanitize")
    const result = sanitizeResult({
      messageId: "m1", company: "123-456", roleTitle: "Engineer",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.company).toBe("")
  })

  it("clears domain-like company names", async () => {
    const { sanitizeResult } = await import("@/server/services/classification/sanitize")
    const result = sanitizeResult({
      messageId: "m1", company: "stripe.io", roleTitle: "Software Engineer",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.company).toBe("")
  })

  it("clears .com domain company names", async () => {
    const { sanitizeResult } = await import("@/server/services/classification/sanitize")
    const result = sanitizeResult({
      messageId: "m1", company: "mycompany.com", roleTitle: "Engineer",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.company).toBe("")
  })

  it("clears noreply-prefixed company names", async () => {
    const { sanitizeResult } = await import("@/server/services/classification/sanitize")
    const result = sanitizeResult({
      messageId: "m1", company: "noreply WorkdayMyview", roleTitle: "Developer",
      status: "APPLIED", location: null, date: new Date(),
    })
    expect(result.company).toBe("")
  })

  it("does NOT clear a real company that starts with numbers but has letters", async () => {
    const { sanitizeResult } = await import("@/server/services/classification/sanitize")
    const result = sanitizeResult({
      messageId: "m1", company: "3M", roleTitle: "Engineer",
      status: "APPLIED", location: null, date: new Date(),
    })
    // "3M" contains letters so should NOT be cleared
    expect(result.company).toBe("3M")
  })
})

describe("postProcess", () => {
  it("uses companyHint when company is empty after sanitize", async () => {
    const { postProcess } = await import("@/server/services/classification/sanitize")
    const result = postProcess(
      { messageId: "m1", company: "", roleTitle: "Software Engineer",
        status: "APPLIED", location: null, date: new Date() },
      { messageId: "m1", subject: "s", text: "t", date: new Date(), companyHint: "Stripe" }
    )
    expect(result.company).toBe("Stripe")
  })

  it("routes to NEEDS_REVIEW when both company and roleTitle are empty", async () => {
    const { postProcess } = await import("@/server/services/classification/sanitize")
    const result = postProcess(
      { messageId: "m1", company: "", roleTitle: "",
        status: "APPLIED", location: null, date: new Date() },
      { messageId: "m1", subject: "s", text: "t", date: new Date(), companyHint: null }
    )
    expect(result.status).toBe("NEEDS_REVIEW")
    expect(result.confidence).toBeLessThanOrEqual(0.3)
  })

  it("does NOT use companyHint when company is already set", async () => {
    const { postProcess } = await import("@/server/services/classification/sanitize")
    const result = postProcess(
      { messageId: "m1", company: "Stripe", roleTitle: "SWE",
        status: "APPLIED", location: null, date: new Date() },
      { messageId: "m1", subject: "s", text: "t", date: new Date(), companyHint: "WrongCompany" }
    )
    expect(result.company).toBe("Stripe")
  })
})

describe("companySimilar", () => {
  it("matches when shorter name is a word-subset of longer name", async () => {
    const { companySimilar } = await import("@/server/services/classification/sanitize")
    expect(companySimilar("Autism Today", "Autism Today Foundation")).toBe(true)
  })

  it("is symmetric — longer vs shorter also matches", async () => {
    const { companySimilar } = await import("@/server/services/classification/sanitize")
    expect(companySimilar("Autism Today Foundation", "Autism Today")).toBe(true)
  })

  it("returns false for clearly different companies", async () => {
    const { companySimilar } = await import("@/server/services/classification/sanitize")
    expect(companySimilar("Google", "Microsoft")).toBe(false)
  })

  it("returns false for single-word shorter name (avoids false matches like Apple vs Apple Bank)", async () => {
    const { companySimilar } = await import("@/server/services/classification/sanitize")
    expect(companySimilar("Apple", "Apple Bank")).toBe(false)
  })

  it("returns false for empty strings", async () => {
    const { companySimilar } = await import("@/server/services/classification/sanitize")
    expect(companySimilar("", "Autism Today Foundation")).toBe(false)
    expect(companySimilar("Autism Today", "")).toBe(false)
  })

  it("is case-insensitive", async () => {
    const { companySimilar } = await import("@/server/services/classification/sanitize")
    expect(companySimilar("autism today", "AUTISM TODAY FOUNDATION")).toBe(true)
  })

  it("returns false when words don't overlap despite same length", async () => {
    const { companySimilar } = await import("@/server/services/classification/sanitize")
    expect(companySimilar("Open Door", "Closed Gate")).toBe(false)
  })
})

describe("normalizeRoleTitle — parenthetical expansion", () => {
  it("expands parenthetical content as words rather than stripping it", async () => {
    const { normalizeRoleTitle } = await import("@/server/services/classification/sanitize")
    const result = normalizeRoleTitle("Volunteer (Creative/Developer)")
    // Should contain words from inside the parens, not discard them
    expect(result).toContain("volunteer")
    expect(result).toContain("creative")
    expect(result).toContain("develop")
  })

  it("still normalizes seniority levels that appear inside parens", async () => {
    const { normalizeRoleTitle } = await import("@/server/services/classification/sanitize")
    const result = normalizeRoleTitle("Engineer (Senior)")
    expect(result).not.toContain("senior")
    expect(result).toContain("engineer")
  })
})

describe("roleTitlesSimilar — overlap coefficient", () => {
  it("merges 'Volunteer Developer' and 'Creative Developer' (shared: develop)", async () => {
    const { roleTitlesSimilar } = await import("@/server/services/classification/sanitize")
    expect(roleTitlesSimilar("Volunteer Developer", "Creative Developer")).toBe(true)
  })

  it("merges 'Volunteer (Creative/Developer)' and 'Volunteer Developer' after parens expansion", async () => {
    const { roleTitlesSimilar } = await import("@/server/services/classification/sanitize")
    expect(roleTitlesSimilar("Volunteer (Creative/Developer)", "Volunteer Developer")).toBe(true)
  })

  it("merges 'Volunteer Developer' and 'Full Stack Development Coordinator' (shared: develop)", async () => {
    const { roleTitlesSimilar } = await import("@/server/services/classification/sanitize")
    expect(roleTitlesSimilar("Volunteer Developer", "Full Stack Development Coordinator")).toBe(true)
  })

  it("does NOT merge roles with zero word overlap", async () => {
    const { roleTitlesSimilar } = await import("@/server/services/classification/sanitize")
    expect(roleTitlesSimilar("Marketing Manager", "Software Developer")).toBe(false)
  })

  it("returns false for empty strings", async () => {
    const { roleTitlesSimilar } = await import("@/server/services/classification/sanitize")
    expect(roleTitlesSimilar("", "Software Developer")).toBe(false)
    expect(roleTitlesSimilar("Software Developer", "")).toBe(false)
  })
})
