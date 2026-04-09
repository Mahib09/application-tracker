# Gmail Parsing Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve email classification coverage and quality so the sync pipeline extracts company, role, and status from nearly every job application email, with minimal NEEDS_REVIEW fallback.

**Architecture:** Three targeted changes to `classification.service.ts` — better preprocessing (salary scrubbing, body mode), a stricter AI prompt (no placeholder values, concise fields, discard non-job emails), and selective Stage 3 (re-fetch full body only when company or role is missing after Stage 2). A word-count guard on the dash regex pattern prevents full sentences being extracted as role titles.

**Tech Stack:** TypeScript, Anthropic SDK (`claude-haiku-4-5-20251001`), Gmail API (`googleapis`), Vitest

---

## Context for the implementer

This is a Next.js 16 App Router project. All business logic lives in `server/services/`. Tests live in `__tests__/services/` mirroring the source. The project uses Vitest — run tests with `npm run test:run` (non-interactive). Follow TDD: write the failing test first, confirm it fails, implement, confirm it passes.

**Import paths:**
```typescript
import { prisma } from "@/server/lib/prisma"
import { applicationStatus } from "@/app/generated/prisma/enums"
// Enums are lowercase names, uppercase values: applicationStatus.APPLIED
```

**Current pipeline:**
1. `gmail.service.ts` — fetches emails (subject + snippet, `format: "metadata"`)
2. `classification.service.ts` — Stage 1 regex → Stage 2 AI on snippet → result
3. `sync.service.ts` — upserts results to DB (latest-date-wins dedup)

**Known issues this plan fixes (from real sync output):**
- `"Intuit / Application Received! Thanks for applying to the Software Developer 1 Role"` — AI put the full sentence in `roleTitle`
- `"MLSE, Mahib ! / Thank You for Your Interest in the Fullstack Engineer Opportunity"` — dash pattern split wrongly
- `"Unknown Role"` on 15+ entries — role only exists in email body, not snippet
- `"Unknown"` company on several entries — same cause

---

## Files to change

| File | Change |
|---|---|
| `server/services/classification.service.ts` | All 4 tasks — preprocessText, AI prompt, Stage 3, dash guard |
| `__tests__/services/classification.test.ts` | Tests for all 4 tasks |

No other files touched. No schema changes. No new dependencies.

---

## Task 1: Add salary scrubbing and body mode to `preprocessText`

**Files:**
- Modify: `server/services/classification.service.ts:23-33`
- Test: `__tests__/services/classification.test.ts`

**Background:** `preprocessText` currently strips HTML, emails, phones, URLs, then truncates to 500 chars. We need two additions: (1) strip salary figures before sending to AI, (2) a `"body"` mode that truncates to 800 chars (roles appear in the opening paragraph of the body — 800 chars is enough without exposing offer letter amounts deeper in the email).

- [ ] **Step 1: Write the failing tests**

Add to the `preprocessText` describe block in `__tests__/services/classification.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run -- __tests__/services/classification.test.ts
```

Expected: 4 new tests fail.

- [ ] **Step 3: Update `preprocessText` signature and implementation**

Replace the current `preprocessText` function (`classification.service.ts` lines 23–33):

```typescript
export function preprocessText(
  subject: string,
  text: string,
  mode: "snippet" | "body" = "snippet"
): string {
  let combined = `${subject} ${text}`
  // Strip HTML tags
  combined = combined.replace(/<[^>]+>/g, "")
  // Replace PII
  combined = combined.replace(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi, "[email]")
  combined = combined.replace(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[phone]")
  combined = combined.replace(/https?:\/\/[^\s]+/g, "[url]")
  // Strip salary figures: $120,000 / CAD $95,000 / USD 80k / €75,000
  combined = combined.replace(
    /(?:USD|CAD|GBP|EUR|AUD)?\s*\$[\d,]+(?:\.\d{2})?(?:\s*[-–]\s*\$[\d,]+(?:\.\d{2})?)?/gi,
    "[salary]"
  )
  combined = combined.replace(/\b\d{2,3}[kK]\b/g, "[salary]")
  // Truncate based on mode
  const limit = mode === "body" ? 800 : 500
  return combined.slice(0, limit)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:run -- __tests__/services/classification.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/services/classification.service.ts __tests__/services/classification.test.ts
git commit -m "fix(classification): add salary scrubbing and body mode to preprocessText"
```

