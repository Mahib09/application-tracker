import type { ClassificationResult } from "@/server/services/classification.service"

// ─── ATS brand names ──────────────────────────────────────────────────────────
// Used to reject ATS platform names extracted as company values.
export const ATS_BRAND_NAMES: ReadonlySet<string> = new Set([
  "greenhouse", "lever", "workday", "ashby", "icims", "jobvite",
  "smartrecruiters", "taleo", "bamboohr", "successfactors", "breezy",
  "njoyn", "jazz", "recruitee", "pinpoint",
])

// ─── Artifact role title detection ───────────────────────────────────────────

const ARTIFACT_ROLE_PATTERNS: RegExp[] = [
  /^application\s+(confirmation|update|received|status|viewed|submitted|acknowledgement)$/i,
  /^your\s+application$/i,
  /^thank\s+you\s+for\s+(applying|your\s+application)$/i,
  /^thank\s+you\s+for\s+your\s+interest\b/i,
]

export function isArtifactRoleTitle(roleTitle: string): boolean {
  return ARTIFACT_ROLE_PATTERNS.some((p) => p.test(roleTitle.trim()))
}

// ─── Job title detection ──────────────────────────────────────────────────────

export function isLikelyRoleTitle(str: string): boolean {
  if (str.trim().split(/\s+/).length > 4) return true
  if (/\([^)]+\)\s*$/.test(str)) return true
  if (/\b(developer|engineer|designer|analyst|manager|coordinator|specialist|consultant|architect|administrator|director)\b\s*(\([^)]+\))?\s*$/i.test(str)) return true
  return false
}

// ─── Role rescue ─────────────────────────────────────────────────────────────

/** Attempts to extract a real job title from an artifact string.
 *  e.g. "Application Received! Thanks for applying to the Software Developer 1 Role"
 *  → "Software Developer 1"
 */
export function rescueRole(original: string): string | null {
  if (!original) return null
  // Require "applying to" or "applying for" — bare "for" is too broad
  const match = original.match(
    /applying\s+(?:to|for)\s+(?:the\s+)?(.+?)\s+(?:role|position|opportunity)\b/i
  )
  if (!match) return null
  const rescued = match[1].trim()
  // Reject single-word extractions — real job titles have 2+ words or known keywords
  if (rescued.split(/\s+/).length < 2 && !/\b(engineer|developer|designer|analyst|manager|coordinator|specialist|consultant|architect|administrator|director)\b/i.test(rescued)) {
    return null
  }
  return isArtifactRoleTitle(rescued) ? null : rescued
}

// ─── Role title normalization + similarity ────────────────────────────────────

export function normalizeRoleTitle(title: string): string {
  let s = title.toLowerCase()
  s = s.replace(/\b(senior|junior|lead|staff|principal|sr|jr|entry[\s-]level|mid[\s-]level|associate|intermediate)\b/g, "")
  s = s.replace(/\b(contract|permanent|full[\s-]time|part[\s-]time|intern|internship|co[\s-]op|new\s+grad(?:uate)?)\b/g, "")
  s = s.replace(/[\(\[][^\)\]]*[\)\]]/g, "")
  s = s.replace(/\bdevelop(?:er|ment|ing|ed)?\b/g, "develop")
  s = s.replace(/\bengineer(?:ing)?\b/g, "engineer")
  s = s.replace(/[-\/|,\.&+]/g, " ")
  return s.replace(/\s+/g, " ").trim()
}

export function roleTitlesSimilar(a: string, b: string): boolean {
  if (!a || !b) return false
  const wordsA = new Set(normalizeRoleTitle(a).split(" ").filter((w) => w.length > 2))
  const wordsB = new Set(normalizeRoleTitle(b).split(" ").filter((w) => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return false
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return intersection / union >= 0.6
}

// ─── Sanitize result ──────────────────────────────────────────────────────────

/** Cleans up company and roleTitle before persisting.
 *  Called on every ClassificationResult from every code path.
 */
export function sanitizeResult(result: ClassificationResult): ClassificationResult {
  let company = result.company.trim().replace(/\s{2,}/g, " ").replace(/[!,.]+$/, "")
  let roleTitle = result.roleTitle.trim().replace(/\s{2,}/g, " ").replace(/[!,.]+$/, "")

  // Strip trailing ", PersonName" — exclude common business suffixes
  company = company.replace(
    /,\s+(?!Inc\b|Ltd\b|LLC\b|Corp\b|Co\b|LLP\b)[A-Z][a-z]+\s*$/, ""
  )

  // Clear numeric-only company names (ATS requisition IDs like "4867314", "123-456")
  if (/^\d[\d\s-]*$/.test(company)) company = ""

  // Clear domain-like company names ("stripe.io", "mycompany.com")
  if (/^[\w-]+\.(com|io|co|net|org|ca|ai|app)\b/i.test(company)) company = ""

  // Clear noreply/donotreply prefixed names ("noreply WorkdayMyview")
  if (/^(noreply|no-reply|donotreply)\b/i.test(company)) company = ""

  // Clear "our/we" prefix — AI sometimes returns "Our recruiting team" verbatim
  if (/^(our|we)\b/i.test(company)) company = ""

  // Strip "role of" / "position of" prefix
  roleTitle = roleTitle.replace(/^(?:the\s+)?(?:role|position)\s+of\s+/i, "")

  // Clear numeric-only requisition numbers (e.g. "70471", "2024-70471")
  if (/^\d[\d-]*\d$|^\d+$/.test(roleTitle.trim())) roleTitle = ""

  // Clear if contains ! — job titles never have exclamation marks; save for rescue
  const roleTitleBeforeExcl = roleTitle
  if (roleTitle.includes("!")) roleTitle = ""

  // Role rescue: try to extract real role from exclamation-cleared strings
  // (Only rescue from ! clearing, not from artifact-pattern clearing, to avoid
  // false extractions like "Your Interest in the Fullstack Engineer" from
  // "Thank You for Your Interest in the Fullstack Engineer Opportunity")
  if (roleTitle === "" && roleTitleBeforeExcl) {
    const rescued = rescueRole(roleTitleBeforeExcl)
    if (rescued) roleTitle = rescued
  }

  // Clear artifact role titles (status phrases, not job titles)
  if (isArtifactRoleTitle(roleTitle)) roleTitle = ""

  // Swap company→roleTitle when company looks like a job title and role is empty
  if (isLikelyRoleTitle(company) && roleTitle === "") {
    roleTitle = company
    company = ""
  }

  return { ...result, company, roleTitle }
}

// ─── Post-process ─────────────────────────────────────────────────────────────

/** Final processing step applied to every AI result.
 *  Sanitizes, applies companyHint fallback, routes empty results to NEEDS_REVIEW.
 */
export function postProcess(
  result: ClassificationResult,
  email: { companyHint: string | null }
): ClassificationResult {
  let processed = sanitizeResult(result)

  // Sender domain fallback: use companyHint if company still empty after sanitize
  if (!processed.company && email.companyHint) {
    processed = { ...processed, company: email.companyHint }
  }

  // Nothing extractable → NEEDS_REVIEW
  if (!processed.company && !processed.roleTitle) {
    processed = {
      ...processed,
      status: "NEEDS_REVIEW",
      confidence: Math.min(processed.confidence ?? 0.3, 0.3),
    }
  }

  return processed
}
