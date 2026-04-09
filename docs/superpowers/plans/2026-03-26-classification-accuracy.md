# Classification Accuracy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix duplicate application records, wrong statuses, and garbled extractions in the Gmail sync pipeline to achieve ~95%+ classification accuracy.

**Architecture:** Four targeted fixes across two service files — (1) artifact role title filtering and company↔role swap in `sanitizeResult`, (2) role title normalization + fuzzy similarity for deduplication, (3) stronger AI prompt, (4) multi-tier upsert matching with status priority protection. No schema changes required. After implementation, run `/api/sync/reset` to reprocess existing bad data.

**Tech Stack:** TypeScript, Vitest, Prisma 7, Claude Haiku (`claude-haiku-4-5-20251001`), Next.js App Router

---

## Known Limitations (accepted)

- **Float-style near-duplicates** handled by Tier 2.5 fuzzy similarity (≥60% Jaccard word overlap after normalization). Role pairs below the threshold (e.g. "Software Engineer" vs "Software Developer") remain separate rows — intentionally, as they may be different jobs.
- **Company name aliases** ("TD" vs "TD Bank") not normalized — out of scope.
- **No status history** — merging two rows silently overwrites the intermediate status.

---

## File Map

| File | What changes |
|------|-------------|
| `server/services/classification.service.ts` | Add `ARTIFACT_ROLE_PATTERNS`, `isArtifactRoleTitle()`, `normalizeRoleTitle()`, `roleTitlesSimilar()`; update `sanitizeResult()`; update AI prompt in `classifyWithAI()` |
| `server/services/sync.service.ts` | Add `STATUS_PRIORITY`, `TERMINAL_STATUSES`; add `findMany` to Prisma calls; rewrite `upsertResult()` |
| `__tests__/services/classification.test.ts` | Add three new `describe` blocks for artifact filtering, normalization, and similarity |
| `__tests__/services/sync.test.ts` | Add `findMany` to the `vi.mock` and `beforeEach`; add 9 new upsert tests |

---

## Task 1: Artifact Role Title Filtering + Company↔Role Swap

Fixes "Application Confirmation" stored as roleTitle, and "Junior Developer" stored as company name.

**Files:**
- Modify: `server/services/classification.service.ts` (after `sanitizeResult` definition, currently lines 299–312)
- Test: `__tests__/services/classification.test.ts`

- [ ] **Step 1: Write failing tests**

Add this new `describe` block at the end of `__tests__/services/classification.test.ts`:

```typescript
describe("sanitizeResult — artifact filtering", () => {
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

  it("does NOT clear 'Application Security Engineer' (partial match)", async () => {
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
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm run test:run -- __tests__/services/classification.test.ts
```

Expected: 8 new failures, all existing tests still pass.

- [ ] **Step 3: Add `ARTIFACT_ROLE_PATTERNS` and `isArtifactRoleTitle` to `classification.service.ts`**

Add these lines immediately before `sanitizeResult` (after line 296, the `// ─── Output sanitization` comment):

```typescript
const ARTIFACT_ROLE_PATTERNS: RegExp[] = [
  /^application\s+(confirmation|update|received|status|viewed|submitted|acknowledgement)$/i,
  /^your\s+application$/i,
  /^thank\s+you\s+for\s+(applying|your\s+application)$/i,
]

function isArtifactRoleTitle(roleTitle: string): boolean {
  return ARTIFACT_ROLE_PATTERNS.some((p) => p.test(roleTitle.trim()))
}
```

- [ ] **Step 4: Update `sanitizeResult` to add the two new steps**

Replace the existing `sanitizeResult` body (lines 299–312) with:

```typescript
export function sanitizeResult(result: ClassificationResult): ClassificationResult {
  let company = result.company.trim().replace(/\s{2,}/g, " ").replace(/[!,.]+$/, "")
  let roleTitle = result.roleTitle.trim().replace(/\s{2,}/g, " ").replace(/[!,.]+$/, "")

  // Strip "role of" / "the role of" / "position of" prefix
  roleTitle = roleTitle.replace(/^(?:the\s+)?(?:role|position)\s+of\s+/i, "")

  // Clear numeric-only requisition numbers (e.g. "70471", "2024-70471")
  if (/^\d[\d-]*\d$|^\d+$/.test(roleTitle.trim())) {
    roleTitle = ""
  }

  // Clear artifact role titles (status-description phrases, not job titles)
  if (isArtifactRoleTitle(roleTitle)) {
    roleTitle = ""
  }

  // Swap company→roleTitle when company looks like a job title and role is empty
  if (isLikelyRoleTitle(company) && roleTitle === "") {
    roleTitle = company
    company = ""
  }

  return { ...result, company, roleTitle }
}
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
npm run test:run -- __tests__/services/classification.test.ts
```

