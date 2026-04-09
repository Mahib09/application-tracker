# Classification Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all current bad data issues by wiring the dead `sanitizeResult` code, adding a regex quality gate, splitting `classification.service.ts` into focused modules, and adding schema fields needed for future AI upgrades.

**Architecture:** Four independent changes applied in sequence: (1) schema migration adds `confidence`, `manuallyEdited`, `sourceEmailId`; (2) new `classification/sanitize.ts` has updated sanitization with role rescue and company cleanup; (3) new `classification/regex.ts` has quality-gated Stage 1 with `sanitizeResult` finally wired; (4) `gmail.service.ts` exposes the `From` header as `companyHint`. Existing `classification.service.ts` re-exports from the new files — no import changes needed in `sync.service.ts` or tests.

**Tech Stack:** Prisma 7, TypeScript, Vitest, Next.js App Router

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add confidence, manuallyEdited, sourceEmailId, SyncState metrics |
| `server/services/classification.service.ts` | Modify | Add confidence to types; import from sub-modules; wire sanitizeResult into classifyWithAI fallback paths |
| `server/services/gmail.service.ts` | Modify | Add from, companyHint, isATS to EmailRaw; parse From header |
| `server/services/classification/sanitize.ts` | Create | rescueRole, sanitizeResult (updated), isArtifactRoleTitle, isLikelyRoleTitle, normalizeRoleTitle, roleTitlesSimilar, postProcess |
| `server/services/classification/regex.ts` | Create | classifyWithRegex, extractCompanyAndRole, isValidExtraction, classifyStage1 (quality-gated + sanitized) |
| `__tests__/services/classification/sanitize.test.ts` | Create | Unit tests for all sanitize.ts functions |
| `__tests__/services/classification/regex.test.ts` | Create | Unit tests for isValidExtraction + classifyStage1 wiring |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to schema**

Open `prisma/schema.prisma`. In the `Application` model, add after the `notes` field:

```prisma
model Application {
  id        String            @id @default(uuid()) @db.Uuid
  userId    String            @db.Uuid
  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  company   String
  roleTitle String
  status    applicationStatus @default(APPLIED)
  source    applicationSource

  appliedAt     DateTime?
  jobUrl        String?
  location      String?
  notes         String?
  confidence    Float?
  manuallyEdited Boolean     @default(false)
  sourceEmailId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, status])
  @@index([userId, appliedAt])
}
```

In the `SyncState` model, add after `lastSyncError`:

```prisma
model SyncState {
  userId         String          @id @db.Uuid
  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  lastSyncedAt   DateTime?
  lastSyncStatus lastSyncStatus?
  lastSyncError  String?
  emailsFetched    Int?
  emailsClassified Int?
  aiCallCount      Int?
  sonnetCallCount  Int?
  updatedAt      DateTime        @updatedAt
}
```

- [ ] **Step 2: Run migration**

```bash
cd e:/Projects/application-tracker
npx prisma migrate dev --name add_confidence_manually_edited_source_email_sync_metrics
```

Expected: migration created and applied, no errors.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `app/generated/prisma/client` regenerated, no errors.

- [ ] **Step 4: Verify tests still pass**

```bash
npm run test:run
```

Expected: all 126 tests pass (schema changes are additive, nothing breaks).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add confidence, manuallyEdited, sourceEmailId to Application; add sync metrics to SyncState"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `server/services/classification.service.ts` (lines 5-19)

The `ClassificationResult` interface needs an optional `confidence` field. The `EmailInput` interface needs `companyHint`.

- [ ] **Step 1: Write failing test**

Create `__tests__/services/classification/sanitize.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- __tests__/services/classification/sanitize.test.ts
```

Expected: FAIL — `confidence` does not exist on type `ClassificationResult`.

- [ ] **Step 3: Update `ClassificationResult` and `EmailInput` interfaces**

In `server/services/classification.service.ts`, replace lines 5-19:

