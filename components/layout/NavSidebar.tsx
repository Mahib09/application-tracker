"use client"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import { useNavSidebar } from "@/components/layout/NavSidebarProvider"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"
import { useReducedMotion } from "@/lib/hooks/useReducedMotion"
import { LayoutDashboard, BarChart3, Inbox, Bell, Settings, LogOut } from "lucide-react"
import { useEffect } from "react"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/review", label: "Review queue", icon: Inbox },
  { href: "/dashboard/followups", label: "Follow-ups", icon: Bell },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

const spring = { type: "spring" as const, stiffness: 400, damping: 35 }

export default function NavSidebar() {
  const { isOpen, close } = useNavSidebar()
  const pathname = usePathname()
  const { data: session } = useSession()
  const isMobile = useMediaQuery("(max-width: 767px)")
  const reduced = useReducedMotion()

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, close])

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const initials = session?.user?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "?"

  const sidebarContent = (
    <div className="flex flex-col h-full w-60 bg-card border-r border-border">
      {/* Logo */}
      <div className="px-4 py-4">
        <span className="text-base font-semibold text-foreground tracking-tight">Paila</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              onClick={() => { if (isMobile) close() }}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      {session?.user && (
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{session.user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // Mobile: overlay drawer
  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />
            {/* Drawer */}
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 shadow-2xl"
              initial={reduced ? { opacity: 0 } : { x: "-100%" }}
              animate={reduced ? { opacity: 1 } : { x: 0 }}
              exit={reduced ? { opacity: 0 } : { x: "-100%" }}
              transition={reduced ? { duration: 0 } : spring}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    )
  }

  // Desktop: push layout
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          className="shrink-0 overflow-hidden"
          initial={reduced ? { opacity: 0 } : { width: 0 }}
          animate={reduced ? { opacity: 1 } : { width: 240 }}
          exit={reduced ? { opacity: 0 } : { width: 0 }}
          transition={reduced ? { duration: 0 } : spring}
        >
          {sidebarContent}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
