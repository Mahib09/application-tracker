"use client"
import { signIn } from "next-auth/react"
import { LANDING_COPY } from "@/lib/landing/content"

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

export default function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[#0A0A0B] py-32 text-center text-white">
      {/* Subtle radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 100%, rgba(99,102,241,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
        <h2
          className="font-semibold tracking-[-0.03em] leading-[1.05] text-white"
          style={{ fontSize: "clamp(32px, 4vw, 60px)" }}
        >
          Ready to let your inbox do the tracking?
        </h2>

        <p className="mt-5 text-base text-white/50 max-w-lg mx-auto leading-relaxed">
          {LANDING_COPY.hero.sub}
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="inline-flex items-center gap-2.5 rounded-xl bg-white px-8 py-4 text-base font-semibold text-gray-900 shadow-sm hover:bg-white/90 transition-all active:scale-[0.98]"
          >
            <GoogleIcon />
            {LANDING_COPY.hero.cta}
          </button>
          <p className="text-xs text-white/25">
            No credit card. No paid tier. Invite-only during testing.
          </p>
        </div>
      </div>
    </section>
  )
}
