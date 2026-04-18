"use client"
import { useState } from "react"

// 10 deterministic color pairs (bg / text) keyed by hash
const PALETTE = [
  { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-700 dark:text-violet-300" },
  { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-rose-100 dark:bg-rose-900/40", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-teal-100 dark:bg-teal-900/40", text: "text-teal-700 dark:text-teal-300" },
  { bg: "bg-orange-100 dark:bg-orange-900/40", text: "text-orange-700 dark:text-orange-300" },
  { bg: "bg-pink-100 dark:bg-pink-900/40", text: "text-pink-700 dark:text-pink-300" },
  { bg: "bg-cyan-100 dark:bg-cyan-900/40", text: "text-cyan-700 dark:text-cyan-300" },
  { bg: "bg-lime-100 dark:bg-lime-900/40", text: "text-lime-700 dark:text-lime-300" },
]

function colorFor(company: string) {
  let hash = 0
  for (let i = 0; i < company.length; i++) {
    hash = (hash * 31 + company.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

function domainFor(company: string) {
  return company.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com"
}

interface Props {
  company: string
  size?: number
}

export default function CompanyLogo({ company, size = 24 }: Props) {
  const [failed, setFailed] = useState(false)
  const domain = domainFor(company)
  const color = colorFor(company)
  const initial = company.trim()[0]?.toUpperCase() ?? "?"

  if (failed) {
    return (
      <div
        className={`shrink-0 flex items-center justify-center rounded-md font-semibold ${color.bg} ${color.text}`}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
        aria-label={company}
      >
        {initial}
      </div>
    )
  }

  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={company}
      width={size}
      height={size}
      className="shrink-0 rounded-md object-contain"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  )
}