Expected: all tests pass including the 8 new ones.

- [ ] **Step 6: Commit**

```bash
git add server/services/classification.service.ts __tests__/services/classification.test.ts
git commit -m "feat(classification): filter artifact role titles and swap misplaced company/role"
```

---

## Task 2: Role Title Normalization + Similarity

Adds `normalizeRoleTitle()` and `roleTitlesSimilar()` — used by the upsert in Task 4 to detect Float-style duplicates ("Software Developer - Frontend / Mobile" ≈ "Frontend/Mobile Development (Senior)").

**Files:**
- Modify: `server/services/classification.service.ts` (add after `sanitizeResult`)
- Test: `__tests__/services/classification.test.ts`

- [ ] **Step 1: Write failing tests**

Add these two new `describe` blocks at the end of `__tests__/services/classification.test.ts`:

```typescript
describe("normalizeRoleTitle", () => {
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm run test:run -- __tests__/services/classification.test.ts
```

Expected: new tests fail, all existing pass.

- [ ] **Step 3: Add `normalizeRoleTitle` and `roleTitlesSimilar` to `classification.service.ts`**

Add these two exported functions at the end of `classification.service.ts` (after `sanitizeResult`):

```typescript
// ─── Role title normalization (for deduplication matching, not storage) ────────

export function normalizeRoleTitle(title: string): string {
  let s = title.toLowerCase()
  // Strip seniority / level qualifiers
  s = s.replace(/\b(senior|junior|lead|staff|principal|sr|jr|entry[\s-]level|mid[\s-]level|associate|intermediate)\b/g, "")
  // Strip employment type qualifiers
  s = s.replace(/\b(contract|permanent|full[\s-]time|part[\s-]time|intern|internship|co[\s-]op|new\s+grad(?:uate)?)\b/g, "")
  // Strip content in parentheses/brackets (tech stack, location qualifiers)
  s = s.replace(/[\(\[][^\)\]]*[\)\]]/g, "")
  // Normalize word-form variations for common job title roots
  s = s.replace(/\bdevelop(?:er|ment|ing|ed)?\b/g, "develop")
  s = s.replace(/\bengineer(?:ing)?\b/g, "engineer")
  // Normalize punctuation to spaces
  s = s.replace(/[-\/|,\.&+]/g, " ")
  return s.replace(/\s+/g, " ").trim()
}

/** Returns true if two role titles at the same company are likely the same job.
 *  Uses Jaccard similarity on normalized word sets (threshold ≥ 0.6).
 *  Only meaningful when both titles are non-empty. */
export function roleTitlesSimilar(a: string, b: string): boolean {
  if (!a || !b) return false
  const wordsA = new Set(normalizeRoleTitle(a).split(" ").filter((w) => w.length > 2))
  const wordsB = new Set(normalizeRoleTitle(b).split(" ").filter((w) => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return false
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return intersection / union >= 0.6
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm run test:run -- __tests__/services/classification.test.ts
```

Expected: all tests pass including the new normalization and similarity tests.

- [ ] **Step 5: Commit**

```bash
git add server/services/classification.service.ts __tests__/services/classification.test.ts
git commit -m "feat(classification): add role title normalization and similarity matching"
```

---

## Task 3: AI Prompt Improvements

Teaches the AI to prioritize status accuracy, avoid artifact role titles, and correctly handle company↔role confusion.

**Files:**
- Modify: `server/services/classification.service.ts` (the `prompt` string in `classifyWithAI`, currently lines 235–250)

No new tests for this task — the AI is fully mocked in tests. The improvement is validated during the full resync in Task 5.

- [ ] **Step 1: Replace the prompt string in `classifyWithAI`**

Find the `const prompt = \`` string starting at line 235 and replace the entire template literal with:

```typescript
    const prompt = `You are extracting job application data from emails. For each email return:
- company: the company name only (e.g. "Google", "Stripe"). Return null if unknown.
- roleTitle: the specific job title only (e.g. "Software Engineer", "Frontend Developer"). Extract just the title — never copy the subject line or write a sentence. Strip any prefix like "role of", "position of", "the role". Return null if the title cannot be determined.
- status: one of APPLIED | INTERVIEW | OFFER | REJECTED | GHOSTED | NEEDS_REVIEW
- location: city/country, "Remote", "Hybrid", or null

