import type { EmailRaw } from "@/server/services/gmail.service"

const BLOCKLISTED_DOMAINS = new Set([
  "linkedin.com", "facebookmail.com", "twitter.com", "x.com",
  "instagram.com", "tiktok.com", "reddit.com", "discord.com",
  "mail.mailchimp.com", "sendgrid.net", "constantcontact.com",
  "pinterest.com", "quora.com", "medium.com", "substack.com",
])

function senderDomain(from: string): string {
  const emailMatch = from.match(/<([^>]+)>/) ?? from.match(/\S+@\S+/)
  const email = emailMatch?.[0]?.replace(/[<>]/g, "") ?? ""
  return email.split("@")[1]?.toLowerCase() ?? ""
}

export function isDeterministicallyFiltered(email: EmailRaw): boolean {
  // Rule 1: marketing unsubscribe signal (ATS emails with unsubscribe headers pass through)
  if (email.listUnsubscribe !== null && !email.isATS) return true
  // Rule 2: sender is a social/marketing platform
  const domain = senderDomain(email.from)
  if (domain && BLOCKLISTED_DOMAINS.has(domain)) return true
  // Rule 3: Gmail categorized as promotions or social
  if (
    email.labelIds.includes("CATEGORY_PROMOTIONS") ||
    email.labelIds.includes("CATEGORY_SOCIAL")
  ) return true
  return false
}
