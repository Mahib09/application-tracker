"use client"
import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"

interface NavSidebarContextValue {
  isOpen: boolean
  toggle: () => void
  close: () => void
}

const NavSidebarContext = createContext<NavSidebarContextValue | null>(null)

const STORAGE_KEY = "nav-sidebar-open"

export function NavSidebarProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 767px)")
  const [isOpen, setIsOpen] = useState(false)

  // Read localStorage on mount (desktop only)
  useEffect(() => {
    if (isMobile) return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "true") setIsOpen(true)
    } catch {}
  }, [isMobile])

  // Close on mobile when switching to mobile breakpoint
  useEffect(() => {
    if (isMobile) setIsOpen(false)
  }, [isMobile])

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      if (!isMobile) {
        try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      }
      return next
    })
  }, [isMobile])

  const close = useCallback(() => {
    setIsOpen(false)
    if (!isMobile) {
      try { localStorage.setItem(STORAGE_KEY, "false") } catch {}
    }
  }, [isMobile])

  return (
    <NavSidebarContext.Provider value={{ isOpen, toggle, close }}>
      {children}
    </NavSidebarContext.Provider>
  )
}

export function useNavSidebar() {
  const ctx = useContext(NavSidebarContext)
  if (!ctx) throw new Error("useNavSidebar must be used within NavSidebarProvider")
  return ctx
}
