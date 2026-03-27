import Anthropic from "@anthropic-ai/sdk"
import type { OAuth2Client } from "google-auth-library"
import { fetchFullEmail, type EmailRaw } from "@/server/services/gmail.service"

export interface EmailInput {
  messageId: string
  subject: string
  text: string
  date: Date
  companyHint: string | null
}

export interface ClassificationResult {
  messageId: string
  company: string
  roleTitle: string
  status: string
  location: string | null
  date: Date
  confidence?: number
}

// ─── Text preprocessing ──────────────────────────────────────────────────────

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

// ─── Location extraction ──────────────────────────────────────────────────────

const LOCATION_PATTERNS: RegExp[] = [
  // Work type in brackets/parens: (Remote), [Hybrid], (Remote/Hybrid)
  /\s*[\(\[](remote|hybrid|on-?site|in-?person|flexible)[^\)\]]*[\)\]]/gi,
  // Work type standalone at end after separator: "- Remote", "| Hybrid", ", Remote"
  /\s*[-|,]\s*(remote|hybrid|on-?site|in-?person|flexible)\s*$/gi,
  // City/country at end: "- New York, NY", "| London, UK", "(Austin, TX)"
  /\s*[\(\[,|\-]\s*[A-Z][a-zA-Z\s]{2,},\s*[A-Z]{2,3}[\)\]]?\s*$/g,
]

function extractLocation(str: string): { clean: string; location: string | null } {
  let location: string | null = null
  let clean = str

  for (const pattern of LOCATION_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0
    const match = clean.match(pattern)
    if (match) {
      location = match[0].replace(/^[\s\(\[,|\-]+|[\)\]]+$/g, "").trim()
      clean = clean.replace(pattern, "").trim()
      break
    }
  }

  return { clean, location }
}

// ─── Company and role extraction ─────────────────────────────────────────────

export function extractCompanyAndRole(
  subject: string
): { company: string; roleTitle: string; location: string | null } | null {
  // Strip Re:/Fwd: prefixes before any pattern matching
  const s = subject.replace(/^(re|fwd?):\s*/i, "").trim()

  let roleRaw: string
  let companyRaw: string
  let m: RegExpMatchArray | null

  // "interview for <Role> at <Company>" — most specific first
  m = s.match(/interview for\s+(.+?)\s+at\s+(.+)/i)
  if (m) {
    roleRaw = m[1].trim()
    companyRaw = m[2].trim()
    const roleExtracted = extractLocation(roleRaw)
    const companyExtracted = extractLocation(companyRaw)
    const location = roleExtracted.location ?? companyExtracted.location
    return { company: companyExtracted.clean, roleTitle: roleExtracted.clean, location }
  }

  // "for the <Role> [role|position] at <Company>"
  m = s.match(/for the\s+(.+?)\s+(?:role\s+|position\s+)?at\s+(.+)/i)
  if (m) {
    roleRaw = m[1].trim()
    companyRaw = m[2].trim()
    const roleExtracted = extractLocation(roleRaw)
    const companyExtracted = extractLocation(companyRaw)
    const location = roleExtracted.location ?? companyExtracted.location
    return { company: companyExtracted.clean, roleTitle: roleExtracted.clean, location }
  }

  // "thank you for applying to <Company>"
  m = s.match(/thank you for applying to\s+(.+)/i)
  if (m) return { company: m[1].trim(), roleTitle: "", location: null }

  // "<Company> — <Role>" (em dash)
  m = s.match(/^(.+?)\s*—\s*(.+)$/)
  if (m) {
    companyRaw = m[1].trim()
    roleRaw = m[2].trim()
    const roleExtracted = extractLocation(roleRaw)
    const companyExtracted = extractLocation(companyRaw)
    const location = roleExtracted.location ?? companyExtracted.location
    return { company: companyExtracted.clean, roleTitle: roleExtracted.clean, location }
  }

  // "<Company> has received your"
  m = s.match(/^(.+?)\s+has received your/i)
  if (m) return { company: m[1].trim(), roleTitle: "", location: null }

  // "Role at Company"
  m = s.match(/^(.+?)\s+at\s+(.+)$/i)
  if (m) {
    roleRaw = m[1].trim()
    companyRaw = m[2].trim()
  } else {
    // "Company - Role" or "Company: Role"
    m = s.match(/^(.+?)\s*[-:]\s*(.+)$/)
    if (m) {
      const candidateRole = m[2].trim()
      // Guard: if the role portion is more than 6 words it's a sentence, not a title
      if (candidateRole.split(/\s+/).length > 6) return null
      companyRaw = m[1].trim()
      roleRaw = candidateRole
    } else {
      // "Your application to/for Company"
      m = s.match(/your application (?:to|for)\s+(.+)/i)
      if (m) return { company: m[1].trim(), roleTitle: "", location: null }

      // "Application to/for Company"
      m = s.match(/application (?:to|for)\s+(.+)/i)
      if (m) return { company: m[1].trim(), roleTitle: "", location: null }

      return null
    }
  }

  // Strip location from role first, then company
  const roleExtracted = extractLocation(roleRaw)
  const companyExtracted = extractLocation(companyRaw)
  const location = roleExtracted.location ?? companyExtracted.location

  return {
    company: companyExtracted.clean,
    roleTitle: roleExtracted.clean,
    location,
  }
}

