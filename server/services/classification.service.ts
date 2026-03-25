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

// ─── Company and role extraction ─────────────────────────────────────────────

export function extractCompanyAndRole(
  subject: string
): { company: string; roleTitle: string } | null {
  // "Role at Company"
  let m = subject.match(/^(.+?)\s+at\s+(.+)$/i)
  if (m) return { roleTitle: m[1].trim(), company: m[2].trim() }

  // "Company - Role" or "Company: Role"
  m = subject.match(/^(.+?)\s*[-:]\s*(.+)$/)
  if (m) {
    const left = m[1].trim()
    const right = m[2].trim()
    // Heuristic: if right looks more like a role title (shorter, title-cased words)
    // Default: left = company, right = role
    return { company: left, roleTitle: right }
  }

  // "Your application to Company"
  m = subject.match(/your application (?:to|for)\s+(.+)/i)
  if (m) return { company: m[1].trim(), roleTitle: "Unknown Role" }

  // "Application to/for Company"
  m = subject.match(/application (?:to|for)\s+(.+)/i)
  if (m) return { company: m[1].trim(), roleTitle: "Unknown Role" }

  return null
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
- company: the company name
- roleTitle: the job title (use "Unknown Role" if unclear)
- status: one of APPLIED | INTERVIEW | OFFER | REJECTED | GHOSTED | NEEDS_REVIEW

Return a JSON array only, no other text. Example:
[{"messageId":"id1","company":"Acme","roleTitle":"Engineer","status":"APPLIED"}]

Emails:
${JSON.stringify(batch.map((e) => ({ messageId: e.messageId, subject: e.subject, text: e.text })))}
`

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content.find((c) => c.type === "text")?.text ?? "[]"

    let parsed: Array<{ messageId: string; company: string; roleTitle: string; status: string }> =
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
      }))
    }

    for (const item of parsed) {
      results.push({
        messageId: item.messageId,
        company: item.company,
        roleTitle: item.roleTitle,
        status: item.status,
        date: dateMap.get(item.messageId) ?? new Date(),
      })
    }
  }

  return results
}

// ─── Main pipeline ───────────────────────────────────────────────────────────

export async function classifyBatch(
  emails: EmailRaw[],
  gmailClient: OAuth2Client
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = []
  const stage2Queue: EmailInput[] = []

  // Stage 1: Regex
  for (const email of emails) {
    const status = classifyWithRegex(email.subject, email.snippet)
    const extracted = extractCompanyAndRole(email.subject)

    if (status && extracted) {
      results.push({ ...extracted, messageId: email.messageId, status, date: email.date })
    } else {
      stage2Queue.push({
        messageId: email.messageId,
        subject: email.subject,
        text: email.snippet,
        date: email.date,
      })
    }
  }

  if (stage2Queue.length === 0) return results

  // Stage 2: AI on snippet
  const stage2Results = await classifyWithAI(stage2Queue)
  const stage3Queue: Array<{ email: EmailInput; partial: ClassificationResult }> = []

  for (const res of stage2Results) {
    if (res.status === "NEEDS_REVIEW" || !res.company || !res.roleTitle) {
      const original = stage2Queue.find((e) => e.messageId === res.messageId)!
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

  const stage3Results = await classifyWithAI(stage3Inputs)
  results.push(...stage3Results)

  return results
}
