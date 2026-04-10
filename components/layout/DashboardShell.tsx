"use client"
import { useState } from "react"
import NavBar from "@/components/layout/NavBar"
import Toolbar from "@/components/layout/Toolbar"

type ViewMode = "table" | "kanban"

interface DashboardShellProps {
  lastSyncedAt: Date | null
  cooldownMs: number
  children: React.ReactNode
}

export default function DashboardShell({ lastSyncedAt, cooldownMs, children }: DashboardShellProps) {
  const [view, setView] = useState<ViewMode>("table")

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="max-w-7xl mx-auto px-6">
        <Toolbar
          lastSyncedAt={lastSyncedAt}
          cooldownMs={cooldownMs}
          view={view}
          onViewChange={setView}
        />
        {children}
      </div>
    </div>
  )
}
