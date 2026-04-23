"use client"
import { useEffect, useRef } from "react"
import { useReducedMotion } from "@/lib/hooks/useReducedMotion"

export default function MouseGlow() {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return

    const onMove = (e: MouseEvent) => {
      el.style.left = `${e.clientX}px`
      el.style.top = `${e.clientY}px`
      el.style.opacity = "1"
    }
    const onLeave = () => {
      el.style.opacity = "0"
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseleave", onLeave)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseleave", onLeave)
    }
  }, [reduced])

  if (reduced) return null

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed z-0 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-300"
      style={{
        width: 600,
        height: 600,
        background:
          "radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(59,130,246,0.08) 40%, transparent 70%)",
      }}
    />
  )
}
