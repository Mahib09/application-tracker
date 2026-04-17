import { describe, it, expect, vi, beforeEach } from "vitest"

beforeEach(() => vi.resetModules())

function makeEmail(overrides: Partial<{
  from: string
  listUnsubscribe: string | null
  isATS: boolean
  labelIds: string[]
}>): import("@/server/services/gmail.service").EmailRaw {
  return {
    messageId: "msg-1",
    subject: "Software Engineer at Acme",
    snippet: "We received your application",
    date: new Date(),
    from: "hr@acme.com",
    companyHint: "Acme",
    isATS: false,
    listUnsubscribe: null,
    labelIds: [],
    ...overrides,
  }
}

describe("isDeterministicallyFiltered", () => {
  it("passes non-ATS email with List-Unsubscribe header through to Haiku", async () => {
    const { isDeterministicallyFiltered } = await import("@/server/services/classification/filter")
    expect(isDeterministicallyFiltered(makeEmail({ listUnsubscribe: "<https://example.com/unsub>", isATS: false }))).toBe(false)
  })

  it("passes ATS email through even with List-Unsubscribe header", async () => {
    const { isDeterministicallyFiltered } = await import("@/server/services/classification/filter")
    expect(isDeterministicallyFiltered(makeEmail({ listUnsubscribe: "<https://greenhouse.io/unsub>", isATS: true }))).toBe(false)
  })

  it("passes noreply@fortive.com with List-Unsubscribe (regression: Fortive rejection)", async () => {
    const { isDeterministicallyFiltered } = await import("@/server/services/classification/filter")
    expect(isDeterministicallyFiltered(makeEmail({
      from: "Fortive Talent Team <noreply@fortive.com>",
      listUnsubscribe: "<https://fortive.com/unsub>",
      isATS: false,
    }))).toBe(false)
  })

  it("drops email from blocklisted domain (linkedin.com)", async () => {
    const { isDeterministicallyFiltered } = await import("@/server/services/classification/filter")
    expect(isDeterministicallyFiltered(makeEmail({ from: "jobs@linkedin.com" }))).toBe(true)
  })

  it("drops email from blocklisted domain (sendgrid.net)", async () => {
    const { isDeterministicallyFiltered } = await import("@/server/services/classification/filter")
    expect(isDeterministicallyFiltered(makeEmail({ from: "Marketing Team <news@sendgrid.net>" }))).toBe(true)
  })

  it("drops email with CATEGORY_PROMOTIONS label", async () => {
    const { isDeterministicallyFiltered } = await import("@/server/services/classification/filter")
    expect(isDeterministicallyFiltered(makeEmail({ labelIds: ["CATEGORY_PROMOTIONS", "INBOX"] }))).toBe(true)
  })

  it("drops email with CATEGORY_SOCIAL label", async () => {
    const { isDeterministicallyFiltered } = await import("@/server/services/classification/filter")
    expect(isDeterministicallyFiltered(makeEmail({ labelIds: ["CATEGORY_SOCIAL"] }))).toBe(true)
  })

  it("passes normal job email with no filter triggers", async () => {
    const { isDeterministicallyFiltered } = await import("@/server/services/classification/filter")
    expect(isDeterministicallyFiltered(makeEmail({ labelIds: ["INBOX"] }))).toBe(false)
  })

  it("passes email with null listUnsubscribe, INBOX label, non-blocklisted domain", async () => {
    const { isDeterministicallyFiltered } = await import("@/server/services/classification/filter")
    expect(isDeterministicallyFiltered(makeEmail({ from: "hr@stripe.com", listUnsubscribe: null, labelIds: ["INBOX"] }))).toBe(false)
  })
})
