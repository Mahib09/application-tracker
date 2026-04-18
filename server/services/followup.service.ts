import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/server/lib/prisma"
import { applicationStatus } from "@/app/generated/prisma/enums"

const FOLLOW_UP_THRESHOLD_DAYS = 10
const FOLLOW_UP_COOLDOWN_DAYS = 14

export async function listPendingFollowUps(userId: string, daysThreshold = FOLLOW_UP_THRESHOLD_DAYS) {
  const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000)
  const cooloffCutoff = new Date(Date.now() - FOLLOW_UP_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)

  return prisma.application.findMany({
    where: {
      userId,
      status: applicationStatus.APPLIED,
      appliedAt: { lt: cutoff },
      OR: [
        { lastFollowUpAt: null },
        { lastFollowUpAt: { lt: cooloffCutoff } },
      ],
    },
    orderBy: { appliedAt: "asc" },
  })
}

export async function draftFollowUp(userId: string, applicationId: string): Promise<{ draft: string }> {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
  })

  if (!application) throw new Error("application not found")

  const appliedAgo = application.appliedAt
    ? Math.floor((Date.now() - application.appliedAt.getTime()) / (1000 * 60 * 60 * 24))
    : null

  const context = [
    `Company: ${application.company}`,
    `Role: ${application.roleTitle}`,
    appliedAgo != null ? `Applied: ${appliedAgo} days ago` : null,
    application.sourceEmailSubject ? `Original subject: ${application.sourceEmailSubject}` : null,
    application.sourceEmailSnippet ? `Original snippet: ${application.sourceEmailSnippet}` : null,
    application.recruiterName ? `Recruiter: ${application.recruiterName}` : null,
  ].filter(Boolean).join("\n")

  const anthropic = new Anthropic()
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: "You draft polite, brief follow-up messages for job applications. Match the tone of the original thread if context is provided. 60 words max. Output only the message body, no subject line.",
    messages: [{ role: "user", content: `Draft a follow-up message for this application:\n${context}` }],
  })

  const text = response.content.find((c) => c.type === "text")
  return { draft: text?.type === "text" ? text.text : "" }
}

export async function markFollowedUp(userId: string, applicationId: string): Promise<void> {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: { id: true },
  })

  if (!application) throw new Error("application not found")

  await prisma.application.update({
    where: { id: application.id },
    data: { lastFollowUpAt: new Date() },
  })
}
