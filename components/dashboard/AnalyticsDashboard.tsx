"use client"
import { useState } from "react"
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
} from "recharts"
import { STATUS_COLORS } from "@/lib/constants"
import { applicationStatus } from "@/app/generated/prisma/enums"

// ─── types ────────────────────────────────────────────────────────────────────

type Range = 30 | 60 | 90

interface RateWindow {
  rate: number
  responded: number
  total: number
}

interface Metrics {
  responseRate30: RateWindow
  responseRate60: RateWindow
  responseRate90: RateWindow
  ghostRate: { rate: number; ghosted: number; eligible: number }
  medianDays: number | null
  weeklyBuckets: { label: string; count: number }[]
  funnel: { total: number; interviews: number; offers: number; interviewRate: number; offerRate: number }
  source: { gmail: number; manual: number; total: number }
}

interface Props {
  metrics: Metrics
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function pct(rate: number) {
  return `${Math.round(rate * 100)}%`
}

type TrendDirection = "up" | "down" | "flat"

function trend(current: number, previous: number): { value: number; direction: TrendDirection } {
  if (previous === 0) return { value: 0, direction: "flat" }
  const delta = Math.round((current - previous) * 100)
  return {
    value: delta,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  }
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--color-foreground)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
}

// ─── small primitives ─────────────────────────────────────────────────────────

function DeltaInline({ value, direction }: { value: number; direction: TrendDirection }) {
  if (direction === "flat") return null
  const color =
    direction === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400"
  const arrow = direction === "up" ? "↑" : "↓"
  const sign = value > 0 ? "+" : ""
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${color}`}>
      {arrow} {sign}{value}pp
    </span>
  )
}

function Stat({
  label,
  value,
  delta,
  sub,
}: {
  label: string
  value: string
  delta?: { value: number; direction: TrendDirection }
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5">
      <div className="flex items-center justify-between min-h-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        {delta && <DeltaInline {...delta} />}
      </div>
      <p
        className="mt-4 font-semibold text-foreground tracking-tight tabular-nums"
        style={{ fontSize: "clamp(32px, 3vw, 44px)", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

function RangeSwitcher({
  value,
  onChange,
}: {
  value: Range
  onChange: (v: Range) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
      {([30, 60, 90] as Range[]).map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            value === d
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {d}d
        </button>
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-10 border border-dashed border-border rounded-lg bg-muted/30">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function AnalyticsDashboard({ metrics }: Props) {
  const [range, setRange] = useState<Range>(30)

  const {
    responseRate30, responseRate60, responseRate90,
    ghostRate, medianDays, weeklyBuckets, funnel, source,
  } = metrics

  // Pick rate window + compare window for delta
  const windowByRange: Record<Range, RateWindow> = {
    30: responseRate30,
    60: responseRate60,
    90: responseRate90,
  }
  const compareByRange: Record<Range, RateWindow | null> = {
    30: responseRate60,
    60: responseRate90,
    90: null,
  }
  const current = windowByRange[range]
  const compare = compareByRange[range]
  const responseTrend = compare && compare.total > 0 ? trend(current.rate, compare.rate) : null

  // Weekly chart totals
  const weeklyTotal = weeklyBuckets.reduce((sum, b) => sum + b.count, 0)
  const weeklyAvg = weeklyBuckets.length > 0 ? weeklyTotal / weeklyBuckets.length : 0

  const funnelData = [
    { name: "Applied",     value: funnel.total,      fill: STATUS_COLORS[applicationStatus.APPLIED] },
    { name: "Interviewed", value: funnel.interviews, fill: STATUS_COLORS[applicationStatus.INTERVIEW] },
    { name: "Offered",     value: funnel.offers,     fill: STATUS_COLORS[applicationStatus.OFFER] },
  ]

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            How your applications are tracking over time.
          </p>
        </div>
        <RangeSwitcher value={range} onChange={setRange} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={`Response rate (${range}d)`}
          value={pct(current.rate)}
          delta={responseTrend ?? undefined}
          sub={`${current.responded} of ${current.total} applications`}
        />
        <Stat
          label="Ghost rate"
          value={pct(ghostRate.rate)}
          sub={`${ghostRate.ghosted} of ${ghostRate.eligible} eligible`}
        />
        <Stat
          label="Median reply"
          value={medianDays != null ? `${Math.round(medianDays)}d` : "—"}
          sub={
            medianDays != null
              ? "days to first reply"
              : "Not enough data yet"
          }
        />
        <Stat
          label="Applications"
          value={String(funnel.total)}
          sub="tracked all-time"
        />
      </div>

      {/* Weekly volume */}
      <div className="rounded-xl border border-border bg-card px-5 py-5">
        <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-foreground">
              Applications per week
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Last 12 weeks</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {weeklyTotal}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                total
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              {weeklyAvg.toFixed(1)} / week average
            </p>
          </div>
        </div>

        {weeklyTotal === 0 ? (
          <EmptyState message="No applications in the last 12 weeks" />
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyBuckets} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="weeklyArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  className="text-muted-foreground"
                  interval={1}
                />
                <Tooltip
                  cursor={{ stroke: "#8B5CF6", strokeWidth: 1, strokeOpacity: 0.3 }}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  fill="url(#weeklyArea)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Funnel + Source */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Pipeline funnel */}
        <div className="rounded-xl border border-border bg-card px-5 py-5">
          <p className="text-sm font-medium text-foreground mb-5">
            Pipeline funnel
          </p>
          {funnel.total === 0 ? (
            <EmptyState message="No applications yet" />
          ) : (
            <div className="space-y-4">
              {funnelData.map(({ name, value, fill }, i) => {
                const pctOfTotal = funnel.total > 0 ? (value / funnel.total) * 100 : 0
                const prev = i > 0 ? funnelData[i - 1].value : null
                const stageConv = prev && prev > 0 ? Math.round((value / prev) * 100) : null
                return (
                  <div key={name}>
                    <div className="flex items-baseline justify-between mb-1.5 gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: fill }}
                        />
                        <span className="text-sm font-medium text-foreground">
                          {name}
                        </span>
                        {stageConv != null && (
                          <span className="text-[11px] text-muted-foreground truncate">
                            → {stageConv}% conversion
                          </span>
                        )}
                      </div>
                      <span className="font-mono tabular-nums text-sm text-foreground shrink-0">
                        {value}
                        <span className="text-muted-foreground font-normal ml-1">
                          ({Math.round(pctOfTotal)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pctOfTotal}%`, backgroundColor: fill }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Source breakdown */}
        <div className="rounded-xl border border-border bg-card px-5 py-5">
          <p className="text-sm font-medium text-foreground mb-5">
            Source breakdown
          </p>
          {source.total === 0 ? (
            <EmptyState message="No applications yet" />
          ) : (
            <div className="space-y-4">
              {[
                { label: "Gmail",  value: source.gmail,  color: "#3B82F6" },
                { label: "Manual", value: source.manual, color: "#8B5CF6" },
              ].map(({ label, value, color }) => {
                const pctOfTotal = source.total > 0 ? (value / source.total) * 100 : 0
                return (
                  <div key={label}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm font-medium text-foreground">
                          {label}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-sm text-foreground">
                        {value}
                        <span className="text-muted-foreground font-normal ml-1">
                          ({Math.round(pctOfTotal)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pctOfTotal}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                )
              })}
              <div className="pt-3 border-t border-border flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">
                  Total tracked
                </span>
                <span className="font-mono tabular-nums text-sm font-semibold text-foreground">
                  {source.total}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
