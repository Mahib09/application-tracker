"use client"
import ThemeToggle from "@/components/layout/ThemeToggle"
import { useNavSidebar } from "@/components/layout/NavSidebarProvider"
import { Search, PanelLeft, PanelLeftClose } from "lucide-react"
import { Kbd } from "@/components/ui/kbd"
import { useCommandPalette } from "@/components/dashboard/CommandPaletteProvider"

export default function NavBar() {
  const { open: openCommandPalette } = useCommandPalette()
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useNavSidebar()

  return (
    <header className="border-b border-border bg-card px-4 py-2.5 flex items-center justify-between">
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
      >
        {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
      </button>

      <div className="flex items-center gap-2">
        <button
          onClick={openCommandPalette}
          className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
        >
          <Search className="size-3" />
          <span>Search...</span>
          <Kbd className="ml-1">⌘K</Kbd>
        </button>

        <ThemeToggle />
      </div>
    </header>
  )
}
