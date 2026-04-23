"use client"
import { useEffect, useState } from "react"
import { motion } from "motion/react"
import {
  Download, FileJson, FileSpreadsheet, Bell, TrendingUp, Ghost, Clock,
} from "lucide-react"
import { useReducedMotion } from "@/lib/hooks/useReducedMotion"
import SectionHeader from "./SectionHeader"
import FeatureBlock from "./FeatureBlock"
import FloatingEmailCards from "./FloatingEmailCards"
import { STATUS_COLORS, STATUS_CONFIG } from "@/lib/constants"
import { applicationStatus } from "@/app/generated/prisma/enums"

// ─── Feature 1: Gmail Auto-import ─────────────────────────────────────────────

type ImportPhase = 0 | 1 | 2

function GmailImportVisual() {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<ImportPhase>(0)

  useEffect(() => {
    if (reduced) return
    const durations: Record<ImportPhase, number> = { 0: 2200, 1: 1200, 2: 2200 }
    let t: ReturnType<typeof setTimeout>
    const advance = (p: ImportPhase) => {
      const next = ((p + 1) % 3) as ImportPhase
      t = setTimeout(() => { setPhase(next); advance(next) }, durations[next])
    }
    advance(0)
    return () => clearTimeout(t)
  }, [reduced])

  const color = STATUS_COLORS[applicationStatus.APPLIED]

  return (
    <div className="space-y-3 min-h-[140px]">
      {/* Raw email */}
      <motion.div
        animate={{ opacity: phase === 0 ? 1 : 0.25, scale: phase === 0 ? 1 : 0.98 }}
        transition={{ duration: 0.35 }}
        className="rounded-lg border border-border bg-muted/40 px-4 py-3"
      >
        <p className="text-[11px] font-mono text-muted-foreground">
          FROM: <span className="text-foreground">recruiting@stripe.com</span>
        </p>
        <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
          SUBJ: <span className="text-foreground">Re: Software Engineer application</span>
        </p>
      </motion.div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 px-1">
        <motion.div
          animate={{ width: phase === 0 ? "0%" : phase === 1 ? "55%" : "100%" }}
          transition={{ duration: phase === 1 ? 1.0 : 0.4 }}
          className="h-0.5 rounded-full bg-linear-to-r from-blue-500 to-violet-500"
          style={{ maxWidth: 120 }}
        />
        <motion.span
          key={phase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="text-[11px] font-mono text-muted-foreground"
        >
          {phase === 0 && "new email detected"}
          {phase === 1 && "classifying…"}
          {phase === 2 && "✓ linked to application"}
        </motion.span>
      </div>

      {/* Result card */}
      <motion.div
        animate={{ opacity: phase === 2 ? 1 : 0, y: phase === 2 ? 0 : 6 }}
        transition={{ duration: 0.4 }}
        className="rounded-lg border bg-card px-4 py-3 flex items-center justify-between"
        style={{ borderColor: `${color}40` }}
      >
        <div>
          <p className="text-sm font-medium text-foreground">Stripe</p>
          <p className="text-xs text-muted-foreground mt-0.5">Software Engineer · just now</p>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          <span className="size-1.5 rounded-full bg-white/60" />
          Applied
        </span>
      </motion.div>
    </div>
  )
}

// ─── Feature 2: AI Classification ─────────────────────────────────────────────

function AIClassifyVisual() {
  const color = STATUS_COLORS[applicationStatus.INTERVIEW]

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1">
        <p className="text-[11px] font-mono text-muted-foreground">
          FROM: <span className="text-foreground">recruiting@linear.app</span>
        </p>
        <p className="text-[11px] font-mono text-muted-foreground">
          SUBJ: <span className="text-foreground">Re: Your application to Linear</span>
        </p>
        <p className="text-[11px] text-muted-foreground/60 italic mt-1 line-clamp-1">
          &ldquo;Thanks for your application. We&apos;d love to set up a call…&rdquo;
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Classified as</p>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            <span className="size-2 rounded-full bg-white/60" />
            {STATUS_CONFIG[applicationStatus.INTERVIEW].label}
          </span>
        </div>

        <div className="text-right">
          <p className="text-xs text-muted-foreground mb-1.5">Confidence</p>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full w-[91%] rounded-full bg-linear-to-r from-emerald-400 to-emerald-500" />
            </div>
            <span className="text-sm font-mono font-medium text-foreground tabular-nums">91%</span>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-3 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          Low confidence → Review queue instead
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/50">claude-haiku</span>
      </div>
    </div>
  )
}

// ─── Feature 3: Analytics ──────────────────────────────────────────────────────

