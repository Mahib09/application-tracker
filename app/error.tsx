"use client"
import { useEffect } from "react"
import Link from "next/link"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md space-y-4">
        <Link
          href="/"
          className="block text-sm font-semibold tracking-tight text-foreground/50 hover:text-foreground transition-colors mb-8"
        >
          Paila
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Something broke.
        </h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          An unexpected error occurred. You can try again — if the problem
          persists, it&apos;s on us.
        </p>

        {error.digest && (
          <p className="text-[11px] font-mono text-muted-foreground/40">
            ref: {error.digest}
          </p>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  )
}
