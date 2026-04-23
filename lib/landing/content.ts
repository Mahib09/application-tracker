import { applicationStatus } from "@/app/generated/prisma/enums"

export const LANDING_COPY = {
  hero: {
    h1: "The application tracker that tracks itself.",
    sub: "Connect Gmail once. Paila classifies every reply and shows you what's working, what's not, and who's gone quiet.",
    cta: "Sign in with Google",
    secondaryCta: "See how it works",
  },
  trust: "We only read subjects and snippets. Never full email bodies, attachments, or contacts.",
  problem:
    "You've applied to 47 places. You don't remember 31 of them. None of them remember you either.",
  problemSub:
    "Paila remembers all of them — with sources, dates, and status — so you can stop keeping a spreadsheet in your head.",
} as const

export type HeroEmail = {
  id: string
  company: string
  subject: string
  snippet: string
  status: applicationStatus
  daysAgo: number
}

export const HERO_EMAILS: HeroEmail[] = [
  {
    id: "1",
    company: "Stripe",
    subject: "Re: Frontend Engineer application",
    snippet: "Thanks for applying. We'd love to schedule a call…",
    status: applicationStatus.INTERVIEW,
    daysAgo: 2,
  },
  {
    id: "2",
    company: "Linear",
    subject: "Your application to Linear",
    snippet: "Unfortunately we've decided to move forward with other candidates.",
    status: applicationStatus.REJECTED,
    daysAgo: 5,
  },
  {
    id: "3",
    company: "Vercel",
    subject: "Application received",
    snippet: "Thanks for applying to the Platform team. We'll review…",
    status: applicationStatus.APPLIED,
    daysAgo: 1,
  },
  {
    id: "4",
    company: "Anthropic",
    subject: "Next steps",
    snippet: "We'd like to invite you to a final round interview.",
    status: applicationStatus.OFFER,
    daysAgo: 8,
  },
]

export const FAQ_ITEMS = [
  {
    q: "Why does Paila need access to my Gmail?",
    a: "We classify job-application replies as they arrive. We only read subjects and snippets — see the Privacy section for details.",
  },
  {
    q: "Does Paila read my personal emails?",
    a: "No. We only process emails that match deterministic filters (sender domains, subject patterns). Everything else is ignored before classification.",
  },
  {
    q: "Is my data shared with anyone?",
    a: "No. Emails go through Anthropic's API (Claude) for classification — Anthropic doesn't train on API data. Nothing else goes to third parties.",
  },
  {
    q: "Can I delete my data?",
    a: "Yes. Settings → Danger zone → Delete all data wipes your account and every stored application.",
  },
  {
    q: "Is this free?",
    a: "Yes. It's a personal project. There's no paid tier.",
  },
  {
    q: "Why is it invite-only right now?",
    a: "Google's OAuth verification for Gmail scopes takes time. During testing we're limited to 100 users.",
  },
  {
    q: "What if Paila gets something wrong?",
    a: "Low-confidence classifications go to the Review queue instead of being silently applied. You always see what's uncertain.",
  },
  {
    q: "Can I export my data?",
    a: "CSV and JSON exports are available in Settings.",
  },
]

export const FOOTER_LINKS = {
  product: [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "FAQ", href: "#faq" },
  ],
  legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
  more: [
    { label: "GitHub", href: "https://github.com/Mahib09/paila" },
    { label: "Contact", href: "mailto:magarmahib@gmail.com" },
  ],
}
