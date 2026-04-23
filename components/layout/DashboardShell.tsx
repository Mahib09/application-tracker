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
              ? "min-h-screen flex bg-background"
              : "h-screen flex bg-background overflow-hidden"
          }
        >
          <div className={scrollable ? "sticky top-0 h-screen self-start shrink-0" : "contents"}>
            <NavSidebar />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <NavBar />
            {!hideToolbar && (
              <div className="w-full px-6 lg:px-8">
                <Toolbar lastSyncedAt={lastSyncedAt} cooldownMs={cooldownMs} />
              </div>
            )}
            <div className={scrollable ? "flex-1 w-full px-6 lg:px-8 pb-2" : "flex-1 min-h-0 w-full px-6 lg:px-8 pb-2"}>
              {children}
            </div>
          </div>
        </div>
      </NavSidebarProvider>
    </CommandPaletteProvider>
  );
}
