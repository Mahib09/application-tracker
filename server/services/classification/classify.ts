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

// ─── Tool schema ────��───────────────────────────────────────────────────────

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_applications",
  description: "Extract job application data from one or more emails. Return one result per email.",
  input_schema: {
    type: "object" as const,
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            messageId: { type: "string", description: "The email messageId from the input" },
            company: { type: ["string", "null"], description: "Hiring company name (NOT the ATS platform)" },
            roleTitle: { type: ["string", "null"], description: "Concise job title only" },
            status: { type: "string", enum: ["APPLIED", "INTERVIEW", "OFFER", "REJECTED"] },
            location: { type: ["string", "null"], description: "City/state, Remote, Hybrid, or null" },
            confidence: { type: "number", description: "0.0-1.0 confidence across all fields" },
          },
          required: ["messageId", "company", "roleTitle", "status", "location", "confidence"],
        },
      },
    },
    required: ["results"],
  },
}

// ─── Prompt ─���───────────────────────────────────────────────────────────────

function buildBatchPrompt(emails: SonnetInput[]): string {
  const emailBlocks = emails.map((e, i) => `--- EMAIL ${i + 1} [${e.messageId}] ---
Sender hint: ${e.companyHint ?? "none"}
Subject: ${e.subject}
From: ${e.sender}
Body:
${e.body}`).join("\n\n")

  return `Extract job application data from each email below. For each email, identify:
- company: the hiring company, NOT the ATS platform (Greenhouse, Lever, etc.)
- roleTitle: concise job title only, not a sentence or status phrase
- status: based on email content (APPLIED, INTERVIEW, OFFER, REJECTED)
- location: city/state, Remote, Hybrid, or null
- confidence: 0.0-1.0 for how certain you are about ALL extracted fields
  - 1.0 = unambiguous, all fields clearly present
  - 0.7-0.9 = mostly clear, one field uncertain
  - <0.7 = significant ambiguity

Return null for fields you cannot determine. Do not guess.
Return one result per email, preserving the messageId.

${emailBlocks}`
}

// ─── Batch classification ───────────────────────────────────────────────────

const BATCH_SIZE = 10

async function classifyBatch(
  anthropic: Anthropic,
  emails: SonnetInput[]
): Promise<ClassificationResult[]> {
  const fallback = (): ClassificationResult[] =>
    emails.map((e) => ({
      messageId: e.messageId,
      company: "",
      roleTitle: "",
      status: "NEEDS_REVIEW",
      location: null,
      date: e.date,
      confidence: 0,
    }))

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "extract_applications" },
      messages: [{ role: "user", content: buildBatchPrompt(emails) }],
    })

    // Extract tool use result
    const toolBlock = response.content.find((c) => c.type === "tool_use")
    if (!toolBlock || toolBlock.type !== "tool_use") return fallback()

    const input = toolBlock.input as { results: Array<{
      messageId: string
      company: string | null
      roleTitle: string | null
      status: string
      location: string | null
      confidence: number
    }> }

    if (!Array.isArray(input.results)) return fallback()

    // Map results back to emails by messageId
    const resultMap = new Map(input.results.map((r) => [r.messageId, r]))
    const emailMap = new Map(emails.map((e) => [e.messageId, e]))

    return emails.map((email) => {
      const parsed = resultMap.get(email.messageId)
      if (!parsed) {
        return {
          messageId: email.messageId,
          company: "",
          roleTitle: "",
          status: "NEEDS_REVIEW",
          location: null,
          date: email.date,
          confidence: 0,
        }
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
    })
  } catch {
    return fallback()
  }
}

// ��── Main export ────────���───────────────────────────────────────────────────

export async function sonnetClassify(
  emails: SonnetInput[]
): Promise<ClassificationResult[]> {
  if (emails.length === 0) return []

  const anthropic = new Anthropic()

  // Chunk into batches of BATCH_SIZE
  const batches: SonnetInput[][] = []
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    batches.push(emails.slice(i, i + BATCH_SIZE))
  }

  // Fire all batches in parallel
  const settled = await Promise.allSettled(
    batches.map((batch) => classifyBatch(anthropic, batch))
  )

  // Collect results — failed batches get NEEDS_REVIEW for all emails
  const results: ClassificationResult[] = []
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i]
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value)
    } else {
      // Entire batch failed at Promise level
      results.push(
        ...batches[i].map((e) => ({
          messageId: e.messageId,
          company: "",
          roleTitle: "",
          status: "NEEDS_REVIEW" as const,
          location: null,
          date: e.date,
          confidence: 0,
        }))
      )
    }
  }

  return results
}
