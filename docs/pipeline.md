# Pipeline Redesign: Deterministic Filter -> Haiku Triage -> Sonnet Classification

## Context

The current 3-stage pipeline mixes deterministic regex with AI: regex does status detection, company/role extraction, and job-relevance filtering via keywords. Only Haiku is used (no Sonnet), and confidence scores aren't used for routing decisions.

The redesign enforces a clean separation:
- **Deterministic code** handles ONLY structural noise removal
- **Haiku** handles ONLY job-relevance triage (YES/NO/UNCERTAIN)
- **Sonnet** handles ALL semantic extraction (status, company, role, confidence)
- **Functions/deterministic code NEVER decide role, status, or job-relevance**

```
Current:
  emails -> isNonJobEmail(regex) -> classifyWithRegex(status) -> extractCompanyAndRole(regex)
         -> classifyWithAI(Haiku on snippet) -> classifyWithAI(Haiku on full body)

Target:
  emails -> deterministicFilter(structural only) -> haikuTriage(YES/NO/UNCERTAIN)
         -> sonnetClassify(full body -> status + company + role + confidence)
         -> confidence routing (>0.9 auto-commit | 0.7-0.9 flag | <0.7 NEEDS_REVIEW)
```

One consistent pipeline for both initial sync and daily processing. Only difference is volume.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| UNCERTAIN from Haiku | Goes to Sonnet (same as YES) | Haiku is purely a cost gate, not a quality gate |
| Sonnet call cap | No cap | Classify everything that passes triage |
| Sonnet model | `claude-sonnet-4-6` | Latest, best quality |
| Haiku model | `claude-haiku-4-5-20251001` | Same as current, cheap and fast |
| Sonnet body truncation | 2000 chars | Enough for complex emails, keeps cost reasonable |
| Blocklist | Social + marketing + LinkedIn notifications | Hardcoded `Set<string>` |
| Gmail query | Keep current keyword + ATS domain query | Already good pre-filter, Haiku handles the rest |

**Blocklisted domains:** `linkedin.com`, `facebookmail.com`, `twitter.com`, `x.com`, `instagram.com`, `tiktok.com`, `reddit.com`, `discord.com`, `mail.mailchimp.com`, `sendgrid.net`, `constantcontact.com`, `pinterest.com`, `quora.com`, `medium.com`, `substack.com`

---

## Cross-Cutting: Resilience & Fallbacks

- **Sonnet fails for one email:** That email gets `NEEDS_REVIEW` with `confidence: 0`
- **Sonnet batch fails entirely** (auth error, rate limit): Fall back to Haiku for degraded classification (company/role/status extraction, confidence capped at 0.6 to force review)
- **Haiku fails:** All emails treated as `UNCERTAIN` (fail-open), flow to Sonnet
- **Both down:** All emails get `NEEDS_REVIEW`
- **`fetchFullEmail` fails for one email:** That email gets `NEEDS_REVIEW`, batch continues
- **Rate limiting:** Concurrency semaphore -- max 5 concurrent Sonnet calls, max 2 concurrent Haiku batches. Exponential backoff with 3 retries on 429/529

---

## Cross-Cutting: Prompts

### Haiku Triage Prompt

```
You are an email triage system. For each email, determine if it relates
to a job application, recruitment process, interview, offer, or rejection.

Return a JSON array: [{ "id": "<messageId>", "result": "YES" | "NO" | "UNCERTAIN" }]

- YES: clearly about a job application or hiring process
- NO: clearly unrelated (newsletters, shipping, billing, social media,
  infrastructure alerts, password resets, marketing)
- UNCERTAIN: could be job-related but not clear

Emails:
[{ "id": "...", "subject": "...", "sender": "...", "preview": "..." }]
```

### Sonnet Classification Prompt

```
Extract job application data from this email. Return a JSON object:

{
  "company": "company name or null",
  "roleTitle": "specific job title or null",
  "status": "APPLIED | INTERVIEW | OFFER | REJECTED",
  "location": "city/state, Remote, Hybrid, or null",
  "confidence": 0.0-1.0
}

Rules:
- company: the hiring company, NOT the ATS platform (Greenhouse, Lever, etc.)
- roleTitle: concise job title only, not a sentence or status phrase
- status: based on email content, not subject line alone
- confidence: how certain you are about ALL extracted fields together
  - 1.0 = unambiguous, all fields clearly present
  - 0.7-0.9 = mostly clear, one field uncertain
  - <0.7 = significant ambiguity
- If sender hint provided, verify against email content before using
- Return null for fields you cannot determine, do not guess

Sender hint: {companyHint}
Subject: {subject}
From: {sender}
Body:
{body}
```

