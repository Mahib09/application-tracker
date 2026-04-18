import { describe, it, expect } from "vitest"

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW = new Date("2026-04-17T12:00:00Z")

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeApp(overrides: Record<string, unknown> = {}): any {
  return {
    id: Math.random().toString(36).slice(2),
    company: "Acme",
    roleTitle: "SWE",
    status: "APPLIED",
    source: "GMAIL",
    appliedAt: new Date("2026-04-01"),
    confidence: null,
    jobUrl: null,
    location: null,
    notes: null,
    manuallyEdited: false,
    sourceEmailId: null,
    sourceEmailSubject: null,
    sourceEmailSnippet: null,
    sourceEmailReceivedAt: null,
    interviewDate: null,
    interviewUrl: null,
    interviewer: null,
    interviewProvider: null,
    recruiterName: null,
    recruiterEmail: null,
    lastFollowUpAt: null,
    jobDescriptionSnapshot: null,
    jobDescriptionFetchedAt: null,
    ...overrides,
  }
}

function makeChange(overrides: Record<string, unknown> = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    applicationId: "app-1",
    fromStatus: "APPLIED",
    toStatus: "INTERVIEW",
    trigger: "SYNC",
    eventDate: new Date("2026-04-10"),
    createdAt: new Date("2026-04-10"),
    ...overrides,
  }
}

// ─── computeResponseRate ─────────────────────────────────────────────────────

describe("computeResponseRate", () => {
  it("returns 0 when no applications", async () => {
    const { computeResponseRate } = await import("@/server/services/analytics.service")
    const result = computeResponseRate([], 30, NOW)
    expect(result.rate).toBe(0)
    expect(result.total).toBe(0)
  })

  it("counts interview+offer+rejected as responded", async () => {
    const apps = [
      makeApp({ status: "INTERVIEW", appliedAt: new Date("2026-04-01") }),
      makeApp({ status: "OFFER", appliedAt: new Date("2026-04-01") }),
      makeApp({ status: "REJECTED", appliedAt: new Date("2026-04-01") }),
      makeApp({ status: "APPLIED", appliedAt: new Date("2026-04-01") }),
    ]
    const { computeResponseRate } = await import("@/server/services/analytics.service")
    const result = computeResponseRate(apps, 30, NOW)
    expect(result.responded).toBe(3)
    expect(result.total).toBe(4)
    expect(result.rate).toBeCloseTo(0.75)
  })

  it("only includes apps within the window", async () => {
    const apps = [
      makeApp({ status: "REJECTED", appliedAt: new Date("2026-04-01") }), // within 30 days
      makeApp({ status: "REJECTED", appliedAt: new Date("2026-01-01") }), // outside 30 days
    ]
    const { computeResponseRate } = await import("@/server/services/analytics.service")
    const result = computeResponseRate(apps, 30, NOW)
    expect(result.total).toBe(1)
    expect(result.responded).toBe(1)
  })
})

// ─── computeGhostRate ────────────────────────────────────────────────────────

describe("computeGhostRate", () => {
  it("returns 0 when no apps older than 30 days", async () => {
    const apps = [makeApp({ status: "GHOSTED", appliedAt: new Date("2026-04-16") })]
    const { computeGhostRate } = await import("@/server/services/analytics.service")
    const result = computeGhostRate(apps, NOW)
    expect(result.rate).toBe(0)
  })

  it("calculates ghost rate from apps older than 30 days", async () => {
    const apps = [
      makeApp({ status: "GHOSTED", appliedAt: new Date("2026-03-01") }),
      makeApp({ status: "GHOSTED", appliedAt: new Date("2026-03-01") }),
      makeApp({ status: "APPLIED", appliedAt: new Date("2026-03-01") }),
      makeApp({ status: "REJECTED", appliedAt: new Date("2026-03-01") }),
    ]
    const { computeGhostRate } = await import("@/server/services/analytics.service")
    const result = computeGhostRate(apps, NOW)
    expect(result.eligible).toBe(4)
    expect(result.ghosted).toBe(2)
    expect(result.rate).toBeCloseTo(0.5)
  })
})

// ─── computeMedianResponseDays ───────────────────────────────────────────────

