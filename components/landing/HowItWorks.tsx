"use client"
import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { TrendingUp, CheckCircle2 } from "lucide-react"
import { useReducedMotion } from "@/lib/hooks/useReducedMotion"
import SectionHeader from "./SectionHeader"
import { STATUS_COLORS, STATUS_CONFIG } from "@/lib/constants"
import { applicationStatus } from "@/app/generated/prisma/enums"

const EXPO_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number]

// ─── step fragments ────────────────────────────────────────────────────────────

function ConnectFragment() {
  return (
    <div className="mt-5 rounded-xl border border-border bg-card overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex gap-1.5">
          {["bg-red-400", "bg-amber-400", "bg-emerald-400"].map((c) => (
            <span key={c} className={`size-2.5 rounded-full ${c} opacity-70`} />
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground/60 font-mono mx-auto pr-6">
          accounts.google.com
        </span>
      </div>

      {/* Scope rows */}
      <div className="px-4 py-3 space-y-2.5">
        <p className="text-[11px] text-muted-foreground mb-3">
          <span className="font-semibold text-foreground">Paila</span> wants access to your Google Account
        </p>
        {[
          { icon: "📧", text: "Read email subjects and snippets", scope: "gmail.readonly" },
          { icon: "🚫", text: "Cannot send, delete, or modify email", scope: "read-only" },
        ].map(({ icon, text, scope }) => (
          <div key={scope} className="flex items-start gap-2.5">
            <span className="text-sm mt-px">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-snug">{text}</p>
              <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{scope}</p>
            </div>
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
          </div>
        ))}
      </div>
    </div>
  )
}

const CLASSIFY_STATUSES = [
  applicationStatus.APPLIED,
  applicationStatus.INTERVIEW,
  applicationStatus.OFFER,
  applicationStatus.REJECTED,
  applicationStatus.GHOSTED,
]

function ClassifyFragment() {
  const [idx, setIdx] = useState(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const t = setInterval(() => setIdx((i) => (i + 1) % CLASSIFY_STATUSES.length), 1800)
    return () => clearInterval(t)
  }, [reduced])

  const status = CLASSIFY_STATUSES[idx]
  const color = STATUS_COLORS[status]
  const label = STATUS_CONFIG[status].label

  return (
    <div className="mt-5 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-mono text-muted-foreground">
          classification result
        </span>
        <span className="text-[11px] font-mono text-muted-foreground/50">
          confidence: 94%
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">
            FROM: recruiting@linear.app
          </p>
          <p className="text-xs text-foreground font-medium mt-0.5 truncate">
            Re: Your application to Linear
          </p>
        </div>
        <span className="text-muted-foreground/40 text-sm">→</span>
        <motion.span
          key={status}
          initial={{ opacity: 0, scale: 0.85, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          <span className="size-1.5 rounded-full bg-white/60" />
          {label}
        </motion.span>
      </div>
    </div>
  )
}

function InsightsFragment() {
  return (
    <div className="mt-5 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          <TrendingUp className="size-4" />
        </span>
        <span className="text-[10px] rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 font-medium">
          +8pp vs last month
        </span>
      </div>
      <p className="text-xs font-medium text-muted-foreground">Response rate</p>
      <p
        className="font-semibold tabular-nums text-foreground mt-1 tracking-tight"
        style={{ fontSize: "clamp(28px, 3vw, 40px)", fontVariantNumeric: "tabular-nums" }}
      >
        42%
      </p>
      <p className="text-xs text-muted-foreground mt-1">last 30 days · 18 of 43 applied</p>
    </div>
  )
}

// ─── step data ─────────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    title: "Connect Gmail",
    desc: "One OAuth approval. Paila requests the minimum scope — read-only access to subjects and snippets, nothing more.",
    Fragment: ConnectFragment,
  },
  {
    num: "02",
    title: "We classify",
    desc: "Every new reply is analyzed by Claude. Status, company, and confidence score — attached automatically.",
    Fragment: ClassifyFragment,
  },
  {
    num: "03",
    title: "You see insights",
    desc: "Response rates, ghost rates, pipeline funnel — the metrics most job hunters never calculate.",
    Fragment: InsightsFragment,
  },
] as const

// ─── section ───────────────────────────────────────────────────────────────────

export default function HowItWorks() {
  const reduced = useReducedMotion()

  return (
    <section id="how-it-works" className="py-24 lg:py-32 bg-background">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          number="02"
          title="How it works"
          subtitle="Three steps. One of them is you signing in."
        />

        <div className="grid lg:grid-cols-3 gap-10 lg:gap-14">
          {STEPS.map(({ num, title, desc, Fragment }, i) => (
            <motion.div
              key={num}
              initial={reduced ? false : { opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.65, ease: EXPO_OUT, delay: i * 0.12 }}
            >
              {/* Step number */}
              <p
                className="font-mono font-medium text-blue-500/25 dark:text-blue-400/20 mb-5 leading-none"
                style={{ fontSize: 52 }}
              >
                {num}
              </p>

              {/* Divider */}
              <div className="h-px w-10 bg-border mb-5" />

              <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              <Fragment />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
