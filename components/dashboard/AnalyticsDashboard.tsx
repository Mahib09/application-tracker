"use client"
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts"
import { TrendingUp, Ghost, Clock, Layers, PieChart as PieIcon } from "lucide-react"

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

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string; sub?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

const PIE_COLORS = ["#3B82F6", "#8B5CF6"]

export default function AnalyticsDashboard({ metrics }: Props) {
  const { responseRate30, responseRate60, responseRate90, ghostRate, medianDays, weeklyBuckets, funnel, source } = metrics

  // Funnel bar data for horizontal stacked display
  const funnelData = [
    { name: "Applied", value: funnel.total, fill: "#3B82F6" },
    { name: "Interviewed", value: funnel.interviews, fill: "#F59E0B" },
    { name: "Offered", value: funnel.offers, fill: "#22C55E" },
  ]

  const sourceData = [
    { name: "Gmail", value: source.gmail },
    { name: "Manual", value: source.manual },
  ]

  return (
    <div className="py-4 space-y-6">
      <h1 className="text-lg font-semibold text-foreground">Analytics</h1>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Response rate (30d)"
          value={pct(responseRate30.rate)}
          sub={`${responseRate30.responded} of ${responseRate30.total} applications`}
        />
        <StatCard
          icon={TrendingUp}
          label="Response rate (60d)"
          value={pct(responseRate60.rate)}
          sub={`${responseRate60.responded} of ${responseRate60.total} applications`}
        />
        <StatCard
          icon={Ghost}
          label="Ghost rate"
          value={pct(ghostRate.rate)}
          sub={`${ghostRate.ghosted} of ${ghostRate.eligible} eligible`}
        />
        <StatCard
          icon={Clock}
          label="Median response"
          value={medianDays != null ? `${Math.round(medianDays)}d` : "—"}
          sub={medianDays != null ? "days from apply to first reply" : "Not enough data yet"}
        />
      </div>

      {/* Response rate window toggle */}
      <div className="rounded-lg border border-border bg-card px-4 py-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Response rate by window</p>
        <div className="flex gap-6 text-sm">
          {[
            { label: "30 days", r: responseRate30 },
            { label: "60 days", r: responseRate60 },
            { label: "90 days", r: responseRate90 },
          ].map(({ label, r }) => (
            <div key={label}>
              <span className="tabular-nums font-semibold text-foreground">{pct(r.rate)}</span>
              <span className="ml-1.5 text-muted-foreground text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly applications bar chart */}
      <div className="rounded-lg border border-border bg-card px-4 py-4">
        <p className="text-sm font-medium text-foreground mb-3">Applications per week (last 12 weeks)</p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyBuckets} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "currentColor" }}
                className="text-muted-foreground"
                interval={2}
              />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 11,
                }}
              />
              <Bar dataKey="count" fill="#3B82F6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Funnel + Source row */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Status funnel */}
        <div className="rounded-lg border border-border bg-card px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Pipeline funnel</p>
          </div>
          <div className="space-y-3">
            {funnelData.map(({ name, value, fill }) => {
              const pctWidth = funnel.total > 0 ? (value / funnel.total) * 100 : 0
              const rate = funnel.total > 0 ? value / funnel.total : 0
              return (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="tabular-nums font-medium text-foreground">
                      {value} <span className="text-muted-foreground font-normal">({pct(rate)})</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pctWidth}%`, backgroundColor: fill }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Source breakdown */}
        <div className="rounded-lg border border-border bg-card px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <PieIcon className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Source breakdown</p>
          </div>
          {source.total === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No applications yet</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                    labelLine={false}
                  >
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