describe("computeMedianResponseDays", () => {
  it("returns null when no status changes", async () => {
    const { computeMedianResponseDays } = await import("@/server/services/analytics.service")
    expect(computeMedianResponseDays([], [])).toBeNull()
  })

  it("computes median days from appliedAt to first status change away from APPLIED", async () => {
    const app1 = makeApp({ id: "a1", appliedAt: new Date("2026-04-01") })
    const app2 = makeApp({ id: "a2", appliedAt: new Date("2026-04-01") })
    const changes = [
      makeChange({ applicationId: "a1", fromStatus: "APPLIED", toStatus: "INTERVIEW", eventDate: new Date("2026-04-08") }), // 7 days
      makeChange({ applicationId: "a2", fromStatus: "APPLIED", toStatus: "REJECTED", eventDate: new Date("2026-04-11") }), // 10 days
    ]
    const { computeMedianResponseDays } = await import("@/server/services/analytics.service")
    // median of [7, 10] = 8.5
    expect(computeMedianResponseDays([app1, app2] as any, changes as any)).toBeCloseTo(8.5)
  })

  it("ignores changes with null eventDate", async () => {
    const app = makeApp({ id: "a1", appliedAt: new Date("2026-04-01") })
    const changes = [makeChange({ applicationId: "a1", fromStatus: "APPLIED", toStatus: "INTERVIEW", eventDate: null })]
    const { computeMedianResponseDays } = await import("@/server/services/analytics.service")
    expect(computeMedianResponseDays([app] as any, changes as any)).toBeNull()
  })
})

// ─── computeWeeklyBuckets ────────────────────────────────────────────────────

describe("computeWeeklyBuckets", () => {
  it("returns 12 buckets", async () => {
    const { computeWeeklyBuckets } = await import("@/server/services/analytics.service")
    const result = computeWeeklyBuckets([], NOW)
    expect(result).toHaveLength(12)
  })

  it("places application in correct week bucket", async () => {
    // 3 days before NOW = still within most-recent week bucket
    const app = makeApp({ appliedAt: new Date("2026-04-14"), status: "APPLIED" })
    const { computeWeeklyBuckets } = await import("@/server/services/analytics.service")
    const buckets = computeWeeklyBuckets([app] as any, NOW)
    const lastBucket = buckets[buckets.length - 1]
    expect(lastBucket.count).toBe(1)
  })

  it("excludes NEEDS_REVIEW applications", async () => {
    const app = makeApp({ appliedAt: new Date("2026-04-14"), status: "NEEDS_REVIEW" })
    const { computeWeeklyBuckets } = await import("@/server/services/analytics.service")
    const buckets = computeWeeklyBuckets([app] as any, NOW)
    expect(buckets.every((b) => b.count === 0)).toBe(true)
  })
})

// ─── computeStatusFunnel ─────────────────────────────────────────────────────

describe("computeStatusFunnel", () => {
  it("returns zero rates for empty input", async () => {
    const { computeStatusFunnel } = await import("@/server/services/analytics.service")
    const result = computeStatusFunnel([])
    expect(result.interviewRate).toBe(0)
    expect(result.offerRate).toBe(0)
  })

  it("computes conversion rates correctly", async () => {
    const apps = [
      makeApp({ status: "APPLIED" }),
      makeApp({ status: "APPLIED" }),
      makeApp({ status: "INTERVIEW" }),
      makeApp({ status: "INTERVIEW" }),
      makeApp({ status: "OFFER" }),
    ]
    const { computeStatusFunnel } = await import("@/server/services/analytics.service")
    const result = computeStatusFunnel(apps as any)
    expect(result.total).toBe(5)
    expect(result.interviews).toBe(2)
    expect(result.offers).toBe(1)
    expect(result.interviewRate).toBeCloseTo(0.4) // 2/5
    expect(result.offerRate).toBeCloseTo(0.2)    // 1/5
  })
})

// ─── computeSourceBreakdown ──────────────────────────────────────────────────

describe("computeSourceBreakdown", () => {
  it("counts gmail vs manual", async () => {
    const apps = [
      makeApp({ source: "GMAIL" }),
      makeApp({ source: "GMAIL" }),
      makeApp({ source: "MANUAL" }),
    ]
    const { computeSourceBreakdown } = await import("@/server/services/analytics.service")
    const result = computeSourceBreakdown(apps as any)
    expect(result.gmail).toBe(2)
    expect(result.manual).toBe(1)
  })
})