function AnalyticsVisual() {
  const stats = [
    { icon: TrendingUp, tone: "blue", label: "Response rate", value: "42%", sub: "last 30d" },
    { icon: Ghost,      tone: "amber", label: "Ghost rate",     value: "23%", sub: "eligible" },
    { icon: Clock,      tone: "emerald", label: "Median reply", value: "8d",  sub: "to first reply" },
  ]
  const toneClass: Record<string, string> = {
    blue:    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    amber:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  }
  const funnel = [
    { label: "Applied",     pct: 100, status: applicationStatus.APPLIED },
    { label: "Interview",   pct: 42,  status: applicationStatus.INTERVIEW },
    { label: "Offer",       pct: 12,  status: applicationStatus.OFFER },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ icon: Icon, tone, label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-background px-3 py-3">
            <span className={`inline-flex size-7 items-center justify-center rounded-lg mb-2 ${toneClass[tone]}`}>
              <Icon className="size-3.5" />
            </span>
            <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
            <p className="text-xl font-semibold tabular-nums text-foreground mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {funnel.map(({ label, pct, status }) => (
          <div key={label}>
            <div className="flex justify-between items-baseline text-[11px] mb-1">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono text-foreground">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[status] }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Feature 4: Follow-ups ─────────────────────────────────────────────────────

function FollowUpsVisual() {
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-amber-200/60 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 px-4 py-3">
        <Bell className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">14 days without a reply</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vercel · Platform Engineer · Applied Oct 15
          </p>
        </div>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <span>Draft follow-up message</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.2 }}
        >
          ↓
        </motion.span>
      </button>

      <motion.div
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
        style={{ overflow: "hidden" }}
      >
        <div className="rounded-lg border border-border bg-background px-4 py-3">
          <p className="text-xs text-muted-foreground font-mono mb-2">draft.txt</p>
          <p className="text-xs text-foreground leading-relaxed">
            Hi, I wanted to follow up on my application for the Platform Engineer role. I&apos;m still very interested and would love to know if there are any updates on your end.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Feature 5: Export ─────────────────────────────────────────────────────────

function ExportVisual() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[
          { Icon: FileSpreadsheet, label: "CSV", sub: "Opens in Excel / Google Sheets", color: "text-emerald-600" },
          { Icon: FileJson,        label: "JSON", sub: "Full status history included",  color: "text-violet-600" },
        ].map(({ Icon, label, sub, color }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-muted/30 px-4 py-4 flex flex-col gap-3"
          >
            <Icon className={`size-7 ${color}`} />
            <div>
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{sub}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Download className="size-3" />
              Download
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 flex items-center gap-2">
        <span className="size-2 rounded-full bg-red-500" />
        <p className="text-xs text-muted-foreground">
          Delete all data from Settings → Danger zone. Immediate, permanent.
        </p>
      </div>
    </div>
  )
}

// ─── Section ───────────────────────────────────────────────────────────────────

export default function FeatureSection() {
  return (
    <section id="features" className="py-8 lg:py-12 bg-background">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          number="03"
          title="Features"
          subtitle="Everything it does, and why it works."
        />

        <FeatureBlock
          eyebrow="Gmail"
          eyebrowColor="blue"
          title="Your inbox is your tracker"
          description="No spreadsheets. No manual logging. Paila reads the subjects of new emails and links them to applications automatically."
          bullets={[
            "Works on emails already in your inbox",
            "New emails classified within minutes of arriving",
            "Ignores everything that isn't a job application",
          ]}
          visual={<GmailImportVisual />}
          imageRight
        />

        <div className="border-t border-border/50" />

        <FeatureBlock
          eyebrow="AI"
          eyebrowColor="violet"
          title="Interview, offer, rejection, ghost — detected automatically"
          description="Every reply gets its status updated by Claude. When confidence is low, it goes to your review queue instead of being silently misclassified."
          bullets={[
            "Applied, Interview, Offer, Rejected, Ghosted — all five states",
            "Confidence score on every classification",
            "Low-confidence items surfaced for your review",
          ]}
          visual={<AIClassifyVisual />}
          imageRight={false}
        />

        <FloatingEmailCards />

        <div className="border-t border-border/50" />

        <FeatureBlock
          eyebrow="Analytics"
          eyebrowColor="emerald"
          title="Know your response rate. Know your ghost rate."
          description="Weekly volume, median response time, pipeline funnel — the metrics most job hunters never calculate because they're stuck in a spreadsheet."
          bullets={[
            "Response rate at 30, 60, and 90 day windows",
            "Pipeline funnel from applied to offer",
            "Ghost rate on applications past their expiry",
          ]}
          visual={<AnalyticsVisual />}
          imageRight
        />

        <div className="border-t border-border/50" />

        <FeatureBlock
          eyebrow="Follow-ups"
          eyebrowColor="amber"
          title="Nudges before they go cold"
          description="Paila watches applications that have been silent for 7 and 14 days and surfaces them with a draft message — so you don't miss the window."
          bullets={[
            "Configurable silence thresholds",
            "Draft follow-up copy generated automatically",
            "Dismiss or send — always your call",
          ]}
          visual={<FollowUpsVisual />}
          imageRight={false}
        />

        <div className="border-t border-border/50" />

        <FeatureBlock
          eyebrow="Export"
          eyebrowColor="neutral"
          title="It&apos;s your data. Export it any time."
          description="CSV for spreadsheets. JSON with full status history. Delete everything in two clicks. No lock-in, no retention dark patterns."
          visual={<ExportVisual />}
          imageRight
        />
      </div>
    </section>
  )
}
