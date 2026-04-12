"use client"

interface Props {
  daysSince: number
  size?: number
}

const GHOST_AT = 30

export default function GhostProgressRing({ daysSince, size = 16 }: Props) {
  const progress = Math.min(1, daysSince / GHOST_AT)
  const stroke = 2
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - progress)

  const color = daysSince >= 28 ? "#8B5CF6" : daysSince >= 20 ? "#F59E0B" : "#9CA3AF"

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-label={`${daysSince} days since update`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-border"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 300ms ease-out" }}
      />
    </svg>
  )
}
