"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Mail, RefreshCw, Shield } from "lucide-react"

export default function OnboardingEmptyState() {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<{ synced: number; updated: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFirstSync = async () => {
    setSyncing(true)
    setError(null)
    try {
      const res = await fetch("/api/sync", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Sync failed")
        return
      }
      setResult({ synced: data.synced, updated: data.updated })
      // Brief pause to show the result, then refresh to full dashboard
      setTimeout(() => router.refresh(), 1500)
    } catch {
      setError("Sync failed — check your connection")
    } finally {
      setSyncing(false)
    }
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

          {result ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
              <p className="text-sm font-medium text-emerald-700">
                Found {result.synced} application{result.synced !== 1 ? "s" : ""}!
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">Loading your dashboard...</p>
            </div>
          ) : (
            <>
              <Button
                onClick={handleFirstSync}
                disabled={syncing}
                size="lg"
                className="w-full"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" data-icon="inline-start" />
                    Scanning your emails...
                  </>
                ) : (
                  "Start First Sync"
                )}
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
