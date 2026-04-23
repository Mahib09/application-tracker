"use client"
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts"
import {
  TrendingUp, TrendingDown, Minus, Ghost, Clock, Layers,
  PieChart as PieIcon, Calendar,
} from "lucide-react"
import { STATUS_COLORS } from "@/lib/constants"
import { applicationStatus } from "@/app/generated/prisma/enums"

interface Metrics {
  responseRate30: { rate: number; responded: number; total: number }
  responseRate60: { rate: number; responded: number; total: number }
  responseRate90: { rate: number; responded: number; total: number }
  ghostRate: { rate: number; ghosted: number; eligible: number }
  medianDays: number | null
  weeklyBuckets: { label: string; count: number }[]
  funnel: { total: number; interviews: number; offers: number; interviewRate: number; offerRate: number }
  source: { gmail: number; manual: number; total: number }
}

interface Props {
  metrics: Metrics
}

function pct(rate: number) {
  return `${Math.round(rate * 100)}%`
}

function trend(current: number, previous: number) {
  if (previous === 0) return { delta: 0, direction: "flat" as const }
  const delta = Math.round((current - previous) * 100)
  return {
    delta,
    direction: delta > 0 ? ("up" as const) : delta < 0 ? ("down" as const) : ("flat" as const),
  }
}

function TrendPill({ delta, direction }: { delta: number; direction: "up" | "down" | "flat" }) {
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus
  const cls =
    direction === "up"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : direction === "down"
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      : "bg-muted text-muted-foreground"
  const sign = delta > 0 ? "+" : ""
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      <Icon className="size-2.5" />
      {sign}{delta}pp
    </span>
  )
}

type StatTone = "blue" | "violet" | "amber" | "emerald"

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  trendPill,
}: {
  icon: React.ElementType
  tone: StatTone
  label: string
  value: string
  sub?: string
  trendPill?: React.ReactNode
}) {
  const toneClass = {
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  }[tone]
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex size-8 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="size-4" />
        </span>
        {trendPill}
      </div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tabular-nums text-foreground mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--color-foreground)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
}

export default function AnalyticsDashboard({ metrics }: Props) {
  const { responseRate30, responseRate60, responseRate90, ghostRate, medianDays, weeklyBuckets, funnel, source } = metrics

  const responseTrend = trend(responseRate30.rate, responseRate60.rate)

  const funnelData = [
    { name: "Applied",     value: funnel.total,      fill: STATUS_COLORS[applicationStatus.APPLIED] },
    { name: "Interviewed", value: funnel.interviews, fill: STATUS_COLORS[applicationStatus.INTERVIEW] },
    { name: "Offered",     value: funnel.offers,     fill: STATUS_COLORS[applicationStatus.OFFER] },
  ]

  const sourceData = [
    { name: "Gmail",  value: source.gmail,  fill: "#3B82F6" },
    { name: "Manual", value: source.manual, fill: "#8B5CF6" },
  ]

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          How your applications are tracking over time.
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          tone="blue"
          label="Response rate (30d)"
          value={pct(responseRate30.rate)}
          sub={`${responseRate30.responded} of ${responseRate30.total}`}
          trendPill={responseRate60.total > 0 ? <TrendPill {...responseTrend} /> : null}
        />
        <StatCard
          icon={TrendingUp}
          tone="violet"
          label="Response rate (60d)"
          value={pct(responseRate60.rate)}
          sub={`${responseRate60.responded} of ${responseRate60.total}`}
        />
        <StatCard
          icon={Ghost}
          tone="amber"
          label="Ghost rate"
          value={pct(ghostRate.rate)}
          sub={`${ghostRate.ghosted} of ${ghostRate.eligible} eligible`}
        />
        <StatCard
          icon={Clock}
          tone="emerald"
          label="Median response"
          value={medianDays != null ? `${Math.round(medianDays)}d` : "—"}
          sub={medianDays != null ? "days to first reply" : "Not enough data yet"}
        />
      </div>

      {/* Response rate by window */}
      <div className="rounded-xl border border-border bg-card px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Response rate by window</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "30 days", r: responseRate30, tone: "bg-blue-500" },
            { label: "60 days", r: responseRate60, tone: "bg-violet-500" },
            { label: "90 days", r: responseRate90, tone: "bg-emerald-500" },
          ].map(({ label, r, tone }) => (
            <div key={label} className="rounded-lg border border-border bg-background px-3 py-2">
              <div className={`h-1 w-8 rounded-full ${tone} mb-2`} />
              <p className="text-xl font-semibold tabular-nums text-foreground">{pct(r.rate)}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly applications bar chart */}
      <div className="rounded-xl border border-border bg-card px-4 py-4">
        <p className="text-sm font-medium text-foreground mb-3">
          Applications per week <span className="text-muted-foreground font-normal">· last 12 weeks</span>
        </p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyBuckets} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="weeklyBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "currentColor" }}
                className="text-muted-foreground"
                interval={2}
              />
              <Tooltip cursor={{ fill: "rgba(59,130,246,0.08)" }} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="url(#weeklyBarGradient)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Funnel + Source row */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Pipeline funnel */}
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Pipeline funnel</p>
          </div>
          <div className="space-y-3">
            {funnelData.map(({ name, value, fill }, i) => {
              const pctWidth = funnel.total > 0 ? (value / funnel.total) * 100 : 0
              const rate = funnel.total > 0 ? value / funnel.total : 0
              const prev = i > 0 ? funnelData[i - 1].value : null
              const stageConv = prev && prev > 0 ? Math.round((value / prev) * 100) : null
              return (
                <div key={name}>
                  <div className="flex justify-between items-baseline text-xs mb-1">
                    <span className="text-foreground font-medium">{name}</span>
                    <span className="tabular-nums text-foreground">
                      {value}
                      <span className="text-muted-foreground font-normal"> ({pct(rate)})</span>
                      {stageConv != null && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {stageConv}% of prev
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pctWidth}%`, backgroundColor: fill }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Source breakdown */}
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <PieIcon className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Source breakdown</p>
          </div>
          {source.total === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No applications yet</p>
          ) : (
            <div className="relative h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={78}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                    labelLine={false}
                  >
                    {sourceData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center -mt-4">
                <p className="text-2xl font-semibold tabular-nums text-foreground">{source.total}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