---

## Task 2: Tighten the AI prompt — no placeholders, concise fields, discard non-job emails

**Files:**
- Modify: `server/services/classification.service.ts:200-214` (the prompt string in `classifyWithAI`)
- Modify: `server/services/classification.service.ts:230-239` (parse failure fallback)
- Test: `__tests__/services/classification.test.ts`

**Background:** The current prompt tells the AI to use `"Unknown Role"` when unclear. This causes full sentences like `"Application Received! Thanks for applying to the Software Developer 1 Role"` to be stored as roleTitle. The fix: tell the AI to return `null` for unknown fields and to keep roleTitle to a concise job title only. Also fix the parse-failure catch block which still returns `"Unknown"` / `"Unknown Role"`.

- [ ] **Step 1: Write the failing tests**

Add to the `classifyWithAI` describe block in `__tests__/services/classification.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run -- __tests__/services/classification.test.ts
```

- [ ] **Step 3: Replace the prompt string in `classifyWithAI`**

Replace lines 200–214 (the `const prompt = ...` block) with:

```typescript
const prompt = `You are extracting job application data from emails. For each email return:
- company: the company name only (e.g. "Google", "Stripe"). Return null if unknown.
- roleTitle: the job title only, concise (e.g. "Software Engineer", "Frontend Developer"). Return null if unknown. Never return a full sentence.
- status: one of APPLIED | INTERVIEW | OFFER | REJECTED | GHOSTED | NEEDS_REVIEW
- location: city/country, "Remote", "Hybrid", or null

Rules:
- Return null for company or roleTitle if you cannot determine them — do not guess or use placeholder values.
- Discard entirely (omit from response) if the email is: a calendar invite, meeting invitation, "application viewed" notification, out-of-office reply, referral email where no application was submitted, or newsletter.
- Return a JSON array only, no other text.

Example: [{"messageId":"id1","company":"Acme","roleTitle":"Engineer","status":"APPLIED","location":"Remote"}]

Emails:
${JSON.stringify(batch.map((e) => ({ messageId: e.messageId, subject: e.subject, text: e.text })))}
`
```

- [ ] **Step 4: Fix the parse-failure catch block**

Replace lines 230–239 (the catch block inside the batch loop):

```typescript
} catch {
  // If parse fails, fall back to subject extraction for each email in batch
  parsed = batch.map((e) => {
    const extracted = extractCompanyAndRole(e.subject)
    return {
      messageId: e.messageId,
      company: extracted?.company ?? "",
      roleTitle: extracted?.roleTitle ?? "",
      status: "NEEDS_REVIEW",
      location: extracted?.location ?? null,
    }
  })
}
```

- [ ] **Step 5: Fix null handling in the result loop**

In the result-building loop after `parsed` is determined (lines 241–250), handle null company/roleTitle from AI:

```typescript
for (const item of parsed) {
  results.push({
    messageId: item.messageId,
    company: item.company ?? "",
    roleTitle: item.roleTitle ?? "",
    status: item.status,
    location: item.location ?? null,
    date: dateMap.get(item.messageId) ?? new Date(),
  })
}
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npm run test:run -- __tests__/services/classification.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add server/services/classification.service.ts __tests__/services/classification.test.ts
git commit -m "fix(classification): tighten AI prompt, return null instead of Unknown placeholders"
```

---

## Task 3: Word-count guard on the dash/colon regex pattern in `extractCompanyAndRole`

**Files:**
- Modify: `server/services/classification.service.ts:122-128` (the `"Company - Role"` branch)
- Test: `__tests__/services/classification.test.ts`

