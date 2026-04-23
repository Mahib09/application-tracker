"use client"
import { motion } from "motion/react"
import { Check, X } from "lucide-react"
import Link from "next/link"
import SectionHeader from "./SectionHeader"
import { useReducedMotion } from "@/lib/hooks/useReducedMotion"

const EXPO_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number]

const READS = [
  "Email subject lines of recent mail",
  "Short snippets (first ~120 characters)",
  "Sender address, to link emails to companies",
  "Nothing more",
]

const NEVER = [
  "Full email bodies",
  "Attachments of any kind",
  "Your contacts or address book",
  "Drafts, sent mail, or anything you wrote",
  "Emails older than the sync window",
]

export default function PrivacyDeepDive() {
  const reduced = useReducedMotion()

  return (
    <section id="privacy" className="bg-[#111113] text-white py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          number="04"
          title="Privacy, spelled out"
          subtitle="Your inbox stays your inbox."
          light
        />

        {/* Two-column read / never-touch */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 mt-4">
          {/* Left — what we read */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.65, ease: EXPO_OUT }}
          >
            <p className="text-xs font-mono uppercase tracking-widest text-white/40 mb-5">
              What we read
            </p>
            <ul className="space-y-3">
              {READS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                    <Check className="size-3 text-emerald-400" />
                  </span>
                  <span className="text-sm text-white/80 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Right — what we never touch */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.65, ease: EXPO_OUT, delay: 0.2 }}
          >
            <p className="text-xs font-mono uppercase tracking-widest text-white/40 mb-5">
              What we never touch
            </p>
            <ul className="space-y-3">
              {NEVER.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                    <X className="size-3 text-red-400" />
                  </span>
                  <span className="text-sm text-white/40 leading-relaxed line-through decoration-white/20">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* OAuth scope block */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: EXPO_OUT, delay: 0.3 }}
          className="mt-12 rounded-xl border border-white/8 bg-white/4 px-5 py-4 font-mono text-xs"
        >
          <p className="text-white/30 mb-2 text-[10px] uppercase tracking-widest">
            OAuth scope requested
          </p>
          <p className="text-white/70">
            <span className="text-white/40">scope: </span>
            <span className="text-emerald-400">
              https://www.googleapis.com/auth/gmail.readonly
            </span>
          </p>
          <p className="text-white/70 mt-1">
            <span className="text-white/40">format: </span>
            <span className="text-blue-400">minimal</span>
          </p>
        </motion.div>

        {/* Explanatory paragraph */}
        <motion.p
          initial={reduced ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.7, ease: EXPO_OUT, delay: 0.35 }}
          className="mt-8 text-sm text-white/45 leading-relaxed max-w-2xl italic"
        >
          We fetch subjects and snippets, classify them, and store the result. The
          subject lines and snippets themselves are discarded after classification —
          we don&apos;t keep them in our database. You can disconnect Gmail or delete
          your account from Settings at any time.
        </motion.p>

        {/* Link to full policy */}
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.5, ease: EXPO_OUT, delay: 0.4 }}
          className="mt-6"
        >
          <Link
            href="/privacy"
            className="text-sm text-white/50 hover:text-white/80 transition-colors underline underline-offset-4 decoration-white/20"
          >
            Read the full privacy policy →
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
