"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Mail, Shield } from "lucide-react"
import SyncProgress from "@/components/SyncProgress"
import { motion } from "motion/react"
import { EASE_OUT_ENTER } from "@/lib/motion"

export default function OnboardingEmptyState() {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStart = () => {
    setError(null)
    setSyncing(true)
  }

  const handleComplete = useCallback(() => {
    router.refresh()
  }, [router])

  const handleError = useCallback((err: string) => {
    setError(err)
    setSyncing(false)
  }, [])

  if (syncing) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={EASE_OUT_ENTER}
      >
        <SyncProgress onComplete={handleComplete} onError={handleError} />
      </motion.div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-5">
          <div className="mx-auto w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
            <Mail className="size-6 text-violet-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-900">
              Let&apos;s find your applications
            </h2>
            <p className="text-sm text-slate-500">
              We&apos;ll scan your Gmail for application confirmations, interview invites,
              and responses — then organize everything automatically.
            </p>
          </div>

          <Button
            onClick={handleStart}
            size="lg"
            className="w-full"
          >
            Start First Sync
          </Button>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <div className="flex items-start gap-2 text-left">
            <Shield className="size-4 text-slate-400 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-400">
              We only read emails related to job applications.
              Nothing is stored except company names, roles, and statuses.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
