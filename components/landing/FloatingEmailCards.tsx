"use client"
import { motion } from "motion/react"
import { useReducedMotion } from "@/lib/hooks/useReducedMotion"
import { STATUS_COLORS } from "@/lib/constants"
import { applicationStatus } from "@/app/generated/prisma/enums"

const CARDS = [
  {
    company: "Notion",
    subject: "Re: Product Designer application",
    status: applicationStatus.GHOSTED,
    offset: { x: -60, y: 0 },
    delay: 0,
  },
  {
    company: "Figma",
    subject: "Thanks for applying — next steps",
    status: applicationStatus.INTERVIEW,
    offset: { x: 60, y: 20 },
    delay: 0.5,
  },
]

export default function FloatingEmailCards() {
  const reduced = useReducedMotion()
  if (reduced) return null

  return (
    <div aria-hidden className="pointer-events-none relative h-0 overflow-visible">
      {CARDS.map(({ company, subject, status, offset, delay }) => {
        const color = STATUS_COLORS[status]
        return (
          <motion.div
            key={company}
            className="absolute"
            style={{ left: `calc(50% + ${offset.x}px)`, top: offset.y }}
            animate={{ y: [0, -8, 0] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay,
            }}
          >
            <div
              className="rounded-xl border border-border bg-card/80 backdrop-blur-sm px-4 py-3 shadow-md opacity-40"
              style={{ minWidth: 220 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs font-medium text-foreground">{company}</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{subject}</p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
