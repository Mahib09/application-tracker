import Link from "next/link"

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      {/* Oversized numeral */}
      <p
        aria-hidden
        className="pointer-events-none absolute select-none font-bold text-foreground opacity-[0.04] leading-none"
        style={{ fontSize: "clamp(160px, 30vw, 320px)" }}
      >
        404
      </p>

      <div className="relative z-10 space-y-4 max-w-md">
        <Link
          href="/"
          className="block text-sm font-semibold tracking-tight text-foreground/50 hover:text-foreground transition-colors mb-8"
        >
          Paila
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          This page doesn&apos;t exist.
        </h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          It either never existed or we lost it.
          Either way, probably not your fault.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background hover:opacity-90 transition-opacity mt-4"
        >
          ← Back to home
        </Link>
      </div>
    </main>
  )
}
