"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { applicationStatus } from "@/app/generated/prisma/enums"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/lib/toast"
import { STATUS_CONFIG, STATUS_COLORS } from "@/lib/constants"
import { Plus, ChevronDown } from "lucide-react"

const STATUSES = [
  applicationStatus.APPLIED,
  applicationStatus.INTERVIEW,
  applicationStatus.OFFER,
  applicationStatus.REJECTED,
]

interface FormState {
  company: string
  roleTitle: string
  status: applicationStatus
  location: string
  jobUrl: string
  notes: string
}

const EMPTY_FORM: FormState = {
  company: "",
  roleTitle: "",
  status: applicationStatus.APPLIED,
  location: "",
  jobUrl: "",
  notes: "",
}

function StatusDot({ status }: { status: applicationStatus }) {
  return (
    <span
      className="size-2 rounded-full shrink-0"
      style={{ backgroundColor: STATUS_COLORS[status] }}
    />
  )
}

export default function AddApplicationDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("open-add-dialog", handler)
    return () => window.removeEventListener("open-add-dialog", handler)
  }, [])

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM)
    setShowMore(false)
  }, [])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) resetForm()
  }

  const urlTrimmed = form.jobUrl.trim()
  const urlInvalid = urlTrimmed !== "" && !URL.canParse(urlTrimmed)
  const canSubmit =
    !loading &&
    form.company.trim() !== "" &&
    form.roleTitle.trim() !== "" &&
    !urlInvalid

  const submit = async () => {
    if (!canSubmit) return
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
          ...(urlTrimmed && { jobUrl: urlTrimmed }),
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
      resetForm()
      router.refresh()
    } catch {
      toast.error("Failed to add application")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" data-icon="inline-start" />
        Add
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>Add application</DialogTitle>
            <DialogDescription>
              Track a role you applied to manually.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
            {/* Required fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-company">
                  Company <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="add-company"
                  required
                  autoFocus
                  placeholder="Acme Corp"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-role">
                  Role <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="add-role"
                  required
                  placeholder="Software Engineer"
                  value={form.roleTitle}
                  onChange={(e) => setForm((f) => ({ ...f, roleTitle: e.target.value }))}
                />
              </div>
            </div>

            {/* Status + Location */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as applicationStatus }))
                  }
                >
                  <SelectTrigger id="add-status" className="w-full">
                    <SelectValue>
                      <StatusDot status={form.status} />
                      <span>{STATUS_CONFIG[form.status].label}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        <StatusDot status={s} />
                        <span>{STATUS_CONFIG[s].label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-location">Location</Label>
                <Input
                  id="add-location"
                  placeholder="San Francisco, CA"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
            </div>

            {/* More details disclosure */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                aria-expanded={showMore}
              >
                <ChevronDown
                  className={`size-3.5 transition-transform ${showMore ? "rotate-180" : ""}`}
                />
                {showMore ? "Hide details" : "More details"}
              </button>

              {showMore && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="add-url">Job URL</Label>
                    <Input
                      id="add-url"
                      type="url"
                      placeholder="https://…"
                      value={form.jobUrl}
                      onChange={(e) => setForm((f) => ({ ...f, jobUrl: e.target.value }))}
                      aria-invalid={urlInvalid || undefined}
                      aria-describedby={urlInvalid ? "add-url-error" : undefined}
                    />
                    {urlInvalid && (
                      <p id="add-url-error" className="text-xs text-destructive">
                        Enter a valid URL (e.g. https://example.com)
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="add-notes">Notes</Label>
                    <Textarea
                      id="add-notes"
                      placeholder="Any notes about this role…"
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      className="resize-none text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <DialogClose disabled={loading}>Cancel</DialogClose>
              <Button type="submit" disabled={!canSubmit}>
                {loading ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
