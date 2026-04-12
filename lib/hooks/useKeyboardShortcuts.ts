"use client"
import { useEffect } from "react"

type Handler = (e: KeyboardEvent) => void

export interface ShortcutMap {
  [key: string]: Handler
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (target.isContentEditable) return true
  return false
}

/**
 * Global keydown dispatcher. Keys are matched case-insensitively.
 * Shortcuts are suppressed when focus is inside an editable element,
 * except for "Escape" which always fires.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key
      if (key !== "Escape" && isEditableTarget(e.target)) return
      const normalized = key.length === 1 ? key.toLowerCase() : key
      const fn = shortcuts[normalized]
      if (fn) {
        e.preventDefault()
        fn(e)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [shortcuts, enabled])
}
