"use client"
import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Privacy", href: "#privacy" },
  { label: "FAQ", href: "#faq" },
]

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <motion.nav
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`fixed top-2 left-0 right-0 z-40 mx-auto max-w-7xl px-6 lg:px-8`}
    >
      <div
        className={`flex items-center justify-between rounded-2xl px-5 py-3 backdrop-blur-md transition-all duration-300 ${
          scrolled
            ? "bg-background/80 border border-border shadow-sm"
            : "bg-transparent"
        }`}
      >
        {/* Wordmark */}
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Paila
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/login"
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Sign in
        </Link>
      </div>
    </motion.nav>
  )
}
