"use client"
import { useScroll, useTransform, motion, useReducedMotion } from "motion/react"

export default function ScrollProgress() {
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1])

  if (reduced) return null

  return (
    <motion.div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-50 h-0.5 origin-left bg-linear-to-r from-blue-500 to-violet-500"
      style={{ scaleX }}
    />
  )
}
