"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { applicationStatus } from "@/app/generated/prisma/enums"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/lib/toast"
import { STATUS_CONFIG } from "@/lib/constants"
import { Plus } from "lucide-react"

const STATUSES = [
  applicationStatus.APPLIED,
  applicationStatus.INTERVIEW,
  applicationStatus.OFFER,
  applicationStatus.REJECTED,
]

export default function AddApplicationDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    company: "",
    roleTitle: "",
    status: applicationStatus.APPLIED,
    location: "",
    jobUrl: "",
    notes: "",
  })

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("open-add-dialog", handler)
    return () => window.removeEventListener("open-add-dialog", handler)
  }, [])

  const field = (key: keyof typeof form) => (
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.company.trim() || !form.roleTitle.trim()) return

    setLoading(true)
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: form.company.trim(),
          roleTitle: form.roleTitle.trim(),
          status: form.status,
          source: "MANUAL",
          ...(form.location.trim() && { location: form.location.trim() }),
          ...(form.jobUrl.trim() && { jobUrl: form.jobUrl.trim() }),
          ...(form.notes.trim() && { notes: form.notes.trim() }),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? "Failed to add application")
        return
      }

      toast.success("Application added")
      setOpen(false)
      setForm({ company: "", roleTitle: "", status: applicationStatus.APPLIED, location: "", jobUrl: "", notes: "" })
      router.refresh()
    } catch {
      toast.error("Failed to add application")
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 placeholder:text-muted-foreground"

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" data-icon="inline-start" />
        Add
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-md!" size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>Add application</AlertDialogTitle>
          </AlertDialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Company *</label>
                <input
                  required
                  placeholder="Acme Corp"
                  value={form.company}
                  onChange={field("company")}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Role *</label>
                <input
                  required
                  placeholder="Software Engineer"
                  value={form.roleTitle}
                  onChange={field("roleTitle")}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Status</label>
                <select
                  value={form.status}
                  onChange={field("status")}
                  className={inputCls}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Location</label>
                <input
                  placeholder="San Francisco, CA"
                  value={form.location}
                  onChange={field("location")}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Job URL</label>
              <input
                type="url"
                placeholder="https://..."
                value={form.jobUrl}
                onChange={field("jobUrl")}
                className={inputCls}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Notes</label>
              <Textarea
                placeholder="Any notes about this role…"
                value={form.notes}
                onChange={field("notes")}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
              <Button type="submit" disabled={loading || !form.company.trim() || !form.roleTitle.trim()}>
                {loading ? "Adding…" : "Add application"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
