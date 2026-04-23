interface SectionHeaderProps {
  number?: string
  title: string
  subtitle?: string
  light?: boolean
}

export default function SectionHeader({
  number,
  title,
  subtitle,
  light = false,
}: SectionHeaderProps) {
  return (
    <div className="relative mb-16">
      {number && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-8 left-0 select-none font-bold leading-none opacity-[0.06]"
          style={{ fontSize: "180px", color: light ? "#fff" : "currentColor" }}
        >
          {number}
        </span>
      )}
      <h2
        className="relative z-10 font-semibold tracking-[-0.02em]"
        style={{ fontSize: "clamp(36px, 4vw, 64px)" }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-3 text-lg ${light ? "text-white/60" : "text-muted-foreground"}`}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}
