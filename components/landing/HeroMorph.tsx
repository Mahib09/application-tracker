"use client"
import { useEffect, useState } from "react"
import type { MotionValue } from "motion/react"
import { motion, LayoutGroup } from "motion/react"
import { MoreHorizontal } from "lucide-react"
import { useReducedMotion } from "@/lib/hooks/useReducedMotion"
import { HERO_EMAILS, type HeroEmail } from "@/lib/landing/content"
import { STATUS_COLORS, STATUS_CONFIG } from "@/lib/constants"

// ─── ease + timing ─────────────────────────────────────────────────────────────

const EXPO_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number]
const LAYOUT_DURATION = 0.6
const STAGGER = 0.05

const cardTransition = (index: number) => ({
  layout: {
    type: "tween" as const,
    duration: LAYOUT_DURATION,
    ease: EXPO_OUT,
    delay: index * STAGGER,
  },
  borderRadius: { duration: 0.45, ease: "easeOut" as const, delay: index * STAGGER },
  backgroundColor: { duration: 0.45, ease: "easeOut" as const, delay: index * STAGGER },
})

// ─── local primitives ──────────────────────────────────────────────────────────

const AVATAR_COLORS: Record<string, string> = {
  Stripe: "#635BFF",
  Linear: "#5E6AD2",
  Vercel: "#111",
  Anthropic: "#D97757",
}

function Avatar({ company }: { company: string }) {
  return (
    <span
      className="inline-flex shrink-0 size-8 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: AVATAR_COLORS[company] ?? "#6366F1" }}
    >
      {company[0]}
    </span>
  )
}

function StatusPill({
  status,
  delay,
}: {
  status: HeroEmail["status"]
  delay: number
}) {
  const color = STATUS_COLORS[status]
  const label = STATUS_CONFIG[status].label
  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
      style={{ backgroundColor: `${color}30`, border: `1px solid ${color}60` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </motion.span>
  )
}

// ─── card content ──────────────────────────────────────────────────────────────

function InboxContent({ email }: { email: HeroEmail }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Avatar company={email.company} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-medium text-white/90 truncate">
            {email.company}
          </span>
          <span className="text-[11px] text-white/35 shrink-0 ml-2 font-mono">
            {email.daysAgo}d
          </span>
        </div>
        <p className="text-xs text-white/55 truncate mt-0.5">{email.subject}</p>
        <p className="text-xs text-white/30 truncate mt-0.5">{email.snippet}</p>
      </div>
    </div>
  )
}

function KanbanContent({ email, index }: { email: HeroEmail; index: number }) {
  return (
    <div className="flex flex-col gap-2 p-3 h-full">
      <div className="flex items-center gap-2">
        <Avatar company={email.company} />
        <span className="text-sm font-medium text-white/90 truncate">
          {email.company}
        </span>
      </div>
      <p className="text-xs text-white/50 leading-relaxed line-clamp-2 flex-1">
        {email.snippet}
      </p>
      <StatusPill status={email.status} delay={0.25 + index * STAGGER} />
    </div>
  )
}

// ─── shared card — layoutId FLIP + animated visual props ──────────────────────

function HeroCard({
  email,
  morphed,
  index,
}: {
  email: HeroEmail
  morphed: boolean
  index: number
}) {
  return (
    <motion.div
      layoutId={`hero-card-${email.id}`}
      layout
      animate={{
        borderRadius: morphed ? 12 : 0,
        backgroundColor: morphed
          ? "rgba(255,255,255,0.04)"
          : "rgba(255,255,255,0.00)",
      }}
      transition={cardTransition(index)}
      style={{
        position: "relative",
        border: "1px solid",
        borderColor: morphed ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}
    >
      {/* Single content slot — key change swaps content, fade-in masks the switch */}
      <motion.div
        key={morphed ? "kanban" : "inbox"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, delay: morphed ? 0.18 + index * STAGGER : 0.05 }}
      >
        {morphed ? (
          <KanbanContent email={email} index={index} />
        ) : (
          <InboxContent email={email} />
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── full panel ────────────────────────────────────────────────────────────────

function MorphPanel({ morphed }: { morphed: boolean }) {
  return (
    <div className="w-full">
      {/* Header — opacity crossfade only, no position jump */}
      <div className="relative h-11 mb-0">
        <motion.div
          animate={{ opacity: morphed ? 0 : 1 }}
          transition={{ duration: 0.2 }}
          style={{ pointerEvents: morphed ? "none" : "auto" }}
          className="absolute inset-0 flex items-center justify-between px-4 rounded-t-2xl border-x border-t border-white/10 bg-white/3"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white/70">Inbox</span>
            <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-mono font-medium text-blue-400">
              {HERO_EMAILS.length}
            </span>
          </div>
          <MoreHorizontal className="size-4 text-white/30" />
        </motion.div>

        <motion.div
          animate={{ opacity: morphed ? 1 : 0 }}
          transition={{ duration: 0.25, delay: morphed ? 0.15 : 0 }}
          style={{ pointerEvents: morphed ? "auto" : "none" }}
          className="absolute inset-0 flex items-end px-1 pb-1"
        >
          <div className="grid grid-cols-2 gap-3 w-full">
            {["Active", "Resolved"].map((label, i) => (
              <motion.span
                key={label}
                initial={false}
                animate={{ opacity: morphed ? 1 : 0 }}
                transition={{ delay: morphed ? 0.2 + i * 0.06 : 0, duration: 0.2 }}
                className="text-[10px] text-white/30 font-mono uppercase tracking-wider px-1"
              >
                {label}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Cards container — layout animates its own size change */}
      <motion.div
        layout
        transition={{
          layout: { type: "tween", duration: LAYOUT_DURATION, ease: EXPO_OUT },
        }}
        className={
          morphed
            ? "grid grid-cols-2 gap-3"
            : "rounded-b-2xl border-b border-x border-white/10 bg-white/3 overflow-hidden shadow-2xl shadow-black/40"
        }
      >
        {HERO_EMAILS.map((email, i) => (
          <HeroCard key={email.id} email={email} morphed={morphed} index={i} />
        ))}
      </motion.div>
    </div>
  )
}

// ─── exported component ────────────────────────────────────────────────────────

export default function HeroMorph({
  scrollYProgress,
}: {
  scrollYProgress: MotionValue<number>
}) {
  const reduced = useReducedMotion()
  const [morphed, setMorphed] = useState(false)

  useEffect(() => {
    // Hysteresis: engage at 0.28, disengage at 0.22 — prevents jitter at threshold
    const unsub = scrollYProgress.on("change", (v) => {
      setMorphed((prev) => (prev ? v >= 0.22 : v >= 0.28))
    })
    return unsub
  }, [scrollYProgress])

  if (reduced) {
    return <MorphPanel morphed />
  }

  return (
    <LayoutGroup>
      <MorphPanel morphed={morphed} />
    </LayoutGroup>
  )
}