Status definitions:
- APPLIED: application confirmation, "thank you for applying", "application received/submitted/under review"
- INTERVIEW: interview invitation, phone screen, technical assessment, "next steps", "we'd like to chat", "moving forward"
- OFFER: offer letter, "pleased to offer", "we would like to offer you the position"
- REJECTED: "not moving forward", "decided to pursue other candidates", "unfortunately", "no longer considering", "position has been filled", "decided not to move forward"
- NEEDS_REVIEW: job-related email but status cannot be clearly determined

Rules:
- Return null for company or roleTitle if you cannot determine them — do not guess or use placeholder values.
- IMPORTANT: roleTitle must be a real job title. Never return a status-description phrase as roleTitle. These are NOT job titles: "Application Confirmation", "Application Update", "Application Received", "Application Status", "Application Viewed". If the job title cannot be determined, return null.
- If the email clearly signals a status (rejection, interview, offer) but company or roleTitle cannot be determined, still return the correct status with null for the unknown fields. Do NOT default to NEEDS_REVIEW when the status signal is unambiguous.
- If the company field appears to be a job title (e.g. "Junior Developer", "Software Engineer") and no company name is present in the email, return company: null and put the title in roleTitle.
- Discard entirely (omit from response) if the email is: a calendar invite, meeting invitation, "application viewed" notification, out-of-office reply, referral email where no application was submitted, or newsletter.
- Return a JSON array only, no other text.

BAD examples (never do this):
  {"messageId":"id1","company":"Stripe","roleTitle":"Application Confirmation","status":"APPLIED"} — WRONG: "Application Confirmation" is not a job title
  {"messageId":"id2","company":"Junior Developer","roleTitle":null,"status":"APPLIED"} — WRONG: "Junior Developer" is a job title, not a company

GOOD examples:
  {"messageId":"id1","company":"Stripe","roleTitle":null,"status":"APPLIED"}
  {"messageId":"id2","company":null,"roleTitle":"Junior Developer","status":"APPLIED"}

Emails:
${JSON.stringify(batch.map((e) => ({ messageId: e.messageId, subject: e.subject, text: e.text })))}
`
```

- [ ] **Step 2: Run the full test suite — confirm nothing broke**

```bash
npm run test:run
```

Expected: all tests pass (AI is mocked, prompt string is not tested directly).

- [ ] **Step 3: Commit**

```bash
git add server/services/classification.service.ts
git commit -m "feat(classification): strengthen AI prompt for status accuracy and artifact role titles"
```

---

## Task 4: Status Priority + Multi-Tier Upsert

Rewrites `upsertResult` in `sync.service.ts` to use 4-tier matching and status priority protection. This is the core deduplication fix.

**Files:**
- Modify: `server/services/sync.service.ts` (constants above `upsertResult`, lines 24–63)
- Test: `__tests__/services/sync.test.ts`

- [ ] **Step 1: Update the `vi.mock` in `sync.test.ts` to include `findMany`**

Find the `vi.mock("@/server/lib/prisma", ...)` block at the top of `__tests__/services/sync.test.ts` and update the `application` object to add `findMany`:

```typescript
vi.mock("@/server/lib/prisma", () => ({
  prisma: {
    syncState: { findUnique: vi.fn(), upsert: vi.fn() },
    application: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))
```

- [ ] **Step 2: Add `findMany` default mock to `beforeEach` in `sync.test.ts`**

Find the `beforeEach` block and add one line:

```typescript
vi.mocked(prisma.application.findMany).mockResolvedValue([])
```

(Place it alongside the other `prisma.application` mock lines.)

- [ ] **Step 3: Write failing tests**

Add these 9 tests to the existing `describe("syncApplications — application upsert")` block in `__tests__/services/sync.test.ts`:

