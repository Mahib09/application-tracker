import Anthropic from "@anthropic-ai/sdk"
import type { OAuth2Client } from "google-auth-library"
import type { EmailRaw } from "@/server/services/gmail.service"

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
      companyRaw = m[1].trim()
      roleRaw = m[2].trim()
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

    const prompt = `You are classifying job application emails. For each email, extract:
- company: the company name (no location, just the name)
- roleTitle: the job title only (no location, use "Unknown Role" if unclear)
- status: one of APPLIED | INTERVIEW | OFFER | REJECTED | GHOSTED | NEEDS_REVIEW
- location: city/state, country, "Remote", "Hybrid", or null if unknown

Return a JSON array only, no other text. Example:
[{"messageId":"id1","company":"Acme","roleTitle":"Engineer","status":"APPLIED","location":"Remote"}]

If an email is clearly NOT a job application (e.g. newsletter, promotional, personal message unrelated to jobs),
omit it from the response array entirely — do not return an entry for it.

Emails:
${JSON.stringify(batch.map((e) => ({ messageId: e.messageId, subject: e.subject, text: e.text })))}
`

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content.find((c) => c.type === "text")?.text ?? "[]"

    let parsed: Array<{ messageId: string; company: string; roleTitle: string; status: string; location?: string | null }> =
      []
    try {
      // Extract JSON array from response (may have surrounding text)
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    } catch {
      // If parse fails, all in batch remain unclassified (NEEDS_REVIEW)
      parsed = batch.map((e) => ({
        messageId: e.messageId,
        company: "Unknown",
        roleTitle: "Unknown Role",
        status: "NEEDS_REVIEW",
        location: null,
      }))
    }

    for (const item of parsed) {
      results.push({
        messageId: item.messageId,
        company: item.company,
        roleTitle: item.roleTitle,
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

// ─── Stage 2: AI (gracefully degrades on AI failure) ─────────────────────────

/** Runs Stage 2 (AI on snippet) for emails that Stage 1 could not classify.
 *  Non-job emails omitted by AI are discarded. Falls back to subject extraction
 *  if AI is unavailable, discarding emails that cannot be identified at all. */
export async function classifyStage2Plus(
  emails: EmailInput[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gmailClient: OAuth2Client
): Promise<ClassificationResult[]> {
  if (emails.length === 0) return []

  // Stage 2: AI on snippet
  let stage2Results: ClassificationResult[]
  try {
    stage2Results = await classifyWithAI(emails)
  } catch {
    // AI unavailable — best-effort extraction, discard if nothing extractable
    return emails.flatMap((e) => {
      const extracted = extractCompanyAndRole(e.subject)
      if (!extracted) return [] // discard — cannot identify this email
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

  const results: ClassificationResult[] = []

  for (const res of stage2Results) {
    // Discard if AI returned an entry with no company AND no roleTitle
    if (!res.company && !res.roleTitle) continue
    // Otherwise include as-is (partial data with NEEDS_REVIEW is fine)
    results.push(res)
  }

  return results
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