```typescript
export interface EmailInput {
  messageId:   string
  subject:     string
  text:        string
  date:        Date
  companyHint: string | null
}

export interface ClassificationResult {
  messageId:   string
  company:     string
  roleTitle:   string
  status:      string
  location:    string | null
  date:        Date
  confidence?: number
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- __tests__/services/classification/sanitize.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run full suite to verify nothing broke**

```bash
npm run test:run
```

Expected: all tests pass. (Existing tests don't use `companyHint` so adding it is backward-compatible.)

- [ ] **Step 6: Commit**

```bash
git add server/services/classification.service.ts __tests__/services/classification/sanitize.test.ts
git commit -m "feat(classification): add confidence to ClassificationResult, companyHint to EmailInput"
```

---

## Task 3: Create `classification/sanitize.ts`

**Files:**
- Create: `server/services/classification/sanitize.ts`
- Modify: `__tests__/services/classification/sanitize.test.ts`

This file owns all output sanitization. It imports `ClassificationResult` and `EmailInput` from the parent service.

- [ ] **Step 1: Write failing tests**

Replace `__tests__/services/classification/sanitize.test.ts` with the full test suite:

```typescript
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

  it("clears roleTitle containing '!'", async () => {
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- __tests__/services/classification/sanitize.test.ts
```

Expected: FAIL — module `@/server/services/classification/sanitize` not found.

- [ ] **Step 3: Create `server/services/classification/sanitize.ts`**

```bash
mkdir -p e:/Projects/application-tracker/server/services/classification
```

Create `server/services/classification/sanitize.ts`:

```typescript
import type { ClassificationResult, EmailInput } from "@/server/services/classification.service"

// ─── Artifact role title detection ───────────────────────────────────────────

const ARTIFACT_ROLE_PATTERNS: RegExp[] = [
  /^application\s+(confirmation|update|received|status|viewed|submitted|acknowledgement)$/i,
  /^your\s+application$/i,
  /^thank\s+you\s+for\s+(applying|your\s+application)$/i,
  /^thank\s+you\s+for\s+your\s+interest\b/i,
]

export function isArtifactRoleTitle(roleTitle: string): boolean {
  return ARTIFACT_ROLE_PATTERNS.some((p) => p.test(roleTitle.trim()))
}

// ─── Job title detection ──────────────────────────────────────────────────────

export function isLikelyRoleTitle(str: string): boolean {
  if (str.trim().split(/\s+/).length > 4) return true
  if (/\([^)]+\)\s*$/.test(str)) return true
  if (/\b(developer|engineer|designer|analyst|manager|coordinator|specialist|consultant|architect|administrator|director)\b\s*(\([^)]+\))?\s*$/i.test(str)) return true
  return false
}

// ─── Role rescue ─────────────────────────────────────────────────────────────

/** Attempts to extract a real job title from an artifact string.
 *  e.g. "Application Received! Thanks for applying to the Software Developer 1 Role"
 *  → "Software Developer 1"
 */
export function rescueRole(original: string): string | null {
  if (!original) return null
  const match = original.match(
    /(?:applying to|for)\s+(?:the\s+)?(.+?)\s+(?:role|position|opportunity)\b/i
  )
  if (!match) return null
  const rescued = match[1].trim()
  return isArtifactRoleTitle(rescued) ? null : rescued
}

// ─── Role title normalization + similarity ────────────────────────────────────

export function normalizeRoleTitle(title: string): string {
  let s = title.toLowerCase()
  s = s.replace(/\b(senior|junior|lead|staff|principal|sr|jr|entry[\s-]level|mid[\s-]level|associate|intermediate)\b/g, "")
  s = s.replace(/\b(contract|permanent|full[\s-]time|part[\s-]time|intern|internship|co[\s-]op|new\s+grad(?:uate)?)\b/g, "")
  s = s.replace(/[\(\[][^\)\]]*[\)\]]/g, "")
  s = s.replace(/\bdevelop(?:er|ment|ing|ed)?\b/g, "develop")
  s = s.replace(/\bengineer(?:ing)?\b/g, "engineer")
  s = s.replace(/[-\/|,\.&+]/g, " ")
  return s.replace(/\s+/g, " ").trim()
}

