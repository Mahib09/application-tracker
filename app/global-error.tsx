"use client"
import { useEffect } from "react"

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "16px",
          fontFamily: "system-ui, sans-serif",
          background: "#fafafa",
          color: "#111",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, opacity: 0.4, marginBottom: 16 }}>
          Paila
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>
          Something went seriously wrong.
        </h1>
        <p style={{ fontSize: 14, color: "#666", maxWidth: 360, lineHeight: 1.6, margin: 0 }}>
          The application encountered a root-level error. Try refreshing the
          page.
        </p>
        {error.digest && (
          <p style={{ fontSize: 11, fontFamily: "monospace", color: "#aaa", margin: 0 }}>
            ref: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            padding: "10px 24px",
            borderRadius: 12,
            border: "none",
            background: "#111",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