**Background:** The pattern `/^(.+?)\s*[-:]\s*(.+)$/` splits on the first dash or colon in the subject. This works for `"Acme - Software Engineer"` but wrongly splits `"MLSE - Thank You for Your Interest in the Fullstack Engineer Opportunity"`, making the full sentence the roleTitle. Guard: if the extracted role portion is more than 6 words, this subject is not in `"Company - Role"` format — skip the pattern and return null (AI will handle it).

- [ ] **Step 1: Write the failing test**

Add to the `extractCompanyAndRole` describe block:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run -- __tests__/services/classification.test.ts
```

- [ ] **Step 3: Add the word-count guard**

In `extractCompanyAndRole`, find the `"Company - Role"` branch (the `m = s.match(/^(.+?)\s*[-:]\s*(.+)$/)` block) and add the guard:

```typescript
m = s.match(/^(.+?)\s*[-:]\s*(.+)$/)
if (m) {
  const candidateRole = m[2].trim()
  // Guard: if the role portion is more than 6 words it's a sentence, not a title
  if (candidateRole.split(/\s+/).length > 6) return null
  companyRaw = m[1].trim()
  roleRaw = candidateRole
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:run -- __tests__/services/classification.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add server/services/classification.service.ts __tests__/services/classification.test.ts
git commit -m "fix(classification): guard dash pattern against sentence-length role extraction"
```

---

## Task 4: Re-introduce selective Stage 3 — full body fetch when company or role is missing

**Files:**
- Modify: `server/services/classification.service.ts` — `classifyStage2Plus` function (lines 291–328)
- Test: `__tests__/services/classification.test.ts`

**Background:** We removed Stage 3 earlier for privacy. We're bringing it back selectively — only when Stage 2 returns a result with missing company OR missing roleTitle. The full body is fetched, run through `preprocessText` in body mode (800 chars, PII + salary stripped), and sent to AI. If Stage 3 still can't resolve → NEEDS_REVIEW with whatever partial data exists. Non-job emails from Stage 3 are discarded.

The trigger condition: `res.company === "" || res.roleTitle === ""`

`fetchFullEmail` is already exported from `gmail.service.ts` — re-import it.

- [ ] **Step 1: Write the failing tests**

Find the `classifyBatch` describe block in `__tests__/services/classification.test.ts`. The mock for `fetchFullEmail` was removed in a previous task — add it back at the top of the file:

```typescript
// At the top with other mocks:
vi.mock("@/server/services/gmail.service", () => ({
  fetchFullEmail: vi.fn(),
}))
import { fetchFullEmail } from "@/server/services/gmail.service"
```

Add these tests to the `classifyBatch` describe block:

```typescript
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
  const stage2Response = JSON.stringify([
    { messageId: "msg-1", company: null, roleTitle: null, status: "NEEDS_REVIEW", location: null },
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run -- __tests__/services/classification.test.ts
```

- [ ] **Step 3: Re-add `fetchFullEmail` import to `classification.service.ts`**

At the top of the file, update the import from gmail.service:

```typescript
import { fetchFullEmail, type EmailRaw } from "@/server/services/gmail.service"
```

- [ ] **Step 4: Rewrite `classifyStage2Plus` with selective Stage 3**

Replace the entire `classifyStage2Plus` function:

```typescript
export async function classifyStage2Plus(
  emails: EmailInput[],
  gmailClient: OAuth2Client
): Promise<ClassificationResult[]> {
  if (emails.length === 0) return []

  // Stage 2: AI on subject + snippet
  let stage2Results: ClassificationResult[]
  try {
    stage2Results = await classifyWithAI(emails)
  } catch {
    // AI unavailable — best-effort subject extraction, discard if nothing found
    return emails.flatMap((e) => {
      const extracted = extractCompanyAndRole(e.subject)
      if (!extracted) return []
      return [{
        messageId: e.messageId,
        company: extracted.company,
        roleTitle: extracted.roleTitle,
        location: extracted.location ?? null,
        status: "NEEDS_REVIEW",
        date: e.date,
      }]
    })
  }

  const resolved: ClassificationResult[] = []
  const stage3Queue: Array<{ input: EmailInput; partial: ClassificationResult }> = []

  for (const res of stage2Results) {
    // Discard if AI returned nothing useful (both empty — not a job email)
    if (!res.company && !res.roleTitle) continue

    // Selective Stage 3: fetch full body if either company or role is still missing
    if (!res.company || !res.roleTitle) {
      const original = emails.find((e) => e.messageId === res.messageId)!
      stage3Queue.push({ input: original, partial: res })
    } else {
      resolved.push(res)
    }
  }

  if (stage3Queue.length === 0) return resolved

  // Stage 3: AI on full body for emails still missing company or role
  const stage3Inputs: EmailInput[] = []
  for (const { input } of stage3Queue) {
    try {
      const bodyText = await fetchFullEmail(gmailClient, input.messageId)
      stage3Inputs.push({
        messageId: input.messageId,
        subject: input.subject,
        text: preprocessText(input.subject, bodyText, "body"),
        date: input.date,
      })
    } catch {
      // If body fetch fails, keep partial Stage 2 result as NEEDS_REVIEW
      const { partial } = stage3Queue.find((q) => q.input.messageId === input.messageId)!
      resolved.push({ ...partial, status: "NEEDS_REVIEW" })
    }
  }

  if (stage3Inputs.length === 0) return resolved

  let stage3Results: ClassificationResult[]
  try {
    stage3Results = await classifyWithAI(stage3Inputs)
  } catch {
    // AI failed — keep partial Stage 2 results as NEEDS_REVIEW
    stage3Results = stage3Queue
      .filter((q) => stage3Inputs.some((i) => i.messageId === q.input.messageId))
      .map(({ partial }) => ({ ...partial, status: "NEEDS_REVIEW" }))
  }

  // Build a map for Stage 3 results
  const stage3Map = new Map(stage3Results.map((r) => [r.messageId, r]))

  for (const { input, partial } of stage3Queue) {
    if (!stage3Inputs.some((i) => i.messageId === input.messageId)) continue

    const stage3Result = stage3Map.get(input.messageId)
    if (!stage3Result) {
      // AI discarded this email (not job-related) — discard silently
      continue
    }
    // Merge: prefer Stage 3 values, fall back to Stage 2 partial
    resolved.push({
      messageId: input.messageId,
      company: stage3Result.company || partial.company || "",
      roleTitle: stage3Result.roleTitle || partial.roleTitle || "",
      status: stage3Result.status,
      location: stage3Result.location ?? partial.location ?? null,
      date: input.date,
    })
  }

  return resolved
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm run test:run -- __tests__/services/classification.test.ts
```

- [ ] **Step 6: Run full suite**

```bash
npm run test:run
```

Expected: all test files pass.

- [ ] **Step 7: Commit**

```bash
git add server/services/classification.service.ts __tests__/services/classification.test.ts
git commit -m "fix(classification): re-introduce selective Stage 3 for missing company/role"
```

---

## Verification

After all 4 tasks are complete:

1. Reset `SyncState.lastSyncedAt` to `null` via Prisma Studio (`npx prisma studio`) so the next sync fetches 3 months of email history
2. Trigger sync from the dashboard
3. Check network tab response: `synced > 0`
4. Check dashboard:
   - `"Unknown Role"` entries should be significantly reduced (target < 5)
   - No full sentences in `roleTitle` column
   - Company names should be clean (not `"MLSE, Mahib !"`)
5. Run full test suite: `npm run test:run` — all pass

---

## Known limitations (not addressed in this plan)

- **Company name variations** — "TD" / "TD Bank" / "TD Careers" create separate records. No automated fix — user merges manually.
- **Assessment platform emails** — HackerRank/Codility/Karat hide the actual company. Stage 3 may recover it from body, but not guaranteed.
- **Truly content-free status emails** — `"Your application status has been updated. Log in to check."` — no role, no company, anywhere. These will be NEEDS_REVIEW permanently.
- **Thread ID / sender linking** — planned for a future phase after validating Stage 3 coverage.
