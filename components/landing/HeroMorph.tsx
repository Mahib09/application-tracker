"use client"
import { useEffect, useState } from "react"
import type { MotionValue } from "motion/react"
import { motion, LayoutGroup, AnimatePresence } from "motion/react"
import { MoreHorizontal } from "lucide-react"
import { useReducedMotion } from "@/lib/hooks/useReducedMotion"
import { HERO_EMAILS, type HeroEmail } from "@/lib/landing/content"
import { STATUS_COLORS, STATUS_CONFIG } from "@/lib/constants"

// ─── local primitives ─────────────────────────────────────────────────────────

const AVATAR_COLORS: Record<string, string> = {
  Stripe: "#635BFF",
  Linear: "#5E6AD2",
  Vercel: "#000000",
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

function StatusPill({ status }: { status: HeroEmail["status"] }) {
  const color = STATUS_COLORS[status]
  const label = STATUS_CONFIG[status].label
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
      style={{ backgroundColor: `${color}30`, border: `1px solid ${color}60` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

// ─── card content variants ────────────────────────────────────────────────────

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
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <Avatar company={email.company} />
        <span className="text-sm font-medium text-white/90">{email.company}</span>
      </div>
      <p className="text-xs text-white/50 leading-relaxed line-clamp-2">
        {email.snippet}
      </p>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 + index * 0.06, duration: 0.25 }}
      >
        <StatusPill status={email.status} />
      </motion.div>
    </div>
  )
}

// ─── shared card — layoutId handles the FLIP ──────────────────────────────────

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
      transition={{
        layout: {
          delay: index * 0.06,
          type: "spring",
          stiffness: 260,
          damping: 30,
        },
      }}
      className={
        morphed
          ? "rounded-xl border border-white/8 bg-white/4 overflow-hidden"
          : "border-b border-white/6 last:border-0"
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={morphed ? "kanban" : "inbox"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, delay: morphed ? 0.12 + index * 0.05 : 0 }}
        >
          {morphed ? (
            <KanbanContent email={email} index={index} />
          ) : (
            <InboxContent email={email} />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

// ─── panel that switches between inbox and kanban layouts ─────────────────────

function MorphPanel({ morphed }: { morphed: boolean }) {
  return (
    <div className="w-full">
      <AnimatePresence mode="popLayout" initial={false}>
        {morphed ? (
          <motion.div
            key="kanban-header"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 gap-3 mb-2"
          >
            <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider px-1">
              Active
            </span>
            <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider px-1">
              Resolved
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="inbox-header"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-between px-4 py-3 border-b border-white/6 rounded-t-2xl border-x border-t border-white/10 bg-white/3"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/70">Inbox</span>
              <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-mono font-medium text-blue-400">
                {HERO_EMAILS.length}
              </span>
            </div>
            <MoreHorizontal className="size-4 text-white/30" />
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={
          morphed
            ? "grid grid-cols-2 gap-3"
            : "rounded-b-2xl border-b border-x border-white/10 bg-white/3 overflow-hidden shadow-2xl shadow-black/40"
        }
      >
        {HERO_EMAILS.map((email, i) => (
          <HeroCard key={email.id} email={email} morphed={morphed} index={i} />
        ))}
      </div>
    </div>
  )
}

// ─── main export ──────────────────────────────────────────────────────────────

export default function HeroMorph({
  scrollYProgress,
}: {
  scrollYProgress: MotionValue<number>
}) {
  const reduced = useReducedMotion()
  const [morphed, setMorphed] = useState(false)

  useEffect(() => {
    const unsub = scrollYProgress.on("change", (v) => {
      setMorphed(v >= 0.3)
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
