"use client"
import { useCallback, useEffect, useState } from "react"

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw != null) setValue(JSON.parse(raw) as T)
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          // ignore
        }
        return next
      })
    },
    [key],
  )

  return [value, set]
}
