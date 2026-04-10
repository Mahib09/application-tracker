"use client"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import ThemeToggle from "@/components/layout/ThemeToggle"
import { Search, LogOut } from "lucide-react"
import { Kbd } from "@/components/ui/kbd"

interface NavBarProps {
  onOpenCommandPalette?: () => void
}

export default function NavBar({ onOpenCommandPalette }: NavBarProps) {
  const { data: session } = useSession()

  return (
    <header className="border-b border-border bg-card px-6 py-2.5 flex items-center justify-between">
      <span className="text-base font-semibold text-foreground tracking-tight">Paila</span>

      <div className="flex items-center gap-2">
        {/* Cmd+K search pill — placeholder, wired in Phase 4 */}
        <button
          onClick={onOpenCommandPalette}
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
