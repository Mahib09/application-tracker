import type { Transition } from "motion/react"

export const SPRING_GENTLE: Transition = { type: "spring", stiffness: 260, damping: 30 }
export const SPRING_SNAPPY: Transition = { type: "spring", stiffness: 500, damping: 35 }
export const EASE_OUT_ENTER: Transition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] }

export const STAGGER_CHILDREN = 0.03
export const MAX_DURATION_MS = 300
