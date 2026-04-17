"use client"
import NavBar from "@/components/layout/NavBar"
import Toolbar from "@/components/layout/Toolbar"
import CommandPaletteProvider from "@/components/dashboard/CommandPaletteProvider"

interface DashboardShellProps {
  lastSyncedAt: Date | null
  cooldownMs: number
  hideToolbar?: boolean
  children: React.ReactNode
}

export default function DashboardShell({ lastSyncedAt, cooldownMs, hideToolbar, children }: DashboardShellProps) {
  return (
    <CommandPaletteProvider>
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        <NavBar />
        {!hideToolbar && (
          <div className="max-w-7xl mx-auto w-full px-6">
            <Toolbar lastSyncedAt={lastSyncedAt} cooldownMs={cooldownMs} />
          </div>
        )}
        <div className="flex-1 min-h-0 max-w-7xl mx-auto w-full px-6 pb-2">
          {children}
        </div>
      </div>
    </CommandPaletteProvider>
  )
}