---

## Cross-Cutting: Observability

New fields on `SyncState` (via migration):

```prisma
filteredCount        Int?  // emails dropped by deterministic filter
haikuCallCount       Int?  // number of Haiku API calls
triageYesCount       Int?  // Haiku YES count
triageNoCount        Int?  // Haiku NO count
triageUncertainCount Int?  // Haiku UNCERTAIN count
autoCommitCount      Int?  // confidence > 0.9
reviewFlagCount      Int?  // confidence 0.7-0.9
manualQueueCount     Int?  // confidence < 0.7
```

`sonnetCallCount`, `emailsFetched`, `emailsClassified` already exist.

---

## Phase 0: Schema Migration

**Files:** `prisma/schema.prisma`

Add the 8 observability fields above to `SyncState` model.

```bash
npx prisma migrate dev --name add_sync_observability
npx prisma generate
```

---

## Phase 1: Gmail Service -- Add Structural Metadata

**Files:** `server/services/gmail.service.ts`, `__tests__/services/gmail.test.ts`

### Changes to `EmailRaw` interface:
```typescript
export interface EmailRaw {
  messageId: string;
  subject: string;
  snippet: string;
  date: Date;
  from: string;
  companyHint: string | null;
  isATS: boolean;
  listUnsubscribe: string | null;  // NEW
  labelIds: string[];               // NEW
}
```

### Steps:
1. **Test first:** Add tests for new fields -- verify `listUnsubscribe` is parsed from headers, `labelIds` from response data
2. Add `"List-Unsubscribe"` to `metadataHeaders` array (currently `["Subject", "Date", "From"]`)
3. Parse `List-Unsubscribe` header value from response
4. Parse `labelIds` from `getRes.data.labelIds` (already available in Gmail API metadata response)
5. Export `ATS_DOMAINS` set (currently module-private) so `filter.ts` can import it

---

## Phase 2: Deterministic Filter

**New file:** `server/services/classification/filter.ts`
**New test:** `__tests__/services/classification/filter.test.ts`

### Function signature:
```typescript
export function isDeterministicallyFiltered(email: EmailRaw): boolean
```

### Filter rules (returns `true` = drop):
1. `listUnsubscribe` is non-null AND `isATS === false` (ATS emails with unsubscribe headers pass through)
2. Sender domain is in `BLOCKLISTED_DOMAINS` set
3. `labelIds` includes `CATEGORY_PROMOTIONS` or `CATEGORY_SOCIAL`

### Hard constraints:
- NO keyword matching on subject or snippet
- NO status detection
- NO role/company extraction
- Only structural/metadata signals

### Steps:
1. **Test first:** Write tests for each filter rule + ATS allowlist override + pass-through for normal job emails
2. Implement `isDeterministicallyFiltered()`
3. Implement `BLOCKLISTED_DOMAINS` as hardcoded `Set<string>`

---

## Phase 3: Haiku Triage

**New file:** `server/services/classification/triage.ts`
**New test:** `__tests__/services/classification/triage.test.ts`

### Types & function signature:
```typescript
export type TriageResult = "YES" | "NO" | "UNCERTAIN";

export interface TriageOutput {
  messageId: string;
  result: TriageResult;
}

export async function haikuTriage(emails: EmailRaw[]): Promise<TriageOutput[]>
```

### Behavior:
- Model: `claude-haiku-4-5-20251001`
- Input per email: `messageId`, `subject`, `from` (sender), `snippet` (~200 chars)
- Batch size: 20
- On API failure: return all as `UNCERTAIN` (fail-open)
- On malformed JSON: return all as `UNCERTAIN`
- Empty input: return `[]` without API call
- Prompt: triage prompt from cross-cutting section above
- NO status extraction, NO company/role extraction

### Steps:
1. **Test first:** Write tests for YES/NO/UNCERTAIN responses, batching, API failure fallback, empty input, malformed JSON
2. Implement `haikuTriage()`

---

## Phase 4: Sonnet Classification

**New file:** `server/services/classification/classify.ts`
**New test:** `__tests__/services/classification/classify.test.ts`

### Types & function signature:
```typescript
export interface SonnetInput {
  messageId: string;
  subject: string;
  sender: string;
  body: string;          // full body, truncated to 2000 chars
  date: Date;
  companyHint: string | null;
}

export async function sonnetClassify(
  emails: SonnetInput[]
): Promise<ClassificationResult[]>
```

