import type { OAuth2Client } from "google-auth-library"
import { fetchFullEmail, type EmailRaw } from "@/server/services/gmail.service"
import { isDeterministicallyFiltered } from "@/server/services/classification/filter"
import { haikuTriage } from "@/server/services/classification/triage"
import { sonnetClassify, type SonnetInput } from "@/server/services/classification/classify"

export interface ClassificationResult {
  messageId: string
  company: string
  roleTitle: string
  status: string
  location: string | null
  date: Date
  confidence?: number
}

export interface PipelineStats {
  filteredCount: number
  haikuCallCount: number
  triageYesCount: number
  triageNoCount: number
  triageUncertainCount: number
  sonnetCallCount: number
  autoCommitCount: number
  reviewFlagCount: number
  manualQueueCount: number
}

export interface PipelineResult {
  results: ClassificationResult[]
  stats: PipelineStats
}

// ─── Text preprocessing ──────────────────────────────────────────────────────

export function preprocessText(
  subject: string,
  text: string,
  mode: "snippet" | "body" | "sonnet" = "snippet"
): string {
  let combined = `${subject} ${text}`
  combined = combined.replace(/<[^>]+>/g, "")
  combined = combined.replace(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi, "[email]")
  combined = combined.replace(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[phone]")
  combined = combined.replace(/https?:\/\/[^\s]+/g, "[url]")
  combined = combined.replace(
    /(?:USD|CAD|GBP|EUR|AUD)?\s*\$[\d,]+(?:\.\d{2})?(?:\s*[-–]\s*\$[\d,]+(?:\.\d{2})?)?/gi,
    "[salary]"
  )
  combined = combined.replace(/\b\d{2,3}[kK]\b/g, "[salary]")
  const limit = mode === "sonnet" ? 2000 : mode === "body" ? 800 : 500
  return combined.slice(0, limit)
}

// ─── Confidence routing ──────────────────────────────────────────────────────

function applyConfidenceRouting(
  result: ClassificationResult,
  stats: PipelineStats
): ClassificationResult {
  const confidence = result.confidence ?? 0
  if (confidence >= 0.9) {
    stats.autoCommitCount++
    return result
  }
  if (confidence >= 0.7) {
    stats.reviewFlagCount++
    return result
  }
  stats.manualQueueCount++
  return { ...result, status: "NEEDS_REVIEW" }
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export async function classifyPipeline(
  emails: EmailRaw[],
  gmailClient: OAuth2Client
): Promise<PipelineResult> {
  const stats: PipelineStats = {
    filteredCount: 0,
    haikuCallCount: 0,
    triageYesCount: 0,
    triageNoCount: 0,
    triageUncertainCount: 0,
    sonnetCallCount: 0,
    autoCommitCount: 0,
    reviewFlagCount: 0,
    manualQueueCount: 0,
  }

  // Step 1: Deterministic filter
  const passedFilter = emails.filter((e) => {
    if (isDeterministicallyFiltered(e)) {
      stats.filteredCount++
      return false
    }
    return true
  })

  if (passedFilter.length === 0) return { results: [], stats }

  // Step 2: Haiku triage
  const triageOutputs = await haikuTriage(passedFilter)
  stats.haikuCallCount = Math.ceil(passedFilter.length / 20)

  const triageMap = new Map(triageOutputs.map((t) => [t.messageId, t.result]))
  const toClassify = passedFilter.filter((e) => {
    const result = triageMap.get(e.messageId) ?? "UNCERTAIN"
    if (result === "YES") { stats.triageYesCount++; return true }
    if (result === "NO") { stats.triageNoCount++; return false }
    stats.triageUncertainCount++
    return true // UNCERTAIN → Sonnet
  })

  if (toClassify.length === 0) return { results: [], stats }

  // Step 3: Fetch full bodies
  const needsReviewFromFetch: ClassificationResult[] = []
  const sonnetInputs: SonnetInput[] = []

  const fetchResults = await Promise.allSettled(
    toClassify.map(async (email) => {
      const body = await fetchFullEmail(gmailClient, email.messageId)
      return {
        messageId: email.messageId,
        subject: email.subject,
        sender: email.from,
        body: preprocessText(email.subject, body, "sonnet"),
        date: email.date,
        companyHint: email.companyHint,
      } satisfies SonnetInput
    })
  )

  for (let i = 0; i < fetchResults.length; i++) {
    const res = fetchResults[i]
    if (res.status === "fulfilled") {
      sonnetInputs.push(res.value)
    } else {
      const email = toClassify[i]
      needsReviewFromFetch.push({
        messageId: email.messageId,
        company: email.companyHint ?? "",
        roleTitle: "",
        status: "NEEDS_REVIEW",
        location: null,
        date: email.date,
        confidence: 0,
      })
    }
  }

  // Step 4: Sonnet classification (batched — 10 per API call, all batches in parallel)
  stats.sonnetCallCount = Math.ceil(sonnetInputs.length / 10)
  if (sonnetInputs.length === 0) {
    return { results: needsReviewFromFetch, stats }
  }
  const classificationResults = await sonnetClassify(sonnetInputs)

  // Step 5: Confidence routing
  const routed = classificationResults.map((r) => applyConfidenceRouting(r, stats))

  return {
    results: [...routed, ...needsReviewFromFetch],
    stats,
  }
}

// ─── Re-exports (used by sync.service.ts) ────────────────────────────────────

export {
  normalizeRoleTitle,
  roleTitlesSimilar,
  companySimilar,
} from "@/server/services/classification/sanitize"
