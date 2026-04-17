"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { EASE_OUT_ENTER } from "@/lib/motion"

interface Props {
  onComplete: (result: { synced: number; updated: number }) => void
  onError: (error: string) => void
}

const MESSAGES = [
  "Connecting to Gmail...",
  "Scanning your inbox...",
  "Reading through your emails...",
  "Looking for applications...",
  "Checking for interview invites...",
  "Analyzing rejection patterns...",
  "Extracting company names...",
  "Identifying job roles...",
  "Classifying your applications...",
  "Matching duplicates...",
  "Building your dashboard...",
  "Organizing everything...",
  "Almost there...",
]

function pickRandom(exclude: string): string {
  const filtered = MESSAGES.filter((m) => m !== exclude)
  return filtered[Math.floor(Math.random() * filtered.length)]
}

export default function SyncProgress({ onComplete, onError }: Props) {
  const [message, setMessage] = useState(MESSAGES[0])
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [resultText, setResultText] = useState("")
  const syncFired = useRef(false)
  const startTime = useRef(Date.now())
  // Stable refs — prevents the sync effect from re-firing when callbacks change identity
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)
  onCompleteRef.current = onComplete
  onErrorRef.current = onError

  // Random message cycling every 2.5s
  useEffect(() => {
    if (done) return
    const interval = setInterval(() => {
      setMessage((prev) => pickRandom(prev))
    }, 2500)
    return () => clearInterval(interval)
  }, [done])

  // Logarithmic progress: 90 * (1 - e^(-t/15))
  // Always moving, decelerates as it approaches 90%
  useEffect(() => {
    if (done) return
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000
      const p = 90 * (1 - Math.exp(-elapsed / 15))
      setProgress(p)
    }, 100)
    return () => clearInterval(interval)
  }, [done])

  // Smooth completion animation
  const completeSync = useCallback((data: { synced: number; updated: number }) => {
    setDone(true)
    const created = data.synced
    const updated = data.updated
    const s = (n: number) => (n !== 1 ? "s" : "")
    let text: string
    if (created > 0 && updated > 0) {
      text = `Found ${created} new, ${updated} updated!`
    } else if (created > 0) {
      text = `Found ${created} application${s(created)}!`
    } else if (updated > 0) {
      text = `Updated ${updated} application${s(updated)}!`
    } else {
      text = "No new updates"
    }
    setResultText(text)

    const currentProgress = 90 * (1 - Math.exp(-(Date.now() - startTime.current) / 15000))
    if (currentProgress < 30) {
      let p = currentProgress
      const step = setInterval(() => {
        p += 3
        if (p >= 100) {
          p = 100
          clearInterval(step)
          setTimeout(() => onCompleteRef.current(data), 800)
        }
        setProgress(p)
      }, 50)
    } else {
      setProgress(100)
      setTimeout(() => onCompleteRef.current(data), 1200)
    }
  }, [])

  // Fire sync request — empty deps, fires exactly once on mount
  useEffect(() => {
    if (syncFired.current) return
    syncFired.current = true

    fetch("/api/sync", { method: "POST" })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          onErrorRef.current(data.error ?? "Sync failed")
          return
        }
        if (data.skipped) {
          onErrorRef.current("A sync is already in progress — try again in a moment")
          return
        }
        completeSync({ synced: data.synced, updated: data.updated })
      })
      .catch(() => {
        onErrorRef.current("Sync failed — check your connection")
      })
  }, [completeSync])

  const currentText = done ? resultText : message

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Animated text */}
        <div className="h-8 relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={currentText}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={EASE_OUT_ENTER}
              className={`text-sm font-medium absolute inset-x-0 ${
                done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
              }`}
            >
              {currentText}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              done
                ? "bg-emerald-500"
                : "bg-blue-500"
            }`}
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>

        {/* Subtle subtext */}
        {!done && (
          <p className="text-xs text-muted-foreground/60">
            This usually takes 10–30 seconds
          </p>
        )}
      </div>
    </div>
  )
}