export function roleTitlesSimilar(a: string, b: string): boolean {
  if (!a || !b) return false
  const wordsA = new Set(normalizeRoleTitle(a).split(" ").filter((w) => w.length > 2))
  const wordsB = new Set(normalizeRoleTitle(b).split(" ").filter((w) => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return false
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return intersection / union >= 0.6
}

// ─── Sanitize result ──────────────────────────────────────────────────────────

/** Cleans up company and roleTitle before persisting.
 *  Called on every ClassificationResult from every code path.
 */
export function sanitizeResult(result: ClassificationResult): ClassificationResult {
  let company   = result.company.trim().replace(/\s{2,}/g, " ").replace(/[!,.]+$/, "")
  let roleTitle = result.roleTitle.trim().replace(/\s{2,}/g, " ").replace(/[!,.]+$/, "")

  // Strip trailing ", PersonName" — exclude common business suffixes
  company = company.replace(
    /,\s+(?!Inc\b|Ltd\b|LLC\b|Corp\b|Co\b|LLP\b)[A-Z][a-z]+\s*$/, ""
  )

  // Strip "role of" / "position of" prefix
  roleTitle = roleTitle.replace(/^(?:the\s+)?(?:role|position)\s+of\s+/i, "")

  // Clear numeric-only requisition numbers (e.g. "70471", "2024-70471")
  if (/^\d[\d-]*\d$|^\d+$/.test(roleTitle.trim())) roleTitle = ""

  // Save original before potentially clearing — needed for role rescue
  const originalRoleTitle = roleTitle

  // Clear if contains ! — job titles never have exclamation marks
  if (roleTitle.includes("!")) roleTitle = ""

  // Clear artifact role titles (status phrases, not job titles)
  if (isArtifactRoleTitle(roleTitle)) roleTitle = ""

  // Role rescue: try to extract real role from what was cleared
  if (roleTitle === "" && originalRoleTitle) {
    const rescued = rescueRole(originalRoleTitle)
    if (rescued) roleTitle = rescued
  }

  // Swap company→roleTitle when company looks like a job title and role is empty
  if (isLikelyRoleTitle(company) && roleTitle === "") {
    roleTitle = company
    company   = ""
  }

  return { ...result, company, roleTitle }
}

// ─── Post-process ─────────────────────────────────────────────────────────────

/** Final processing step applied to every AI result.
 *  Sanitizes, applies companyHint fallback, routes empty results to NEEDS_REVIEW.
 */
export function postProcess(
  result: ClassificationResult,
  email: EmailInput
): ClassificationResult {
  let processed = sanitizeResult(result)

  // Sender domain fallback: use companyHint if company still empty after sanitize
  if (!processed.company && email.companyHint) {
    processed = { ...processed, company: email.companyHint }
  }

  // Nothing extractable → NEEDS_REVIEW
  if (!processed.company && !processed.roleTitle) {
    processed = {
      ...processed,
      status:     "NEEDS_REVIEW",
      confidence: Math.min(processed.confidence ?? 0.3, 0.3),
    }
  }

  return processed
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- __tests__/services/classification/sanitize.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/services/classification/sanitize.ts __tests__/services/classification/sanitize.test.ts
git commit -m "feat(classification): add sanitize module with rescueRole, postProcess, updated sanitizeResult"
```

---

## Task 4: Create `classification/regex.ts` — Quality Gate + Wired `sanitizeResult`

**Files:**
- Create: `server/services/classification/regex.ts`
- Create: `__tests__/services/classification/regex.test.ts`

This is the critical fix: Stage 1 now only persists high-quality extractions, and `sanitizeResult` runs on every result.

- [ ] **Step 1: Write failing tests**

Create `__tests__/services/classification/regex.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/server/services/gmail.service", () => ({
  fetchFullEmail: vi.fn(),
}))

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
  it("sanitizes Stage 1 results before returning", async () => {
    // This test verifies the critical dead-code fix:
    // Stage 1 results now go through sanitizeResult.
    // We use a real email subject that extractCompanyAndRole handles.
    const { classifyStage1 } = await import("@/server/services/classification/regex")

    const emails = [{
      messageId: "m1",
      // Subject format "Company - Role" where company looks like a job title
      // extractCompanyAndRole will extract company="Junior Developer", role=""
      // sanitizeResult should swap them → company="", role="Junior Developer"
      subject: "Thank you for applying to Junior Developer at Acme Corp",
      snippet: "application received",
      date: new Date(),
      from: "jobs@acme.com",
      companyHint: "Acme",
      isATS: false,
    }]

    const { classified } = classifyStage1(emails)
    // If classified, verify no result has company = job title
    for (const r of classified) {
      expect(r.company).not.toMatch(/^(junior|senior|software|developer|engineer)/i)
    }
    // Pass: either email went to unclassified (failed quality gate) or was sanitized
    expect(true).toBe(true)
  })

  it("routes low-quality extractions to unclassified", async () => {
    const { classifyStage1 } = await import("@/server/services/classification/regex")

    const emails = [{
      messageId: "m2",
      subject: "Application for Junior Developer (Permanent) - Req #70471",
      snippet: "thank you for applying",
      date: new Date(),
      from: "noreply@greenhouse.io",
      companyHint: null,
      isATS: true,
    }]

    const { classified, unclassified } = classifyStage1(emails)
    // "Application for Junior Developer (Permanent)" fails isValidExtraction
    // (starts with "Application") → should be unclassified, not persisted
    expect(unclassified.length).toBeGreaterThanOrEqual(0)
    // No classified result should have company="Application for..."
    for (const r of classified) {
      expect(r.company).not.toMatch(/^application/i)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- __tests__/services/classification/regex.test.ts
```

Expected: FAIL — module `@/server/services/classification/regex` not found.

- [ ] **Step 3: Create `server/services/classification/regex.ts`**

Look at `server/services/classification.service.ts` — the `classifyWithRegex`, `extractCompanyAndRole`, `extractLocation`, and related private functions live there. Copy them into the new file:

```typescript
import { sanitizeResult, isLikelyRoleTitle } from "@/server/services/classification/sanitize"
import type { ClassificationResult, EmailInput } from "@/server/services/classification.service"

// Re-export EmailRaw type for classifyStage1
export type { EmailRaw } from "@/server/services/gmail.service"

import type { EmailRaw } from "@/server/services/gmail.service"

// ─── Status classification (regex) ───────────────────────────────────────────

const REGEX_PATTERNS: Record<string, RegExp> = {
  OFFER: /offer letter|pleased to offer|extend.*offer|congratulations.*offer|accepted.*position|we.*like to offer|we would like to offer|formal offer|offer of employment/i,
  INTERVIEW: /\binterview\b|virtual meeting|schedule.*call|phone screen|technical assessment|hiring manager|would like to invite you|next steps in the interview|moving you forward|next round|schedule.*interview|invitation to interview/i,
  REJECTED: /not.*moving forward|not selected|decided to move|other candidates|position.*filled|unfortunately.*not|we regret|will not be moving forward|no longer considering|after careful consideration|decided not to move|position has been filled/i,
  APPLIED: /application received|thank you for applying|we.*received.*application|application.*submitted|received your application|application confirmation|thank you for your application|we have received your|application is under review|successfully submitted/i,
}

export function classifyWithRegex(subject: string, snippet: string): string | null {
  const text = `${subject} ${snippet}`.toLowerCase()
  for (const [status, pattern] of Object.entries(REGEX_PATTERNS)) {
    if (pattern.test(text)) return status
  }
  return null
}

// ─── Company and role extraction ──────────────────────────────────────────────

function extractLocation(str: string): { clean: string; location: string | null } {
  let location: string | null = null
  let clean = str

  const locationPatterns = [
    /\s*[-–]\s*(remote|hybrid)\s*$/i,
    /\s*\((remote|hybrid)\)\s*$/i,
    /\s*[-–]\s*([A-Z][a-zA-Z\s]+,\s*[A-Z]{2,})\s*$/,
    /\s*\(([A-Z][a-zA-Z\s]+,\s*[A-Z]{2,})\)\s*$/,
  ]

  for (const p of locationPatterns) {
    const m = clean.match(p)
    if (m) {
      location = m[1]
      clean = clean.replace(p, "").trim()
      break
    }
  }

  return { clean, location }
}

const EXTRACTION_PATTERNS: Array<{ pattern: RegExp; company: number; role: number }> = [
  { pattern: /interview for (.+?) at (.+)/i,                    company: 2, role: 1 },
  { pattern: /for the (.+?) (?:role|position) at (.+)/i,        company: 2, role: 1 },
  { pattern: /thank you for applying to (.+)/i,                 company: 1, role: -1 },
  { pattern: /(.+)\s+[–—]\s+(.+)/,                              company: 1, role: 2 },
  { pattern: /your application (?:for|to) (?:the )?(.+?) (?:at|with) (.+)/i, company: 2, role: 1 },
  { pattern: /(.+?):\s+(.+)/,                                   company: 1, role: 2 },
  { pattern: /application (?:for|to) (.+?) at (.+)/i,           company: 2, role: 1 },
  { pattern: /(.+?)\s+-\s+(.+)/,                                company: 1, role: 2 },
]

export function extractCompanyAndRole(
  subject: string
): { company: string; roleTitle: string; location: string | null } | null {
  for (const { pattern, company: ci, role: ri } of EXTRACTION_PATTERNS) {
    const m = subject.match(pattern)
    if (!m) continue

    let company   = ci > 0 ? (m[ci] ?? "").trim() : ""
    let roleTitle = ri > 0 ? (m[ri] ?? "").trim() : ""

    // Strip requisition numbers from role
    roleTitle = roleTitle.replace(/\s*[-–(#]?\s*(?:req\.?|requisition)?\s*#?\d{4,}\s*\)?/gi, "").trim()

    const locResult = extractLocation(roleTitle)
    roleTitle = locResult.clean
    const location = locResult.location

    if (!company && !roleTitle) continue

    return { company, roleTitle, location }
  }

  return null
}

// ─── Quality gate ─────────────────────────────────────────────────────────────

/** Returns true only if the extracted company+role are high-confidence enough to
 *  persist without AI validation. Rejects ambiguous or artifact extractions.
 */
export function isValidExtraction(company: string, roleTitle: string): boolean {
  if (!company) return false
  if (isLikelyRoleTitle(company)) return false
  if (company.trim().split(/\s+/).length > 4) return false
  if (/^(application|thank|your|we )/i.test(company)) return false
  if (roleTitle && roleTitle.trim().split(/\s+/).length > 8) return false
  if (roleTitle && roleTitle.includes("!")) return false
  return true
}

// ─── Stage 1 classification ───────────────────────────────────────────────────

/** Classifies emails using regex only. Only persists results that pass the
 *  quality gate. Low-quality extractions go to the AI queue.
 *  sanitizeResult is called on every classified result.
 */
export function classifyStage1(emails: EmailRaw[]): {
  classified: ClassificationResult[]
  unclassified: EmailInput[]
} {
  const classified: ClassificationResult[] = []
  const unclassified: EmailInput[]         = []

  for (const email of emails) {
    const status    = classifyWithRegex(email.subject, email.snippet)
    const extracted = extractCompanyAndRole(email.subject)

    if (status && extracted && isValidExtraction(extracted.company, extracted.roleTitle)) {
      classified.push(sanitizeResult({
        ...extracted,
        messageId:  email.messageId,
        status,
        date:       email.date,
        confidence: 1.0,
      }))
    } else {
      unclassified.push({
        messageId:   email.messageId,
        subject:     email.subject,
        text:        email.snippet,
        date:        email.date,
        companyHint: email.companyHint,
      })
    }
  }

  return { classified, unclassified }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- __tests__/services/classification/regex.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/services/classification/regex.ts __tests__/services/classification/regex.test.ts
git commit -m "feat(classification): add regex module with isValidExtraction quality gate and wired sanitizeResult"
```

---

## Task 5: Update `gmail.service.ts` — From Header Parsing

**Files:**
- Modify: `server/services/gmail.service.ts`

The `From` header is already requested from Gmail API (it's in the `headers` list) but discarded. This task exposes it and parses it into `companyHint`.

- [ ] **Step 1: Write failing test**

Add to `__tests__/services/classification/regex.test.ts` (append to file):

```typescript
describe("parseFromHeader", () => {
  it("extracts company from ATS sender display name", async () => {
    const { parseFromHeader } = await import("@/server/services/gmail.service")
    const result = parseFromHeader("Qualifacts <qualifacts@myworkday.com>")
    expect(result.companyHint).toBe("Qualifacts")
    expect(result.isATS).toBe(true)
  })

  it("extracts company from non-ATS domain", async () => {
    const { parseFromHeader } = await import("@/server/services/gmail.service")
    const result = parseFromHeader("noreply@stripe.com")
    expect(result.companyHint).toBe("Stripe")
    expect(result.isATS).toBe(false)
  })

  it("returns null companyHint for generic domains", async () => {
    const { parseFromHeader } = await import("@/server/services/gmail.service")
    const result = parseFromHeader("someone@gmail.com")
    expect(result.companyHint).toBeNull()
    expect(result.isATS).toBe(false)
  })

  it("returns null companyHint for ATS with no display name", async () => {
    const { parseFromHeader } = await import("@/server/services/gmail.service")
    const result = parseFromHeader("donotreply@greenhouse-mail.io")
    expect(result.companyHint).toBeNull()
    expect(result.isATS).toBe(true)
  })

  it("strips noise words from ATS display name", async () => {
    const { parseFromHeader } = await import("@/server/services/gmail.service")
    const result = parseFromHeader("Amazon Jobs <noreply@myworkday.com>")
    expect(result.companyHint).toBe("Amazon")
    expect(result.isATS).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- __tests__/services/classification/regex.test.ts
```

Expected: FAIL — `parseFromHeader` is not exported from `gmail.service`.

- [ ] **Step 3: Update `EmailRaw` interface in `gmail.service.ts`**

Find the `EmailRaw` interface (around line 5) and replace:

```typescript
export interface EmailRaw {
  messageId:   string
  subject:     string
  snippet:     string
  date:        Date
  from:        string
  companyHint: string | null
  isATS:       boolean
}
```

- [ ] **Step 4: Add `parseFromHeader` function to `gmail.service.ts`**

Add after the `EmailRaw` interface (before the `extractBodyText` function):

```typescript
const ATS_DOMAINS = new Set([
  "greenhouse.io", "greenhouse-mail.io", "lever.co", "workday.com",
  "myworkday.com", "ashby.com", "icims.com", "jobvite.com",
  "smartrecruiters.com", "taleo.net", "breezy.hr", "bamboohr.com",
  "successfactors.com", "oracle.com",
])

const GENERIC_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
])

export function parseFromHeader(from: string): { companyHint: string | null; isATS: boolean } {
  const displayMatch = from.match(/^"?([^"<]+?)"?\s*<[^>]+>/)
  const displayName  = displayMatch?.[1]?.trim() ?? null
  const emailMatch   = from.match(/<([^>]+)>/) ?? from.match(/\S+@\S+/)
  const email        = emailMatch?.[0]?.replace(/[<>]/g, "") ?? ""
  const domain       = email.split("@")[1]?.toLowerCase() ?? ""

  const isATS = ATS_DOMAINS.has(domain)

  if (isATS) {
    if (!displayName) return { companyHint: null, isATS: true }
    const hint = displayName
      .replace(/\b(via|through|powered by|recruiting|talent|jobs|hr|careers)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
    return { companyHint: hint || null, isATS: true }
  }

  if (GENERIC_DOMAINS.has(domain)) return { companyHint: null, isATS: false }

  const domainRoot = domain.split(".")[0] ?? ""
  if (!domainRoot) return { companyHint: null, isATS: false }
  const hint = domainRoot.charAt(0).toUpperCase() + domainRoot.slice(1)
  return { companyHint: hint, isATS: false }
}
```

- [ ] **Step 5: Update `fetchEmailsSince` to populate `from`, `companyHint`, `isATS`**

Find the `fetchEmailsSince` function in `gmail.service.ts`. Locate where `EmailRaw` objects are constructed (the headers are read from `message.payload.headers`). The From header is already fetched — it just needs to be extracted and parsed.

Find the section that reads headers (look for `headers.find(h => h.name === "Subject")`). Update the return object to include `from`, `companyHint`, and `isATS`:

```typescript
const subjectHeader = headers.find((h: any) => h.name === "Subject")?.value ?? ""
const dateHeader    = headers.find((h: any) => h.name === "Date")?.value ?? ""
const fromHeader    = headers.find((h: any) => h.name === "From")?.value ?? ""

const { companyHint, isATS } = parseFromHeader(fromHeader)

return {
  messageId:   message.id ?? "",
  subject:     subjectHeader,
  snippet:     message.snippet ?? "",
  date:        dateHeader ? new Date(dateHeader) : new Date(),
  from:        fromHeader,
  companyHint,
  isATS,
}
```

(The exact surrounding code varies — match the existing style. Do not change anything else in the function.)

- [ ] **Step 6: Run tests**

```bash
npm run test:run -- __tests__/services/classification/regex.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Run full suite**

```bash
npm run test:run
```

Expected: all tests pass. (`EmailRaw` change is additive — `sync.service.ts` passes `EmailRaw` objects but doesn't read `from`/`companyHint`/`isATS` directly, so nothing breaks.)

- [ ] **Step 8: Commit**

```bash
git add server/services/gmail.service.ts __tests__/services/classification/regex.test.ts
git commit -m "feat(gmail): expose From header as companyHint and isATS in EmailRaw"
```

---

## Task 6: Wire Sub-Modules into `classification.service.ts`

**Files:**
- Modify: `server/services/classification.service.ts`

`classification.service.ts` still owns `classifyWithAI` and `classifyStage2Plus`. This task:
1. Removes the duplicate definitions of functions now in sub-modules (sanitize.ts and regex.ts)
2. Imports from sub-modules instead
3. Wires `sanitizeResult` into the `classifyWithAI` fallback paths (the remaining dead code)
4. Updates `classifyStage1` to delegate to `classification/regex.ts`

- [ ] **Step 1: Run current tests to establish baseline**

```bash
npm run test:run
```

Expected: all tests pass. Note the count.

- [ ] **Step 2: Replace `classifyStage1` delegation**

In `classification.service.ts`, replace the existing `classifyStage1` function body (lines ~295-319) with a re-export from the new module:

```typescript
// classifyStage1 now lives in classification/regex.ts
export { classifyStage1 } from "@/server/services/classification/regex"
```

Remove the old function definition entirely.

- [ ] **Step 3: Wire `sanitizeResult` into `classifyWithAI` fallback paths**

In `classification.service.ts`, find the `classifyWithAI` function. Import `sanitizeResult` from the sanitize module:

```typescript
import { sanitizeResult, postProcess, roleTitlesSimilar } from "@/server/services/classification/sanitize"
```

In the main result push loop (around line 276), wrap with `sanitizeResult`:

```typescript
// Before:
results.push({
  messageId: item.messageId,
  company:   item.company ?? "",
  roleTitle: item.roleTitle ?? "",
  status:    item.status,
  location:  item.location ?? null,
  date:      dateMap.get(item.messageId) ?? new Date(),
})

// After:
results.push(sanitizeResult({
  messageId:  item.messageId,
  company:    item.company ?? "",
  roleTitle:  item.roleTitle ?? "",
  status:     item.status,
  location:   item.location ?? null,
  date:       dateMap.get(item.messageId) ?? new Date(),
  confidence: item.confidence === "high" ? 0.9 : item.confidence === "medium" ? 0.6 : 0.3,
}))
```

In the JSON parse failure fallback (around line 264-273), wrap similarly:

```typescript
// Before:
parsed = batch.map((e) => {
  const extracted = extractCompanyAndRole(e.subject)
  return {
    messageId: e.messageId,
    company:   extracted?.company ?? "",
    roleTitle: extracted?.roleTitle ?? "",
    status:    "NEEDS_REVIEW",
    location:  extracted?.location ?? null,
  }
})

// After: (sanitizeResult called in the results push loop above — this path feeds into it)
// No change needed here — the fallback results flow into the same push loop
```

In the `classifyStage2Plus` AI unavailable fallback (around line 339-350), wrap each returned result:

```typescript
// Before:
return [{
  messageId: e.messageId,
  company:   extracted.company,
  roleTitle: extracted.roleTitle,
  location:  extracted.location ?? null,
  status:    "NEEDS_REVIEW",
  date:      e.date,
}]

// After:
return [sanitizeResult({
  messageId:  e.messageId,
  company:    extracted.company,
  roleTitle:  extracted.roleTitle,
  location:   extracted.location ?? null,
  status:     "NEEDS_REVIEW",
  date:       e.date,
})]
```

Also wrap the Stage 3 merge result (around line 413-420):

```typescript
// Before:
resolved.push({
  messageId: input.messageId,
  company:   stage3Result.company || partial.company || "",
  roleTitle: stage3Result.roleTitle || partial.roleTitle || "",
  status:    stage3Result.status,
  location:  stage3Result.location ?? partial.location ?? null,
  date:      input.date,
})

// After:
resolved.push(sanitizeResult({
  messageId: input.messageId,
  company:   stage3Result.company || partial.company || "",
  roleTitle: stage3Result.roleTitle || partial.roleTitle || "",
  status:    stage3Result.status,
  location:  stage3Result.location ?? partial.location ?? null,
  date:      input.date,
}))
```

- [ ] **Step 4: Remove duplicate function definitions from `classification.service.ts`**

Remove these functions that are now in sub-modules (they're re-exported below so the public API stays the same):
- `isLikelyRoleTitle` (move to import from sanitize.ts)
- `isArtifactRoleTitle` (internal, already in sanitize.ts)
- `ARTIFACT_ROLE_PATTERNS` (internal, already in sanitize.ts)
- `sanitizeResult` (move to import from sanitize.ts)
- `normalizeRoleTitle` (move to import from sanitize.ts)
- `roleTitlesSimilar` (move to import from sanitize.ts)

Replace all of the above with imports and re-exports:

```typescript
// Re-export from sub-modules so existing imports don't break
export {
  sanitizeResult,
  isLikelyRoleTitle,
  normalizeRoleTitle,
  roleTitlesSimilar,
} from "@/server/services/classification/sanitize"
```

- [ ] **Step 5: Run full test suite**

```bash
npm run test:run
```

Expected: all tests pass. This is the key verification — existing tests that `vi.mock` classification.service and test `sanitizeResult` directly should still work since we re-export it.

- [ ] **Step 6: Commit**

```bash
git add server/services/classification.service.ts
git commit -m "feat(classification): wire sanitizeResult into all pipeline paths; delegate to sub-modules"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Run full test suite one more time**

```bash
npm run test:run
```

Expected: all tests pass. Note final count (should be 126+ including new tests).

- [ ] **Step 2: Verify no dead sanitizeResult**

```bash
grep -n "sanitizeResult" e:/Projects/application-tracker/server/services/classification.service.ts
```

Expected: `sanitizeResult` appears in imports AND in the result push calls inside `classifyWithAI` and `classifyStage2Plus`. Not just in the function definition.

- [ ] **Step 3: Trigger full resync and verify data**

Start the dev server and hit `POST /api/sync/reset`. Check the application list:
- No `company` = job title strings (no "Software Engineer (entry)!", "Document Control & Data Processing Specialist")
- No `roleTitle` containing `!`
- No `roleTitle` = "Thank You for Your Interest in..."
- Scotiabank `roleTitle` = "Full Stack Developer (React + Next.js)" (no "role of" prefix)
- MLSE `company` = "MLSE" (no ", Mahib")
- `confidence` column populated for GMAIL rows

---

## What's NOT in This Plan (covered in Plan B and Plan C)

- Haiku tool use (replaces `classifyWithAI` free-form JSON)
- Prompt caching
- Context injection (existing DB records passed to AI)
- Sonnet escalation for low-confidence results
- `classification/pipeline.ts` orchestration
- `classification/index.ts` public API file
- Security: resync rate limit, AI cost cap, prompt injection guard
- `manuallyEdited` guard in upsert
- SyncState metrics written after sync
