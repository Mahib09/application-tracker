"use client"
import { motion } from "motion/react"
import { useReducedMotion } from "@/lib/hooks/useReducedMotion"

const EXPO_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number]

const EYEBROW_STYLES: Record<string, string> = {
  blue:    "text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950/50",
  violet:  "text-violet-600 border-violet-200 bg-violet-50 dark:text-violet-400 dark:border-violet-800 dark:bg-violet-950/50",
  emerald: "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/50",
  amber:   "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950/50",
  neutral: "text-muted-foreground border-border bg-muted",
}

interface FeatureBlockProps {
  eyebrow: string
  eyebrowColor: keyof typeof EYEBROW_STYLES
  title: string
  description: string
  bullets?: string[]
  visual: React.ReactNode
  imageRight?: boolean
}

export default function FeatureBlock({
  eyebrow,
  eyebrowColor,
  title,
  description,
  bullets,
  visual,
  imageRight = true,
}: FeatureBlockProps) {
  const reduced = useReducedMotion()

  const textEl = (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.65, ease: EXPO_OUT }}
      className="flex flex-col justify-center"
    >
      <span
        className={`inline-flex w-fit items-center rounded border px-2 py-0.5 font-mono text-[11px] font-medium mb-5 ${EYEBROW_STYLES[eyebrowColor]}`}
      >
        [{eyebrow}]
      </span>

      <h3
        className="font-semibold tracking-[-0.02em] text-foreground leading-tight"
        style={{ fontSize: "clamp(26px, 3vw, 40px)" }}
      >
        {title}
      </h3>

      <p className="mt-4 text-base text-muted-foreground leading-relaxed max-w-md">
        {description}
      </p>

      {bullets && bullets.length > 0 && (
        <ul className="mt-5 space-y-2">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <span className="mt-1.5 size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  )

  const visualEl = (
    <motion.div
      initial={reduced ? false : { opacity: 0, x: imageRight ? 32 : -32 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.7, ease: EXPO_OUT, delay: 0.08 }}
    >
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {visual}
      </div>
    </motion.div>
  )

  return (
    <div className="py-16 lg:py-20">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        {imageRight ? textEl : visualEl}
        {imageRight ? visualEl : textEl}
      </div>
    </div>
  )
}
