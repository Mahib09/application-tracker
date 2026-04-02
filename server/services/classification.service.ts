import Anthropic from "@anthropic-ai/sdk"
import type { OAuth2Client } from "google-auth-library"
import { fetchFullEmail, type EmailRaw } from "@/server/services/gmail.service"
import { sanitizeResult, postProcess } from "@/server/services/classification/sanitize"
import { classifyStage1, extractCompanyAndRole } from "@/server/services/classification/regex"

export interface EmailInput {
  messageId: string
  subject: string
  text: string
  date: Date
  companyHint: string | null
  isATS: boolean
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

// ─── Stage 2: AI classification ───────────────────────────────────────────────

const BATCH_SIZE = 20

export async function classifyWithAI(emails: EmailInput[]): Promise<ClassificationResult[]> {
  if (emails.length === 0) return []
  const anthropic = new Anthropic()

  const results: ClassificationResult[] = []

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE)
    const dateMap = new Map(batch.map((e) => [e.messageId, e.date]))
    const emailMap = new Map(batch.map((e) => [e.messageId, e]))

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
- senderHint (if present): the likely company name extracted from the email sender — use as a strong hint but verify it appears consistent with the email content before using it as the company value.
- Return a JSON array only, no other text.

BAD examples (never do this):
  {"messageId":"id1","company":"Stripe","roleTitle":"Application Confirmation","status":"APPLIED"} — WRONG: "Application Confirmation" is not a job title
  {"messageId":"id2","company":"Junior Developer","roleTitle":null,"status":"APPLIED"} — WRONG: "Junior Developer" is a job title, not a company

GOOD examples:
  {"messageId":"id1","company":"Stripe","roleTitle":null,"status":"APPLIED"}
  {"messageId":"id2","company":null,"roleTitle":"Junior Developer","status":"APPLIED"}

Emails:
${JSON.stringify(batch.map((e) => ({
  messageId: e.messageId,
  subject: e.subject,
  text: e.text,
  ...(e.companyHint ? { senderHint: e.companyHint } : {}),
})))}
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
      const inputEmail = emailMap.get(item.messageId) ?? { messageId: item.messageId, subject: "", text: "", date: new Date(), companyHint: null, isATS: false }
      results.push(postProcess({
        messageId: item.messageId,
        company: item.company ?? "",
        roleTitle: item.roleTitle ?? "",
        status: item.status,
        location: item.location ?? null,
        date: dateMap.get(item.messageId) ?? new Date(),
      }, inputEmail))
    }
  }

  return results
}

// ─── Stage 1: Regex (synchronous, no external deps) ─────────────────────────

export { classifyStage1, classifyWithRegex, extractCompanyAndRole } from "@/server/services/classification/regex"

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
      return [sanitizeResult({
        messageId: e.messageId,
        company: extracted.company,
        roleTitle: extracted.roleTitle,
        location: extracted.location ?? null,
        status: "NEEDS_REVIEW",
        date: e.date,
      })]
    })
  }

  const resolved: ClassificationResult[] = []
  const stage3Queue: Array<{ input: EmailInput; partial: ClassificationResult }> = []

  for (const res of stage2Results) {
    const original = emails.find((e) => e.messageId === res.messageId)

    // Both empty from snippet: only try Stage 3 if there's a sender hint or ATS origin
    // (emails with no hint and no company/role are truly non-job emails — discard)
    if (!res.company && !res.roleTitle) {
      if (original && (original.companyHint || original.isATS)) {
        stage3Queue.push({
          input: original,
          partial: { ...res, company: original.companyHint ?? "" },
        })
      }
      continue
    }

    // Selective Stage 3: fetch full body if either company or role is still missing
    if (!res.company || !res.roleTitle) {
      stage3Queue.push({ input: original!, partial: res })
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
        isATS:       false,
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
    resolved.push(postProcess({
      messageId: input.messageId,
      company: stage3Result.company || partial.company || "",
      roleTitle: stage3Result.roleTitle || partial.roleTitle || "",
      status: stage3Result.status,
      location: stage3Result.location ?? partial.location ?? null,
      date: input.date,
    }, input))
  }

  return resolved
}

// ─── Re-exports for backward compatibility ────────────────────────────────────

export {
  sanitizeResult,
  isLikelyRoleTitle,
  normalizeRoleTitle,
  roleTitlesSimilar,
} from "@/server/services/classification/sanitize"

// ─── Convenience wrapper (kept for backward compatibility) ────────────────────

export async function classifyBatch(
  emails: EmailRaw[],
  gmailClient: OAuth2Client
): Promise<ClassificationResult[]> {
  const { classified, unclassified } = classifyStage1(emails)
  const stage2Results = await classifyStage2Plus(unclassified, gmailClient)
  return [...classified, ...stage2Results]
}
