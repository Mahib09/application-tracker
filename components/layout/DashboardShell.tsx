"use client"
import NavBar from "@/components/layout/NavBar"
import Toolbar from "@/components/layout/Toolbar"
import CommandPaletteProvider from "@/components/dashboard/CommandPaletteProvider"

interface DashboardShellProps {
  lastSyncedAt: Date | null
  cooldownMs: number
  children: React.ReactNode
}

export default function DashboardShell({ lastSyncedAt, cooldownMs, children }: DashboardShellProps) {
  return (
    <CommandPaletteProvider>
      <div className="min-h-screen bg-background">
        <NavBar />
        <div className="max-w-7xl mx-auto px-6">
          <Toolbar lastSyncedAt={lastSyncedAt} cooldownMs={cooldownMs} />
          {children}
        </div>
      </div>
    </CommandPaletteProvider>
  )
}
