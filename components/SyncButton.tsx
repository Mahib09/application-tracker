"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast, undoToast } from "@/lib/toast"
import { RefreshCw } from "lucide-react"

interface Props {
  lastSyncedAt: Date | null
  cooldownMs: number
  compact?: boolean
}

function relativeTime(date: Date): string {
  const m = Math.floor((Date.now() - date.getTime()) / 60_000)
  return m < 1 ? "just now" : m === 1 ? "1 min ago" : `${m} min ago`
}

function countdown(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
}

export default function SyncButton({ lastSyncedAt, cooldownMs: initialCooldown, compact }: Props) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [cooldownMs, setCooldownMs] = useState(initialCooldown)
  const [lastSynced, setLastSynced] = useState<Date | null>(lastSyncedAt)
  const mounted = useRef(false)

  useEffect(() => {
    if (cooldownMs <= 0) return
    const t = setInterval(
      () => setCooldownMs((ms) => (ms <= 1000 ? (clearInterval(t), 0) : ms - 1000)),
      1000,
    )
    return () => clearInterval(t)
  }, [cooldownMs])

  const doSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/sync", { method: "POST" })
      const data = await res.json()
      if (data.skipped) {
        setCooldownMs(data.cooldownMs)
      } else {
        setLastSynced(new Date())
        setCooldownMs(15 * 60 * 1000)
        toast.success(`Synced ${data.synced} new application${data.synced !== 1 ? "s" : ""}`)
        router.refresh()
        if (Array.isArray(data.ghostedRecords) && data.ghostedRecords.length > 0) {
          const records = data.ghostedRecords as { id: string; fromStatus: string }[]
          undoToast(
            `${records.length} auto-ghosted after 30 days`,
            async () => {
              try {
                await Promise.all(
                  records.map((r) =>
                    fetch(`/api/applications/${r.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: r.fromStatus }),
                    }),
                  ),
                )
                router.refresh()
              } catch {
                toast.error("Failed to revert ghost")
              }
            },
          )
        }
      }
    } catch {
      toast.error("Sync failed — check connection")
    } finally {
      setSyncing(false)
    }
  }

  // Auto-sync once on mount if not in cooldown
  useEffect(() => {
    if (!mounted.current && cooldownMs === 0) {
      mounted.current = true
      doSync()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">
          {lastSynced ? relativeTime(lastSynced) : "Never synced"}
        </span>
        <Button
          onClick={doSync}
          disabled={syncing || cooldownMs > 0}
          variant="outline"
          size="icon-xs"
          title={cooldownMs > 0 ? `Available in ${countdown(cooldownMs)}` : "Sync now"}
        >
          <RefreshCw className={`size-3 ${syncing ? "animate-spin" : ""}`} />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 mb-6">
      <Button
        onClick={doSync}
        disabled={syncing || cooldownMs > 0}
        variant="default"
        size="sm"
      >
        <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} data-icon="inline-start" />
        {syncing ? "Syncing…" : cooldownMs > 0 ? `Available in ${countdown(cooldownMs)}` : "Sync Now"}
      </Button>
      <span className="text-sm text-slate-500">
        {lastSynced ? `Last synced ${relativeTime(lastSynced)}` : "Never synced"}
      </span>
    </div>
  )
}
