"use client"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import ThemeToggle from "@/components/layout/ThemeToggle"
import { Search, LogOut, BarChart3 } from "lucide-react"
import { Kbd } from "@/components/ui/kbd"
import { useCommandPalette } from "@/components/dashboard/CommandPaletteProvider"
import Link from "next/link"

export default function NavBar() {
  const { data: session } = useSession()
  const { open: openCommandPalette } = useCommandPalette()

  return (
    <header className="border-b border-border bg-card px-6 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="text-base font-semibold text-foreground tracking-tight">Paila</Link>
        <Link
          href="/dashboard/analytics"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <BarChart3 className="size-3.5" />
          Analytics
        </Link>
      </div>

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

        <div className="w-px h-5 bg-border" />

        {session?.user && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{session.user.name}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Sign out"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
