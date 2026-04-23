"use client"
import { motion } from "motion/react"
import { useReducedMotion } from "@/lib/hooks/useReducedMotion"
import SectionHeader from "./SectionHeader"

const EXPO_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number]

const CARDS = [
  {
    tag: "current status",
    title: "Invite-only during testing",
    body: "Built by a solo developer. Currently in Google's OAuth testing program — limited to 100 users while I complete verification. If you want early access, send me an email.",
    cta: { label: "magarmahib@gmail.com", href: "mailto:magarmahib@gmail.com" },
  },
  {
    tag: "the stack",
    title: "Open and inspectable",
    body: "Next.js 16, Postgres on Supabase, Claude for classification. The code is on GitHub — you can see exactly what it does with your Gmail before you sign in.",
    cta: { label: "View on GitHub →", href: "https://github.com/Mahib09/paila" },
  },
  {
    tag: "roadmap",
    title: "Honest about what's next",
    body: "Working on: company-level grouping, application deadlines, better mobile layout. Not working on: paid tier, enterprise SSO, team features. This is a personal tool that happens to work well.",
    cta: null,
  },
]

export default function NotesFromBuild() {
  const reduced = useReducedMotion()

  return (
    <section className="py-24 lg:py-32 bg-background">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          number="05"
          title="Notes from the build"
          subtitle="Transparent about what this is."
        />

        <div className="grid lg:grid-cols-3 gap-6">
          {CARDS.map(({ tag, title, body, cta }, i) => (
            <motion.div
              key={tag}
              initial={reduced ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.6, ease: EXPO_OUT, delay: i * 0.1 }}
              className="rounded-xl border border-border bg-card px-6 py-6 flex flex-col gap-4"
            >
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                {tag}
              </span>

              <div className="flex-1">
                <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>

              {cta && (
                <a
                  href={cta.href}
                  target={cta.href.startsWith("http") ? "_blank" : undefined}
                  rel={cta.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="text-sm text-foreground/70 hover:text-foreground transition-colors underline underline-offset-4 decoration-border w-fit"
                >
                  {cta.label}
                </a>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