### Behavior:
- Model: `claude-sonnet-4-6`
- Each email gets its own API call (NOT batched in a single prompt)
- Concurrency: max 5 parallel calls via semaphore + `Promise.allSettled`
- Body: preprocessed via `preprocessText(subject, body, "sonnet")` -- PII stripped, truncated to 2000 chars
- On individual API failure: return `{ status: "NEEDS_REVIEW", confidence: 0 }` for that email
- Apply `postProcess()` from sanitize.ts to each result
- Prompt: classification prompt from cross-cutting section above
- Exponential backoff: 3 retries on 429/529

### Steps:
1. **Test first:** Write tests for successful extraction, confidence scores, API failure per email, concurrency limiting, postProcess application, malformed JSON handling
2. Add `"sonnet"` mode to `preprocessText()` in `classification.service.ts` (2000 char truncation)
3. Implement concurrency limiter (simple semaphore)
4. Implement `sonnetClassify()`

---

## Phase 5: Pipeline Orchestration

**File:** `server/services/classification.service.ts` (rewrite)
**Test:** `__tests__/services/classification.test.ts` (rewrite)

### New main export:
```typescript
export interface PipelineResult {
  results: ClassificationResult[];
  stats: PipelineStats;
}

export interface PipelineStats {
  filteredCount: number;
  haikuCallCount: number;
  triageYesCount: number;
  triageNoCount: number;
  triageUncertainCount: number;
  sonnetCallCount: number;
  autoCommitCount: number;
  reviewFlagCount: number;
  manualQueueCount: number;
}

export async function classifyPipeline(
  emails: EmailRaw[],
  gmailClient: OAuth2Client
): Promise<PipelineResult>
```

### Pipeline steps:
1. `deterministicFilter()` -- drop structural noise, count `filteredCount`
2. `haikuTriage()` -- drop NO, keep YES + UNCERTAIN, count triage results
3. `fetchFullEmail()` for YES + UNCERTAIN emails
4. `preprocessText(subject, body, "sonnet")` for each
5. `sonnetClassify()` with prepared inputs
6. `applyConfidenceRouting()` on each result:
   - `confidence > 0.9` -- keep Sonnet's status (autoCommitCount++)
   - `0.7 <= confidence <= 0.9` -- keep Sonnet's status (reviewFlagCount++)
   - `confidence < 0.7` -- force `NEEDS_REVIEW` (manualQueueCount++)
7. Return results + stats

### Sonnet batch failure fallback:
If all Sonnet calls fail (e.g., auth error), re-run through Haiku with full extraction prompt. Cap confidence at 0.6 so all results go to review.

### What stays:
- `preprocessText()` -- add `"sonnet"` mode (2000 chars), keep existing modes
- Re-exports: `normalizeRoleTitle`, `roleTitlesSimilar` (used by sync dedup)
- `ClassificationResult` type

### What's removed:
- `classifyWithAI()`, `classifyStage1()`, `classifyStage2Plus()`, `classifyBatch()`
- All re-exports from `regex.ts`

### Steps:
1. **Test first:** Write tests for full pipeline flow, confidence routing, Sonnet fallback to Haiku, stats tracking, empty input
2. Add `"sonnet"` mode to `preprocessText()`
3. Implement `applyConfidenceRouting()`
4. Implement `classifyPipeline()`

---

## Phase 6: Sync Service Integration

**File:** `server/services/sync.service.ts`
**Test:** `__tests__/services/sync.test.ts`

### Changes:
Replace imports:
```typescript
// Before:
import { classifyStage1, classifyStage2Plus, roleTitlesSimilar, type ClassificationResult }
  from "@/server/services/classification.service";

// After:
import { classifyPipeline, roleTitlesSimilar, type ClassificationResult }
  from "@/server/services/classification.service";
```

Replace two-step classification (current lines 252-265):
```typescript
// Before:
const { classified: stage1Results, unclassified } = classifyStage1(emails);
for (const result of stage1Results) { /* upsert */ }
const stage2Results = await classifyStage2Plus(unclassified, gmailClient);
for (const result of stage2Results) { /* upsert */ }

// After:
const { results, stats } = await classifyPipeline(emails, gmailClient);
for (const result of results) {
  const r = await upsertResult(userId, result);
  if (r === "created") synced++;
  else if (r === "updated") updated++;
}
```

Update SyncState upsert to include all stats from `PipelineStats`.

### Unchanged:
- `upsertResult()` -- exact same logic (tier matching, status priority, terminal protection)
- `STATUS_PRIORITY`, `TERMINAL_STATUSES`
- GHOSTED sweep (30-day check)
- Cooldown logic (15 min)
- `SyncResult` return type

