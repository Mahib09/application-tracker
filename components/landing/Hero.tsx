"use client"
import { useRef } from "react"
import { useScroll } from "motion/react"
import { signIn } from "next-auth/react"
import { ArrowRight } from "lucide-react"
import GrainOverlay from "./GrainOverlay"
import MouseGlow from "./MouseGlow"
import HeroMorph from "./HeroMorph"
import { LANDING_COPY } from "@/lib/landing/content"

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

export function SignInButton({ dark = false }: { dark?: boolean }) {
  if (dark) {
    return (
      <button
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm hover:bg-white/90 transition-all active:scale-[0.98]"
      >
        <GoogleIcon />
        {LANDING_COPY.hero.cta}
      </button>
    )
  }
  return (
    <button
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      className="inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background hover:opacity-90 transition-all active:scale-[0.98]"
    >
      <GoogleIcon />
      {LANDING_COPY.hero.cta}
    </button>
  )
}

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  })

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen lg:min-h-[200vh] bg-[#0A0A0B] text-white"
    >
      <GrainOverlay />
      <MouseGlow />

      {/* Sticky viewport wrapper — content stays in view while outer scrolls */}
      <div className="sticky top-0 h-screen">
        {/* Radial ambient behind text */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%)",
          }}
        />

        {/* Main content grid */}
        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 h-full flex items-center">
          <div className="grid lg:grid-cols-2 gap-16 items-center w-full pt-16">
            {/* Left — text */}
            <div className="flex flex-col items-start">
              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/60">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse motion-reduce:animate-none" />
                Currently in testing · invite only
              </span>

              <h1
                className="font-semibold tracking-[-0.04em] leading-[0.95] text-white"
                style={{ fontSize: "clamp(48px, 7vw, 112px)" }}
              >
                {LANDING_COPY.hero.h1}
              </h1>

              <p className="mt-7 text-lg leading-relaxed text-white/55 max-w-lg">
                {LANDING_COPY.hero.sub}
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <SignInButton dark />
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  {LANDING_COPY.hero.secondaryCta}
                  <ArrowRight className="size-3.5" />
                </a>
              </div>

              <p className="mt-6 text-xs text-white/25">
                No credit card. No paid tier.
              </p>
            </div>

            {/* Right — morph panel (desktop only) */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="w-full max-w-md">
                <HeroMorph scrollYProgress={scrollYProgress} />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom fade into light body */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-32"
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--color-background))",
          }}
        />
      </div>
    </section>
  )
}