```typescript
  it("tier 2: merges incoming with role into existing empty-role record, fills roleTitle", async () => {
    const existing = {
      id: "app-1", company: "Shake Shack", roleTitle: "", status: "INTERVIEW",
      appliedAt: new Date(NOW.getTime() - 4 * 24 * 60 * 60 * 1000), location: null,
    }
    vi.mocked(prisma.application.findFirst)
      .mockResolvedValueOnce(null)      // tier 1: no exact match
      .mockResolvedValueOnce(existing as any) // tier 2: company + empty role
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{ messageId: "m1", company: "Shake Shack", roleTitle: "Crew Member Training", status: "REJECTED", date: NOW, location: null }],
      unclassified: [],
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-1" },
        data: expect.objectContaining({ status: "REJECTED", roleTitle: "Crew Member Training" }),
      })
    )
    expect(result.updated).toBe(1)
  })

  it("tier 2.5: merges Float-style role title variations via similarity", async () => {
    const existing = {
      id: "app-2", company: "Float", roleTitle: "Software Developer - Frontend / Mobile",
      status: "APPLIED", appliedAt: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000), location: null,
    }
    vi.mocked(prisma.application.findFirst)
      .mockResolvedValueOnce(null)  // tier 1
      .mockResolvedValueOnce(null)  // tier 2 (no empty-role record)
    vi.mocked(prisma.application.findMany).mockResolvedValueOnce([existing as any])
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{ messageId: "m2", company: "Float", roleTitle: "Frontend/Mobile Development (Senior)", status: "REJECTED", date: NOW, location: null }],
      unclassified: [],
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-2" },
        data: expect.objectContaining({ status: "REJECTED" }),
      })
    )
    expect(result.updated).toBe(1)
  })

  it("tier 3: company-only match when incoming has no role", async () => {
    const existing = {
      id: "app-3", company: "HelloFresh", roleTitle: "Software Developer",
      status: "APPLIED", appliedAt: new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000), location: null,
    }
    vi.mocked(prisma.application.findFirst)
      .mockResolvedValueOnce(null)  // tier 1
      .mockResolvedValueOnce(existing as any) // tier 3
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{ messageId: "m3", company: "HelloFresh", roleTitle: "", status: "REJECTED", date: NOW, location: null }],
      unclassified: [],
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-3" },
        data: expect.objectContaining({ status: "REJECTED" }),
      })
    )
    // roleTitle should be preserved from existing (not cleared)
    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleTitle: "Software Developer" }),
      })
    )
    expect(result.updated).toBe(1)
  })

  it("no merge for two different non-empty roles at same company — creates new record", async () => {
    vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.application.findMany).mockResolvedValue([])
    vi.mocked(prisma.application.create).mockResolvedValue({} as any)
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{ messageId: "m4", company: "Scotiabank", roleTitle: "Full Stack Developer", status: "REJECTED", date: NOW, location: null }],
      unclassified: [],
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.create).toHaveBeenCalledOnce()
    expect(result.synced).toBe(1)
    expect(result.updated).toBe(0)
  })

  it("terminal OFFER: not overwritten by APPLIED", async () => {
    const existing = {
      id: "app-5", company: "Acme", roleTitle: "Engineer", status: "OFFER",
      appliedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000), location: null,
    }
    vi.mocked(prisma.application.findFirst).mockResolvedValue(existing as any)
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{ messageId: "m5", company: "Acme", roleTitle: "Engineer", status: "APPLIED", date: NOW, location: null }],
      unclassified: [],
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).not.toHaveBeenCalled()
    expect(result.updated).toBe(0)
  })

  it("terminal REJECTED: not overwritten by APPLIED", async () => {
    const existing = {
      id: "app-6", company: "Acme", roleTitle: "Engineer", status: "REJECTED",
      appliedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000), location: null,
    }
    vi.mocked(prisma.application.findFirst).mockResolvedValue(existing as any)
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{ messageId: "m6", company: "Acme", roleTitle: "Engineer", status: "APPLIED", date: NOW, location: null }],
      unclassified: [],
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).not.toHaveBeenCalled()
    expect(result.updated).toBe(0)
  })

  it("REJECTED can be overwritten by OFFER", async () => {
    const existing = {
      id: "app-7", company: "Acme", roleTitle: "Engineer", status: "REJECTED",
      appliedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000), location: null,
    }
    vi.mocked(prisma.application.findFirst).mockResolvedValue(existing as any)
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{ messageId: "m7", company: "Acme", roleTitle: "Engineer", status: "OFFER", date: NOW, location: null }],
      unclassified: [],
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "OFFER" }) })
    )
    expect(result.updated).toBe(1)
  })

  it("INTERVIEW not downgraded to APPLIED even when APPLIED email is newer", async () => {
    const existing = {
      id: "app-8", company: "Acme", roleTitle: "Engineer", status: "INTERVIEW",
      appliedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000), location: null,
    }
    vi.mocked(prisma.application.findFirst).mockResolvedValue(existing as any)
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{ messageId: "m8", company: "Acme", roleTitle: "Engineer", status: "APPLIED", date: NOW, location: null }],
      unclassified: [],
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    expect(prisma.application.update).not.toHaveBeenCalled()
    expect(result.updated).toBe(0)
  })

  it("field enrichment: fills empty roleTitle on terminal REJECTED record", async () => {
    const existing = {
      id: "app-9", company: "Scotiabank", roleTitle: "", status: "REJECTED",
      appliedAt: NOW, location: null,
    }
    vi.mocked(prisma.application.findFirst)
      .mockResolvedValueOnce(null)           // tier 1
      .mockResolvedValueOnce(existing as any) // tier 2
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)
    vi.mocked(classifyStage1).mockReturnValue({
      classified: [{ messageId: "m9", company: "Scotiabank", roleTitle: "Full Stack Developer", status: "APPLIED", date: new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000), location: null }],
      unclassified: [],
    })

    const { syncApplications } = await import("@/server/services/sync.service")
    const result = await syncApplications("user-1")

    // Status stays REJECTED (terminal), but roleTitle gets filled
    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-9" },
        data: expect.objectContaining({ roleTitle: "Full Stack Developer" }),
      })
    )
    // Status must not have changed
    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ status: "APPLIED" }),
      })
    )
    expect(result.updated).toBe(1)
  })
```

