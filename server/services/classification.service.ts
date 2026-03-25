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

export function preprocessText(subject: string, text: string): string {
  let combined = `${subject} ${text}`
  // Strip HTML tags
  combined = combined.replace(/<[^>]+>/g, "")
  // Replace PII
  combined = combined.replace(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi, "[email]")
  combined = combined.replace(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[phone]")
  combined = combined.replace(/https?:\/\/[^\s]+/g, "[url]")
  // Truncate
  return combined.slice(0, 500)
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
  let roleRaw: string
  let companyRaw: string

  // "Role at Company"
  let m = subject.match(/^(.+?)\s+at\s+(.+)$/i)
  if (m) {
    roleRaw = m[1].trim()
    companyRaw = m[2].trim()
  } else {
    // "Company - Role" or "Company: Role"
    m = subject.match(/^(.+?)\s*[-:]\s*(.+)$/)
    if (m) {
      companyRaw = m[1].trim()
      roleRaw = m[2].trim()
    } else {
      // "Your application to/for Company"
      m = subject.match(/your application (?:to|for)\s+(.+)/i)
      if (m) return { company: m[1].trim(), roleTitle: "Unknown Role", location: null }

      // "Application to/for Company"
      m = subject.match(/application (?:to|for)\s+(.+)/i)
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
      /offer letter|pleased to offer|extend.*offer|congratulations.*offer|accepted.*position|we.*like to offer/i,
  },
  {
    status: "INTERVIEW",
    pattern:
      /\binterview\b|virtual meeting|schedule.*call|phone screen|technical assessment|hiring manager/i,
  },
  {
    status: "REJECTED",
    pattern:
      /not.*moving forward|not selected|decided to move|other candidates|position.*filled|unfortunately.*not|we regret/i,
  },
  {
    status: "APPLIED",
    pattern:
      /application received|thank you for applying|we.*received.*application|application.*submitted|received your application/i,
  },
]

export function classifyWithRegex(subject: string, snippet: string): string | null {
  const combined = `${subject} ${snippet}`
  for (const { status, pattern } of PATTERNS) {
    if (pattern.test(combined)) return status
  }
  return null
}

// ─── Stage 2 & 3: AI classification ─────────────────────────────────────────

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

// ─── Stage 2+: AI (gracefully degrades to NEEDS_REVIEW if unavailable) ───────

/** Runs Stage 2 (AI on snippet) and Stage 3 (AI on full body) for emails that
 *  Stage 1 could not classify. Falls back to NEEDS_REVIEW if AI is unavailable. */
export async function classifyStage2Plus(
  emails: EmailInput[],
  gmailClient: OAuth2Client
): Promise<ClassificationResult[]> {
  if (emails.length === 0) return []

  // Stage 2: AI on snippet
  let stage2Results: ClassificationResult[]
  try {
    stage2Results = await classifyWithAI(emails)
  } catch {
    // AI unavailable — mark all as NEEDS_REVIEW with best-effort extraction
    return emails.map((e) => {
      const extracted = extractCompanyAndRole(e.subject)
      return {
        messageId: e.messageId,
        company: extracted?.company ?? "Unknown",
        roleTitle: extracted?.roleTitle ?? "Unknown Role",
        location: extracted?.location ?? null,
        status: "NEEDS_REVIEW",
        date: e.date,
      }
    })
  }

  const results: ClassificationResult[] = []
  const stage3Queue: Array<{ email: EmailInput; partial: ClassificationResult }> = []

  for (const res of stage2Results) {
    if (res.status === "NEEDS_REVIEW" || !res.company || !res.roleTitle) {
      const original = emails.find((e) => e.messageId === res.messageId)!
      stage3Queue.push({ email: original, partial: res })
    } else {
      results.push(res)
    }
  }

  if (stage3Queue.length === 0) return results

  // Stage 3: Full body re-fetch + AI
  const stage3Inputs: EmailInput[] = []
  for (const { email } of stage3Queue) {
    const bodyText = await fetchFullEmail(gmailClient, email.messageId)
    stage3Inputs.push({
      messageId: email.messageId,
      subject: email.subject,
      text: preprocessText(email.subject, bodyText),
      date: email.date,
    })
  }

  let stage3Results: ClassificationResult[]
  try {
    stage3Results = await classifyWithAI(stage3Inputs)
  } catch {
    stage3Results = stage3Queue.map(({ email, partial }) => {
      const extracted = extractCompanyAndRole(email.subject)
      return {
        messageId: email.messageId,
        company: partial.company || extracted?.company || "Unknown",
        roleTitle: partial.roleTitle || extracted?.roleTitle || "Unknown Role",
        location: partial.location ?? extracted?.location ?? null,
        status: "NEEDS_REVIEW",
        date: email.date,
      }
    })
  }

  results.push(...stage3Results)
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
