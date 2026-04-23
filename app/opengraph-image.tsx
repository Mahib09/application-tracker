import { ImageResponse } from "next/og"

export const runtime = "edge"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0A0A0B",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 90px",
          position: "relative",
        }}
      >
        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(ellipse 70% 70% at 20% 50%, rgba(99,102,241,0.18) 0%, transparent 65%)",
          }}
        />

        {/* Wordmark */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "rgba(255,255,255,0.35)",
            marginBottom: 52,
            letterSpacing: "-0.02em",
            display: "flex",
          }}
        >
          Paila
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            color: "white",
            lineHeight: 0.95,
            letterSpacing: "-0.04em",
            maxWidth: 950,
            display: "flex",
          }}
        >
          The application tracker that tracks itself.
        </div>

        {/* Subhead */}
        <div
          style={{
            fontSize: 24,
            color: "rgba(255,255,255,0.38)",
            marginTop: 36,
            maxWidth: 680,
            lineHeight: 1.5,
            display: "flex",
          }}
        >
          Connect Gmail once. Paila classifies every reply automatically.
        </div>

        {/* Status pills row */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 52,
          }}
        >
          {[
            { label: "Applied",   color: "#3B82F6" },
            { label: "Interview", color: "#F59E0B" },
            { label: "Offer",     color: "#22C55E" },
            { label: "Ghosted",   color: "#8B5CF6" },
          ].map(({ label, color }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: `${color}22`,
                border: `1px solid ${color}55`,
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 14,
                fontWeight: 600,
                color: "white",
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: color,
                }}
              />
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