- [ ] **Step 4: Run tests — confirm new tests fail**

```bash
npm run test:run -- __tests__/services/sync.test.ts
```

Expected: 9 new failures, all existing tests still pass.

- [ ] **Step 5: Add `STATUS_PRIORITY` and `TERMINAL_STATUSES` constants to `sync.service.ts`**

Add these two constants immediately before the `upsertResult` function (after the `GHOSTED_AFTER_MS` constant):

```typescript
const STATUS_PRIORITY: Record<string, number> = {
  OFFER: 5,
  INTERVIEW: 4,
  REJECTED: 4, // equal to INTERVIEW so a newer rejection can replace an older interview
  GHOSTED: 3,
  APPLIED: 2,
  NEEDS_REVIEW: 1,
}

const TERMINAL_STATUSES = new Set(["OFFER", "REJECTED"])
```

- [ ] **Step 6: Add import of `roleTitlesSimilar` at the top of `sync.service.ts`**

Find the existing import line:
```typescript
import { classifyStage1, classifyStage2Plus, type ClassificationResult } from "@/server/services/classification.service"
```

Replace with:
```typescript
import { classifyStage1, classifyStage2Plus, roleTitlesSimilar, type ClassificationResult } from "@/server/services/classification.service"
```

- [ ] **Step 7: Replace the body of `upsertResult` in `sync.service.ts`**

Replace the entire `upsertResult` function (lines 24–63) with:

