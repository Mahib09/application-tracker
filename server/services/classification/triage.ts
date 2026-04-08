import Anthropic from "@anthropic-ai/sdk"
import type { EmailRaw } from "@/server/services/gmail.service"

export type TriageResult = "YES" | "NO" | "UNCERTAIN"

export interface TriageOutput {
  messageId: string
  result: TriageResult
}

const BATCH_SIZE = 20

const TRIAGE_PROMPT = `You are an email triage system. For each email, determine if it relates to a job application, recruitment process, interview, offer, or rejection.

Return a JSON array: [{ "id": "<messageId>", "result": "YES" | "NO" | "UNCERTAIN" }]

- YES: clearly about a job application or hiring process
- NO: clearly unrelated (newsletters, shipping, billing, social media, infrastructure alerts, password resets, marketing)
- UNCERTAIN: could be job-related but not clear

Emails:
`

export async function haikuTriage(emails: EmailRaw[]): Promise<TriageOutput[]> {
  if (emails.length === 0) return []
  const anthropic = new Anthropic()
  const outputs: TriageOutput[] = []

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE)
    outputs.push(...(await triageBatch(anthropic, batch)))
  }

  return outputs
}

async function triageBatch(
  anthropic: Anthropic,
  emails: EmailRaw[]
): Promise<TriageOutput[]> {
  const failOpen = (): TriageOutput[] =>
    emails.map((e) => ({ messageId: e.messageId, result: "UNCERTAIN" as TriageResult }))

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content:
            TRIAGE_PROMPT +
            JSON.stringify(
              emails.map((e) => ({
                id: e.messageId,
                subject: e.subject,
                sender: e.from,
                preview: e.snippet.slice(0, 200),
              }))
            ),
        },
      ],
    })

    const text = response.content.find((c) => c.type === "text")?.text ?? ""
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return failOpen()

    const parsed: Array<{ id: string; result: TriageResult }> = JSON.parse(match[0])
    return parsed.map((item) => ({ messageId: item.id, result: item.result }))
  } catch {
    return failOpen()
  }
}
