import Anthropic from "@anthropic-ai/sdk"
import type { ClassificationResult } from "@/server/services/classification.service"
import { postProcess } from "@/server/services/classification/sanitize"

export interface SonnetInput {
  messageId: string
  subject: string
  sender: string
  body: string          // preprocessed, truncated to 2000 chars
  date: Date
  companyHint: string | null
}

// ─── Semaphore ───────────────────────────────────────────────────────────────

class Semaphore {
  private count: number
  private queue: (() => void)[] = []

  constructor(limit: number) {
    this.count = limit
  }

  acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--
      return Promise.resolve()
    }
    return new Promise((resolve) => this.queue.push(resolve))
  }

  release(): void {
    const next = this.queue.shift()
    if (next) {
      next()
    } else {
      this.count++
    }
  }
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(email: SonnetInput): string {
  return `Extract job application data from this email. Return a JSON object:

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

Sender hint: ${email.companyHint ?? "none"}
Subject: ${email.subject}
From: ${email.sender}
Body:
${email.body}`
}

// ─── Single email classification ─────────────────────────────────────────────

async function classifySingle(
  anthropic: Anthropic,
  email: SonnetInput
): Promise<ClassificationResult> {
  const fallback: ClassificationResult = {
    messageId: email.messageId,
    company: "",
    roleTitle: "",
    status: "NEEDS_REVIEW",
    location: null,
    date: email.date,
    confidence: 0,
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: buildPrompt(email) }],
    })

    const text = response.content.find((c) => c.type === "text")?.text ?? ""
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return fallback

    const parsed = JSON.parse(match[0]) as {
      company: string | null
      roleTitle: string | null
      status: string
      location: string | null
      confidence: number
    }

    return postProcess(
      {
        messageId: email.messageId,
        company: parsed.company ?? "",
        roleTitle: parsed.roleTitle ?? "",
        status: parsed.status,
        location: parsed.location ?? null,
        date: email.date,
        confidence: parsed.confidence,
      },
      { companyHint: email.companyHint }
    )
  } catch {
    return fallback
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function sonnetClassify(
  emails: SonnetInput[]
): Promise<ClassificationResult[]> {
  if (emails.length === 0) return []

  const anthropic = new Anthropic()
  const sem = new Semaphore(5)

  const classifyWithSem = async (email: SonnetInput): Promise<ClassificationResult> => {
    await sem.acquire()
    try {
      return await classifySingle(anthropic, email)
    } finally {
      sem.release()
    }
  }

  const settled = await Promise.allSettled(emails.map(classifyWithSem))

  return settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          messageId: emails[i].messageId,
          company: "",
          roleTitle: "",
          status: "NEEDS_REVIEW" as const,
          location: null,
          date: emails[i].date,
          confidence: 0,
        }
  )
}
