import { google } from "googleapis"
import type { OAuth2Client } from "google-auth-library"
import { prisma } from "@/server/lib/prisma"

export interface EmailRaw {
  messageId: string
  subject: string
  snippet: string
  date: Date
}

// ─── Body extraction ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractBodyText(payload: any): string {
  if (!payload) return ""

  if (payload.mimeType === "text/plain") {
    return decodeBase64url(payload.body?.data ?? "")
  }

  if (payload.mimeType === "text/html") {
    const decoded = decodeBase64url(payload.body?.data ?? "")
    return decoded.replace(/<[^>]+>/g, "")
  }

  if (payload.mimeType?.startsWith("multipart/") && Array.isArray(payload.parts)) {
    // Prefer text/plain over text/html
    const plain = payload.parts.find((p: any) => p.mimeType === "text/plain")
    if (plain) return extractBodyText(plain)
    return payload.parts.map((p: any) => extractBodyText(p)).join(" ").trim()
  }

  return ""
}

function decodeBase64url(data: string): string {
  if (!data) return ""
  return Buffer.from(data, "base64url").toString("utf-8")
}

// ─── OAuth2 client ───────────────────────────────────────────────────────────

export async function getGmailClient(userId: string): Promise<OAuth2Client> {
  const token = await prisma.oauthToken.findUnique({ where: { userId } })
  if (!token) throw new Error(`No OAuth token found for user ${userId}`)

  const oauth2Client = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET
  )

  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiresAt?.getTime() ?? null,
  })

  // Refresh if expiring within 60 seconds or already expired
  const isExpiringSoon =
    token.expiresAt && token.expiresAt.getTime() - Date.now() < 60_000

  if (isExpiringSoon) {
    const { credentials } = await oauth2Client.refreshAccessToken()
    await prisma.oauthToken.update({
      where: { userId },
      data: {
        accessToken: credentials.access_token!,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      },
    })
  }

  return oauth2Client
}

// ─── Email fetch ─────────────────────────────────────────────────────────────

const GMAIL_QUERY = [
  "subject:(applied OR interview OR offer OR rejection OR congratulations OR assessment OR invitation)",
  "OR from:(greenhouse.io OR lever.co OR workday.com OR ashby.com OR myworkdayjobs.com OR icims.com OR jobvite.com)",
].join(" ")

export async function fetchEmailsSince(
  client: OAuth2Client,
  since?: Date
): Promise<EmailRaw[]> {
  const gmail = google.gmail({ version: "v1", auth: client })

  let query = GMAIL_QUERY
  if (since) {
    const unixSeconds = Math.floor(since.getTime() / 1000)
    query += ` after:${unixSeconds}`
  }

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 100,
  })

  const messages = listRes.data.messages ?? []
  if (messages.length === 0) return []

  const emails: EmailRaw[] = []

  for (const msg of messages) {
    if (!msg.id) continue

    const getRes = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "minimal",
    })

    const data = getRes.data
    const headers = data.payload?.headers ?? []

    const subject =
      headers.find((h) => h.name === "Subject")?.value ?? "(no subject)"
    const dateStr = headers.find((h) => h.name === "Date")?.value ?? ""

    emails.push({
      messageId: msg.id,
      subject,
      snippet: data.snippet ?? "",
      date: dateStr ? new Date(dateStr) : new Date(),
    })
  }

  return emails
}

// ─── Full body fetch (Stage 3) ───────────────────────────────────────────────

export async function fetchFullEmail(
  client: OAuth2Client,
  messageId: string
): Promise<string> {
  const gmail = google.gmail({ version: "v1", auth: client })

  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  })

  return extractBodyText(res.data.payload)
}
