// DEV ONLY — remove before production
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function DevResetButton() {
  const router = useRouter()
  const [resetting, setResetting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const doReset = async () => {
    setResetting(true)
    setMessage(null)
    try {
      const res = await fetch("/api/sync/reset", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Unknown error")
      const plural = (n: number) => (n !== 1 ? "s" : "")
      setMessage(`Deleted ${data.deleted} app${plural(data.deleted)}. Re-synced ${data.synced}.`)
      router.refresh()
    } catch (err) {
      setMessage(`Reset failed — ${err instanceof Error ? err.message : "check connection"}`)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="flex items-center gap-4 pt-4 mt-2 border-t border-dashed border-slate-200">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Dev Only</span>
      <AlertDialog>
        <AlertDialogTrigger
          disabled={resetting}
          aria-label="Reset all Gmail application data and re-sync"
          className="inline-flex h-7 items-center rounded-[min(var(--radius-md),12px)] border border-transparent bg-destructive/10 px-2.5 text-[0.8rem] font-medium text-destructive hover:bg-destructive/20 disabled:pointer-events-none disabled:opacity-50"
        >
          {resetting ? "Resetting…" : "Reset & Full Re-sync"}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all application data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all Gmail-synced applications and trigger a full
              re-sync from scratch. Use for testing only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {message && (
        <span className={`text-sm ${message.startsWith("Reset failed") ? "text-red-500" : "text-amber-600"}`}>
          {message}
        </span>
      )}
    </div>
  )
}