### Steps:
1. **Test first:** Update mocks from `classifyStage1`/`classifyStage2Plus` to `classifyPipeline`. Verify stats are written to SyncState.
2. Update imports and classification call
3. Wire stats into SyncState upsert

---

## Phase 7: Cleanup

**Commit:** `refactor(classification): remove legacy regex classification`

### Delete from `server/services/classification/regex.ts`:
- `classifyWithRegex()` and `REGEX_PATTERNS`
- `extractCompanyAndRole()` and all subject parsing patterns
- `isValidExtraction()`
- `classifyStage1()`
- `isNonJobEmail()` and `NON_JOB_SUBJECT_PATTERNS`
- `extractLocation()` and `LOCATION_PATTERNS`

### Keep (move to `sanitize.ts`):
- `ATS_BRAND_NAMES` -- still used by `isArtifactRoleTitle()` and `sanitizeResult()`

### Delete/rewrite tests:
- `__tests__/services/classification/regex.test.ts` -- delete entirely or keep minimal tests for `ATS_BRAND_NAMES` if it stays in a shared location

### Remove dead exports from `classification.service.ts`:
- `classifyWithRegex`, `extractCompanyAndRole`, `classifyStage1`, `classifyBatch`, `classifyWithAI`, `classifyStage2Plus`

---

## What Survives From Current Code

| File | Kept | Removed |
|------|------|---------|
| `sanitize.ts` | All: `sanitizeResult`, `postProcess`, `normalizeRoleTitle`, `roleTitlesSimilar`, `isLikelyRoleTitle`, `isArtifactRoleTitle`, `rescueRole` + receives `ATS_BRAND_NAMES` | Nothing |
| `regex.ts` | `ATS_BRAND_NAMES` (moved to sanitize.ts) | Everything else |
| `gmail.service.ts` | Everything + new fields (`listUnsubscribe`, `labelIds`) + export `ATS_DOMAINS` | Nothing |
| `sync.service.ts` | `upsertResult`, ghosted sweep, cooldown, status priority | Old classification imports |
| `classification.service.ts` | `preprocessText` (+ new sonnet mode), sanitize re-exports, `ClassificationResult` type | All stage/batch/AI functions |

---

## File Map (after completion)

```
server/services/
  gmail.service.ts              -- Gmail API client (+ List-Unsubscribe, labelIds)
  classification.service.ts     -- classifyPipeline() orchestrator + preprocessText()
  classification/
    filter.ts                   -- NEW: isDeterministicallyFiltered()
    triage.ts                   -- NEW: haikuTriage()
    classify.ts                 -- NEW: sonnetClassify()
    sanitize.ts                 -- EXISTING: post-processing utilities
    regex.ts                    -- DELETED (ATS_BRAND_NAMES moved to sanitize.ts)
  sync.service.ts               -- orchestrator (calls classifyPipeline)

__tests__/services/
  classification.test.ts        -- REWRITTEN: pipeline integration tests
  classification/
    filter.test.ts              -- NEW
    triage.test.ts              -- NEW
    classify.test.ts            -- NEW
    sanitize.test.ts            -- EXISTING (unchanged)
    regex.test.ts               -- DELETED
```

---

## Verification Checklist

### Unit tests (per module)
- [ ] `filter.test.ts` -- unsubscribe header, blocklist, promo/social labels, ATS allowlist
- [ ] `triage.test.ts` -- YES/NO/UNCERTAIN, batching, API failure, empty input
- [ ] `classify.test.ts` -- extraction, confidence, concurrency, API failure, postProcess
- [ ] `classification.test.ts` -- full pipeline flow, confidence routing, fallbacks, stats

### Resilience tests
- [ ] Sonnet failure per email -> NEEDS_REVIEW
- [ ] Sonnet batch failure -> Haiku fallback (confidence capped 0.6)
- [ ] Haiku failure -> all UNCERTAIN -> flow to Sonnet
- [ ] Both APIs down -> all NEEDS_REVIEW
- [ ] fetchFullEmail failure -> individual NEEDS_REVIEW, batch continues

### Integration
- [ ] `sync.test.ts` -- classifyPipeline mock, stats in SyncState

### Manual verification
- [ ] `npm run dev` + trigger sync
- [ ] Promotional emails filtered before AI
- [ ] Haiku drops non-job emails
- [ ] Sonnet extracts company/role/status with confidence
- [ ] High-confidence (>0.9) auto-committed
- [ ] Low-confidence (<0.7) shows as NEEDS_REVIEW
- [ ] Observability counters populated in SyncState
- [ ] Existing behavior unchanged: cooldown, ghosted sweep, dedup, status priority