// ─── Stage 1: Regex classification ──────────────────────────────────────────

const PATTERNS: Array<{ status: string; pattern: RegExp }> = [
  {
    status: "OFFER",
    pattern:
      /offer letter|pleased to offer|extend.*offer|congratulations.*offer|accepted.*position|we.*like to offer|we would like to offer|formal offer|offer of employment/i,
  },
  {
    status: "INTERVIEW",
    pattern:
      /\binterview\b|virtual meeting|schedule.*call|phone screen|technical assessment|hiring manager|would like to invite you|next steps in the interview|moving you forward|next round|schedule.*interview|invitation to interview/i,
  },
  {
    status: "REJECTED",
    pattern:
      /not.*moving forward|not selected|decided to move|other candidates|position.*filled|unfortunately.*not|we regret|will not be moving forward|no longer considering|after careful consideration|decided not to move|position has been filled/i,
  },
  {
    status: "APPLIED",
    pattern:
      /application received|thank you for applying|we.*received.*application|application.*submitted|received your application|application confirmation|thank you for your application|we have received your|application is under review|successfully submitted/i,
  },
]

export function classifyWithRegex(subject: string, snippet: string): string | null {
  const combined = `${subject} ${snippet}`
  for (const { status, pattern } of PATTERNS) {
    if (pattern.test(combined)) return status
  }
  return null
}

// ─── Stage 2: AI classification ───────────────────────────────────────────────

const BATCH_SIZE = 20

export async function classifyWithAI(emails: EmailInput[]): Promise<ClassificationResult[]> {
  if (emails.length === 0) return []
  const anthropic = new Anthropic()

  const results: ClassificationResult[] = []

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE)
    const dateMap = new Map(batch.map((e) => [e.messageId, e.date]))

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

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content.find((c) => c.type === "text")?.text ?? "[]"

    let parsed: Array<{ messageId: string; company: string | null; roleTitle: string | null; status: string; location?: string | null }> =
      []
    try {
      // Extract JSON array from response (may have surrounding text)
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error("No JSON array found in AI response")
      parsed = JSON.parse(jsonMatch[0])
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
  }

  return results
}

// ─── Stage 1: Regex (synchronous, no external deps) ─────────────────────────

/** Classifies emails using regex only. Returns classified results immediately
 *  and the emails that need AI (Stage 2+). */
export function classifyStage1(emails: EmailRaw[]): {
  classified: ClassificationResult[]
  unclassified: EmailInput[]
} {
  const classified: ClassificationResult[] = []
  const unclassified: EmailInput[] = []

  for (const email of emails) {
    const status = classifyWithRegex(email.subject, email.snippet)
    const extracted = extractCompanyAndRole(email.subject)

    if (status && extracted) {
      classified.push({ ...extracted, messageId: email.messageId, status, date: email.date })
    } else {
      unclassified.push({
        messageId:   email.messageId,
        subject:     email.subject,
        text:        email.snippet,
        date:        email.date,
        companyHint: null,
      })
    }
  }

  return { classified, unclassified }
}

// ─── Stage 2+3: AI (gracefully degrades on AI failure) ───────────────────────

/** Runs Stage 2 (AI on snippet) for emails that Stage 1 could not classify.
 *  If Stage 2 resolves only one of company/role, Stage 3 fetches the full body
 *  and runs AI again. Falls back to NEEDS_REVIEW with partial data if still
 *  unresolved. Non-job emails identified from body are discarded. */
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
        messageId:   input.messageId,
        subject:     input.subject,
        text:        preprocessText("", bodyText, "body"),
        date:        input.date,
        companyHint: null,
      })
    } catch {
      // If body fetch fails, keep partial Stage 2 result as NEEDS_REVIEW
      const queueEntry = stage3Queue.find((q) => q.input.messageId === input.messageId)!
      resolved.push({ ...queueEntry.partial, status: "NEEDS_REVIEW" })
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

// ─── Output sanitization ─────────────────────────────────────────────────────

export function isLikelyRoleTitle(str: string): boolean {
  if (str.trim().split(/\s+/).length > 4) return true
  if (/\([^)]+\)\s*$/.test(str)) return true
  if (/\b(developer|engineer|designer|analyst|manager|coordinator|specialist|consultant|architect|administrator|director)\b\s*(\([^)]+\))?\s*$/i.test(str)) return true
  return false
}

const ARTIFACT_ROLE_PATTERNS: RegExp[] = [
  /^application\s+(confirmation|update|received|status|viewed|submitted|acknowledgement)$/i,
  /^your\s+application$/i,
  /^thank\s+you\s+for\s+(applying|your\s+application)$/i,
]

function isArtifactRoleTitle(roleTitle: string): boolean {
  return ARTIFACT_ROLE_PATTERNS.some((p) => p.test(roleTitle.trim()))
}

/** Cleans up company and roleTitle fields before persisting. */
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

// ─── Convenience wrapper (kept for backward compatibility) ────────────────────

export async function classifyBatch(
  emails: EmailRaw[],
  gmailClient: OAuth2Client
): Promise<ClassificationResult[]> {
  const { classified, unclassified } = classifyStage1(emails)
  const stage2Results = await classifyStage2Plus(unclassified, gmailClient)
  return [...classified, ...stage2Results]
}
