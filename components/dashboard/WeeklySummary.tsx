"use client"
import { useMemo, useState, useEffect } from "react"
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts"
import { ChevronDown, ChevronUp } from "lucide-react"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { type Application } from "@/types/application"

interface Props {
  applications: Application[]
}

const DAYS = 7
const LS_KEY = "dashboard-weekly-summary-collapsed"

function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short" })
}

export default function WeeklySummary({ applications }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY)
    if (saved === "1") setCollapsed(true)
  }, [])

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v
      localStorage.setItem(LS_KEY, next ? "1" : "0")
      return next
    })
  }

  const { data, thisWeek, lastWeek } = useMemo(() => {
    const today = startOfDay(new Date())
    const buckets: { date: Date; label: string; count: number }[] = []
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      buckets.push({ date: d, label: dayLabel(d), count: 0 })
    }

    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - DAYS)
    const twoWeeksAgo = new Date(today)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - DAYS * 2)

    let thisWeek = 0
    let lastWeek = 0

    for (const app of applications) {
      if (app.status === applicationStatus.NEEDS_REVIEW) continue
      if (!app.appliedAt) continue
      const applied = startOfDay(new Date(app.appliedAt))
      if (applied >= weekAgo && applied <= today) {
        thisWeek++
        const bucket = buckets.find((b) => b.date.getTime() === applied.getTime())
        if (bucket) bucket.count++
      } else if (applied >= twoWeeksAgo && applied < weekAgo) {
        lastWeek++
      }
    }

    return { data: buckets, thisWeek, lastWeek }
  }, [applications])

  const delta = thisWeek - lastWeek
  const deltaText =
    lastWeek === 0 && thisWeek === 0
      ? "No activity yet"
      : delta > 0
      ? `+${delta} vs. last week`
      : delta < 0
      ? `${delta} vs. last week`
      : "Same as last week"

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">This week</span>
          <span className="text-sm tabular-nums text-foreground">{thisWeek} applied</span>
          <span className="text-xs text-muted-foreground">{deltaText}</span>
        </div>
        {collapsed ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="size-4 text-muted-foreground" />
        )}
      </button>
      {!collapsed && (
        <div className="h-24 px-4 pb-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "currentColor" }}
                className="text-muted-foreground"
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
              <Bar dataKey="count" fill="#3B82F6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
