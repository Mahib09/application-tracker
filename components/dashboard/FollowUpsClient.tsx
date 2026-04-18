"use client"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { type Application } from "@/types/application"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { toast, undoToast } from "@/lib/toast"
import { Bell } from "lucide-react"
import CompanyLogo from "@/components/CompanyLogo"

interface Props {
  items: Application[]
}

function daysAgo(date: Date | null) {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

export default function FollowUpsClient({ items: initial }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = useState(initial)
  const [draftAppId, setDraftAppId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [drafting, setDrafting] = useState(false)

  // Auto-open draft dialog if ?app= param is present (from CommandPalette)
  useEffect(() => {
    const appId = searchParams.get("app")
    if (appId && items.find((i) => i.id === appId)) {
      openDraft(appId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openDraft = async (id: string) => {
    setDraftAppId(id)
    setDraft("")
    setDrafting(true)
    try {
      const res = await fetch(`/api/applications/${id}/draft-followup`, { method: "POST" })
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setDraft(json.draft)
    } catch {
      toast.error("Failed to generate draft")
      setDraftAppId(null)
    } finally {
      setDrafting(false)
    }
  }

  const copyAndMark = async (id: string) => {
    await navigator.clipboard.writeText(draft)
    setDraftAppId(null)

    let markedUp = false
    undoToast("Copied to clipboard — mark as followed up?", async () => {
      if (markedUp) {
        // Undo: remove from followed-up state by refreshing
        router.refresh()
      }
    })

    // Mark as followed up after a short delay (gives user time to undo copy)
    setTimeout(async () => {
      try {
        await fetch(`/api/applications/${id}/mark-followed-up`, { method: "POST" })
        markedUp = true
        setItems((prev) => prev.filter((i) => i.id !== id))
        router.refresh()
      } catch {
        // Silently fail — user already has the draft copied
      }
    }, 500)
  }

  const markFollowedUp = async (id: string) => {
    try {
      await fetch(`/api/applications/${id}/mark-followed-up`, { method: "POST" })
      setItems((prev) => prev.filter((i) => i.id !== id))
      toast.success("Marked as followed up")
      router.refresh()
    } catch {
      toast.error("Failed to mark as followed up")
    }
  }

  const draftApp = items.find((i) => i.id === draftAppId) ?? null

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <Bell className="size-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No pending follow-ups — you&apos;re on top of things.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {items.map((item) => {
          const age = daysAgo(item.appliedAt)
          return (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-card px-4 py-3 flex items-start gap-3"
            >
              <CompanyLogo company={item.company} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm text-foreground truncate">{item.company}</span>
                  {item.recruiterName && (
                    <span className="text-xs text-muted-foreground truncate">· {item.recruiterName}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{item.roleTitle}</p>
                {age != null && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5">Applied {age} days ago</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => openDraft(item.id)}
                >
                  Draft follow-up
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => markFollowedUp(item.id)}
                >
                  Mark done
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Draft dialog */}
      <Dialog open={draftAppId !== null} onOpenChange={(open) => { if (!open) setDraftAppId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Follow-up draft{draftApp ? ` — ${draftApp.company}` : ""}
            </DialogTitle>
          </DialogHeader>

          {drafting ? (
            <p className="text-sm text-muted-foreground animate-pulse">Drafting with AI…</p>
          ) : (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          )}

          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
            <Button
              disabled={drafting || !draft}
              onClick={() => draftAppId && copyAndMark(draftAppId)}
            >
              Copy &amp; mark followed up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
