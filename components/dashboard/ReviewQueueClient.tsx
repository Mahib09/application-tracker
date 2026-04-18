"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { type Application } from "@/types/application"
import { applicationStatus } from "@/app/generated/prisma/enums"
import { STATUS_CONFIG, STATUS_COLORS, STATUS_DISPLAY_ORDER } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { CheckCheck, RotateCcw, Inbox } from "lucide-react"
import CompanyLogo from "@/components/CompanyLogo"
import { toast } from "@/lib/toast"

interface Props {
  items: Application[]
}

export default function ReviewQueueClient({ items: initial }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [focusIdx, setFocusIdx] = useState(0)
  const [reclassifyId, setReclassifyId] = useState<string | null>(null)
  const [editCompany, setEditCompany] = useState("")
  const [editRole, setEditRole] = useState("")
  const [editStatus, setEditStatus] = useState<applicationStatus>(applicationStatus.APPLIED)

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id)
      setFocusIdx((fi) => Math.min(fi, Math.max(0, next.length - 1)))
      return next
    })
  }, [])

  const accept = useCallback(async (item: Application) => {
    try {
      const res = await fetch(`/api/applications/${item.id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: applicationStatus.APPLIED }),
      })
      if (!res.ok) throw new Error("Failed")
      remove(item.id)
      toast.success(`Accepted ${item.company} as Applied`)
      router.refresh()
    } catch {
      toast.error("Failed to accept")
    }
  }, [remove, router])

  const openReclassify = (item: Application) => {
    setReclassifyId(item.id)
    setEditCompany(item.company)
    setEditRole(item.roleTitle)
    setEditStatus(applicationStatus.APPLIED)
  }

  const submitReclassify = async (id: string) => {
    try {
      const res = await fetch(`/api/applications/${id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus, company: editCompany, roleTitle: editRole }),
      })
      if (!res.ok) throw new Error("Failed")
      remove(id)
      setReclassifyId(null)
      toast.success("Reclassified")
      router.refresh()
    } catch {
      toast.error("Failed to reclassify")
    }
  }

  // Keyboard navigation: j/k to move, a to accept, r to reclassify, Escape to cancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, items.length - 1))
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0))
      else if (e.key === "a" && items[focusIdx]) accept(items[focusIdx])
      else if (e.key === "r" && items[focusIdx]) openReclassify(items[focusIdx])
      else if (e.key === "Escape") setReclassifyId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [items, focusIdx, accept])

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <Inbox className="size-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">All caught up — no items to review.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2" role="list" aria-label="Review queue">
      <p className="text-xs text-muted-foreground">
        Keyboard: <kbd className="rounded bg-muted px-1 py-0.5 text-[10px]">j</kbd>/
        <kbd className="rounded bg-muted px-1 py-0.5 text-[10px]">k</kbd> navigate ·{" "}
        <kbd className="rounded bg-muted px-1 py-0.5 text-[10px]">a</kbd> accept ·{" "}
        <kbd className="rounded bg-muted px-1 py-0.5 text-[10px]">r</kbd> reclassify
      </p>

      {items.map((item, idx) => (
        <div
          key={item.id}
          role="listitem"
          tabIndex={0}
          onClick={() => setFocusIdx(idx)}
          onFocus={() => setFocusIdx(idx)}
          className={`rounded-lg border bg-card px-4 py-3 transition-colors cursor-pointer outline-none ${
            focusIdx === idx
              ? "border-primary ring-1 ring-primary/30"
              : "border-border hover:border-muted-foreground/30"
          }`}
        >
          {reclassifyId === item.id ? (
            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  placeholder="Company"
                  className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  placeholder="Role title"
                  className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {STATUS_DISPLAY_ORDER.map((s) => (
                  <button
                    key={s}
                    onClick={() => setEditStatus(s)}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      editStatus === s
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => submitReclassify(item.id)}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setReclassifyId(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <CompanyLogo company={item.company} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm text-foreground truncate">{item.company}</span>
                  <span className="text-xs text-muted-foreground truncate">{item.roleTitle}</span>
                </div>
                {item.confidence != null && (
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${Math.round(item.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {Math.round(item.confidence * 100)}% confidence
                    </span>
                  </div>
                )}
                {item.sourceEmailSubject && (
                  <p className="text-xs text-muted-foreground truncate">{item.sourceEmailSubject}</p>
                )}
                {item.sourceEmailSnippet && (
                  <p className="text-xs text-muted-foreground/70 truncate">{item.sourceEmailSnippet}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={(e) => { e.stopPropagation(); accept(item) }}
                >
                  <CheckCheck className="size-3" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={(e) => { e.stopPropagation(); openReclassify(item) }}
                >
                  <RotateCcw className="size-3" /> Reclassify
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
