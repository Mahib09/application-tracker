const MAX_BYTES = 200_000
const MAX_CHARS = 10_000
const TIMEOUT_MS = 5_000

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export async function fetchJobDescription(jobUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetch(jobUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "ApplicationTracker/1.0" },
    })
    clearTimeout(timer)

    if (!response.ok) return null

    // Cap response size before reading
    const raw = await response.text()
    const capped = raw.slice(0, MAX_BYTES)
    const stripped = stripHtml(capped)
    return stripped.slice(0, MAX_CHARS)
  } catch {
    return null
  }
}