```typescript
async function upsertResult(
  userId: string,
  result: ClassificationResult,
): Promise<"created" | "updated" | "skipped"> {
  // ── Tier 1: exact match (company + roleTitle, case insensitive) ──────────────
  let existing = await prisma.application.findFirst({
    where: {
      userId,
      company: { equals: result.company, mode: "insensitive" },
      roleTitle: { equals: result.roleTitle, mode: "insensitive" },
    },
  })

  // ── Tier 2: incoming has role, find existing with same company + empty role ──
  if (!existing && result.roleTitle !== "") {
    existing = await prisma.application.findFirst({
      where: {
        userId,
        company: { equals: result.company, mode: "insensitive" },
        roleTitle: { equals: "", mode: "insensitive" },
      },
      orderBy: { appliedAt: "desc" },
    })
  }

  // ── Tier 2.5: same company, non-empty roles, normalized similarity ≥ 60% ────
  if (!existing && result.roleTitle !== "") {
    const candidates = await prisma.application.findMany({
      where: {
        userId,
        company: { equals: result.company, mode: "insensitive" },
        NOT: { roleTitle: "" },
      },
      orderBy: { appliedAt: "desc" },
    })
    existing = candidates.find((c) => roleTitlesSimilar(c.roleTitle, result.roleTitle)) ?? null
  }

  // ── Tier 3: incoming has no role — match most recent record for this company ─
  if (!existing && result.roleTitle === "") {
    existing = await prisma.application.findFirst({
      where: {
        userId,
        company: { equals: result.company, mode: "insensitive" },
      },
      orderBy: { appliedAt: "desc" },
    })
  }

  if (existing) {
    const existingPriority = STATUS_PRIORITY[existing.status] ?? 0
    const newPriority = STATUS_PRIORITY[result.status] ?? 0

    // Field enrichment: fill empty roleTitle and null location from incoming
    const enrichedRole =
      existing.roleTitle === "" && result.roleTitle !== "" ? result.roleTitle : existing.roleTitle
    const enrichedLocation =
      existing.location === null && result.location !== null ? result.location : existing.location

    // ── Terminal protection ────────────────────────────────────────────────────
    // OFFER is never overwritten. REJECTED yields only to OFFER.
    if (TERMINAL_STATUSES.has(existing.status)) {
      if (existing.status === "OFFER" || result.status !== "OFFER") {
        const hasEnrichment =
          enrichedRole !== existing.roleTitle || enrichedLocation !== existing.location
        if (hasEnrichment) {
          await prisma.application.update({
            where: { id: existing.id },
            data: { roleTitle: enrichedRole, location: enrichedLocation },
          })
          return "updated"
        }
        return "skipped"
      }
      // REJECTED → OFFER: fall through to normal update logic
    }

    // ── Status update condition ───────────────────────────────────────────────
    const shouldUpdateStatus =
      newPriority > existingPriority ||
      (newPriority === existingPriority && result.date > existing.appliedAt)

    // Only advance appliedAt when the status is also advancing — prevents a late
    // APPLIED auto-reply from updating the date on an INTERVIEW/REJECTED record
    const shouldUpdateDate = shouldUpdateStatus && result.date > existing.appliedAt

    const hasChanges =
      shouldUpdateStatus ||
      shouldUpdateDate ||
      enrichedRole !== existing.roleTitle ||
      enrichedLocation !== existing.location

    if (!hasChanges) return "skipped"

    await prisma.application.update({
      where: { id: existing.id },
      data: {
        status: shouldUpdateStatus ? (result.status as any) : existing.status,
        appliedAt: shouldUpdateDate ? result.date : existing.appliedAt,
        roleTitle: enrichedRole,
        location: enrichedLocation,
      },
    })
    return "updated"
  }

  // ── No match: create new record ───────────────────────────────────────────────
  await prisma.application.create({
    data: {
      userId,
      company: result.company,
      roleTitle: result.roleTitle,
      status: result.status as any,
      source: "GMAIL" as any,
      appliedAt: result.date,
      location: result.location ?? null,
    },
  })
  return "created"
}
```

- [ ] **Step 8: Run sync tests — confirm all pass**

```bash
npm run test:run -- __tests__/services/sync.test.ts
```

Expected: all tests pass including the 9 new ones.

- [ ] **Step 9: Run full test suite**

```bash
npm run test:run
```

Expected: all tests pass across all files.

- [ ] **Step 10: Commit**

```bash
git add server/services/sync.service.ts server/services/classification.service.ts __tests__/services/sync.test.ts
git commit -m "feat(sync): multi-tier deduplication matching and status priority protection"
```

---

## Task 5: Verification via Full Resync

Applies all fixes to the existing bad data by reprocessing 6 months of Gmail from scratch.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Trigger a full resync**

In the browser, navigate to the app and click "Full Resync" (or call the endpoint directly):

```bash
curl -X POST http://localhost:3000/api/sync/reset \
  -H "Cookie: <your session cookie>"
```

- [ ] **Step 3: Verify the data**

Check the dashboard for these specific outcomes:

| Before | Expected after |
|--------|----------------|
| `Shake Shack` × 2 rows (Interview + Rejected) | 1 row: `Shake Shack / Crew Member Training / REJECTED` |
| `HelloFresh` × 2 rows (Applied + Rejected) | 1 row: `HelloFresh / Software Developer / REJECTED` |
| `Scotiabank` × 2 rows (Applied + Rejected) | 1 row: `Scotiabank / Full Stack Developer / REJECTED` |
| `Float` × 2 rows (different role wordings) | 1 row: `Float / [role] / REJECTED` |
| Company = `Junior Developer` | Role = `Junior Developer`, company empty |
| Company = `Software Engineer (entry)` | Role = `Software Engineer (entry)`, company empty |
| roleTitle = `Application Confirmation` | roleTitle = `""` |
| roleTitle = `Application Update` | roleTitle = `""` |

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verify classification accuracy fixes via full resync"
```
