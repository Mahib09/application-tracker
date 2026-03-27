import { sanitizeResult, isLikelyRoleTitle } from "@/server/services/classification/sanitize"
import type { ClassificationResult, EmailInput } from "@/server/services/classification.service"

// Local type for inputs to classifyStage1
// companyHint is optional here since gmail.service adds it in Task 5
type EmailForStage1 = {
  messageId: string
  subject: string
  snippet: string
  date: Date
  companyHint?: string | null
}

// ─── Status classification (regex) ───────────────────────────────────────────

const REGEX_PATTERNS: Record<string, RegExp> = {
  OFFER: /offer letter|pleased to offer|extend.*offer|congratulations.*offer|accepted.*position|we.*like to offer|we would like to offer|formal offer|offer of employment/i,
  INTERVIEW: /\binterview\b|virtual meeting|schedule.*call|phone screen|technical assessment|hiring manager|would like to invite you|next steps in the interview|moving you forward|next round|schedule.*interview|invitation to interview/i,
  REJECTED: /not.*moving forward|not selected|decided to move|other candidates|position.*filled|unfortunately.*not|we regret|will not be moving forward|no longer considering|after careful consideration|decided not to move|position has been filled/i,
  APPLIED: /application received|thank you for applying|we.*received.*application|application.*submitted|received your application|application confirmation|thank you for your application|we have received your|application is under review|successfully submitted/i,
}

export function classifyWithRegex(subject: string, snippet: string): string | null {
  const text = `${subject} ${snippet}`.toLowerCase()
  for (const [status, pattern] of Object.entries(REGEX_PATTERNS)) {
    if (pattern.test(text)) return status
  }
  return null
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

// ─── Company and role extraction ──────────────────────────────────────────────

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
  if (m) return { company: m[1].trim(), roleTitle: "", location: null }

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
  if (m) return { company: m[1].trim(), roleTitle: "", location: null }

  // "Role at Company"
  m = s.match(/^(.+?)\s+at\s+(.+)$/i)
  if (m) {
    roleRaw = m[1].trim()
    companyRaw = m[2].trim()
  } else {
    // "Company - Role" or "Company: Role"
    m = s.match(/^(.+?)\s*[-:]\s*(.+)$/)
    if (m) {
      const candidateRole = m[2].trim()
      // Guard: if the role portion is more than 6 words it's a sentence, not a title
      if (candidateRole.split(/\s+/).length > 6) return null
      companyRaw = m[1].trim()
      roleRaw = candidateRole
    } else {
      // "Your application to/for Company"
      m = s.match(/your application (?:to|for)\s+(.+)/i)
      if (m) return { company: m[1].trim(), roleTitle: "", location: null }

      // "Application to/for Company"
      m = s.match(/application (?:to|for)\s+(.+)/i)
      if (m) return { company: m[1].trim(), roleTitle: "", location: null }

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

// ─── Quality gate ─────────────────────────────────────────────────────────────

export function isValidExtraction(company: string, roleTitle: string): boolean {
  if (!company) return false
  if (isLikelyRoleTitle(company)) return false
  if (company.trim().split(/\s+/).length > 4) return false
  if (/^(application|thank|your|we )/i.test(company)) return false
  if (roleTitle && roleTitle.trim().split(/\s+/).length > 8) return false
  if (roleTitle && roleTitle.includes("!")) return false
  return true
}

// ─── Stage 1 classification ───────────────────────────────────────────────────

export function classifyStage1(emails: EmailForStage1[]): {
  classified: ClassificationResult[]
  unclassified: EmailInput[]
} {
  const classified: ClassificationResult[] = []
  const unclassified: EmailInput[] = []

  for (const email of emails) {
    const status = classifyWithRegex(email.subject, email.snippet)
    const extracted = extractCompanyAndRole(email.subject)

    if (status && extracted && isValidExtraction(extracted.company, extracted.roleTitle)) {
      classified.push(sanitizeResult({
        ...extracted,
        messageId: email.messageId,
        status,
        date: email.date,
        confidence: 1.0,
      }))
    } else {
      unclassified.push({
        messageId: email.messageId,
        subject: email.subject,
        text: email.snippet,
        date: email.date,
        companyHint: email.companyHint ?? null,
      })
    }
  }

  return { classified, unclassified }
}
