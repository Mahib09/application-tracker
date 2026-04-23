"use client"
import { useScroll, useTransform, motion } from "motion/react"

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <motion.div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-50 h-[2px] origin-left bg-linear-to-r from-blue-500 to-violet-500"
      style={{ scaleX }}
    />
  )
}
