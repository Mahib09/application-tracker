import Anthropic from "@anthropic-ai/sdk"
import type { OAuth2Client } from "google-auth-library"
import { fetchFullEmail, type EmailRaw } from "@/server/services/gmail.service"

export interface EmailInput {
  messageId: string
  subject: string
  text: string
  date: Date
}

export interface ClassificationResult {
  messageId: string
  company: string
  roleTitle: string
  status: string
  location: string | null
  date: Date
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
  if (m) return { company: m[1].trim(), roleTitle: "Unknown Role", location: null }

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
  if (m) return { company: m[1].trim(), roleTitle: "Unknown Role", location: null }

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
      if (m) return { company: m[1].trim(), roleTitle: "Unknown Role", location: null }

      // "Application to/for Company"
      m = s.match(/application (?:to|for)\s+(.+)/i)
      if (m) return { company: m[1].trim(), roleTitle: "Unknown Role", location: null }

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
        messageId: email.messageId,
        subject: email.subject,
        text: email.snippet,
        date: email.date,
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
        messageId: input.messageId,
        subject: input.subject,
        text: preprocessText(input.subject, bodyText, "body"),
        date: input.date,
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

// ─── Convenience wrapper (kept for backward compatibility) ────────────────────

export async function classifyBatch(
  emails: EmailRaw[],
  gmailClient: OAuth2Client
): Promise<ClassificationResult[]> {
  const { classified, unclassified } = classifyStage1(emails)
  const stage2Results = await classifyStage2Plus(unclassified, gmailClient)
  return [...classified, ...stage2Results]
}
