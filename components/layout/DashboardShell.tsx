"use client";
import NavBar from "@/components/layout/NavBar";
import NavSidebar from "@/components/layout/NavSidebar";
import { NavSidebarProvider } from "@/components/layout/NavSidebarProvider";
import Toolbar from "@/components/layout/Toolbar";
import CommandPaletteProvider from "@/components/dashboard/CommandPaletteProvider";

interface DashboardShellProps {
  lastSyncedAt: Date | null;
  cooldownMs: number;
  hideToolbar?: boolean;
  scrollable?: boolean;
  children: React.ReactNode;
}

export default function DashboardShell({
  lastSyncedAt,
  cooldownMs,
  hideToolbar,
  scrollable,
  children,
}: DashboardShellProps) {
  return (
    <CommandPaletteProvider>
      <NavSidebarProvider>
        <div
          className={
            scrollable
              ? "min-h-screen flex flex-col bg-background"
              : "h-screen flex bg-background overflow-hidden"
          }
        >
          <NavSidebar />
          <div className="flex-1 flex flex-col min-w-0">
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
        </div>
      </NavSidebarProvider>
    </CommandPaletteProvider>
  );
}
