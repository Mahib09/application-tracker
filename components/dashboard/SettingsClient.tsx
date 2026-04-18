"use client"
import { useState } from "react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"
import { Download, Trash2, Mail, User } from "lucide-react"

interface Props {
  user: { name: string | null; email: string; image: string | null }
  lastSyncedAt: Date | null
  gmailConnected: boolean
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  )
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function SettingsClient({ user, lastSyncedAt, gmailConnected: initialGmailConnected }: Props) {
  const [gmailConnected, setGmailConnected] = useState(initialGmailConnected)
  const [disconnecting, setDisconnecting] = useState(false)
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null)
  const [deleteInput, setDeleteInput] = useState("")
  const [deleting, setDeleting] = useState(false)

  const handleDisconnectGmail = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch("/api/account/gmail", { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      setGmailConnected(false)
      toast.success("Gmail disconnected")
    } catch {
      toast.error("Failed to disconnect Gmail")
    } finally {
      setDisconnecting(false)
    }
  }

  const handleExport = async (format: "csv" | "json") => {
    setExporting(format)
    try {
      const res = await fetch(`/api/export?format=${format}`)
      if (!res.ok) throw new Error("Failed")
      const content = await res.text()
      const type = format === "csv" ? "text/csv" : "application/json"
      downloadBlob(content, `applications.${format}`, type)
      toast.success(`Exported as ${format.toUpperCase()}`)
    } catch {
      toast.error("Export failed")
    } finally {
      setExporting(null)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteInput !== "delete") return
    setDeleting(true)
    try {
      const res = await fetch("/api/account", { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      await signOut({ callbackUrl: "/login" })
    } catch {
      toast.error("Failed to delete account")
      setDeleting(false)
    }
  }

  return (
    <div className="py-4 max-w-xl space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Settings</h1>

      {/* Account */}
      <Section title="Account">
        <div className="flex items-center gap-3">
          {user.image ? (
            <img src={user.image} alt={user.name ?? ""} className="size-10 rounded-full" />
          ) : (
            <div className="size-10 rounded-full bg-muted flex items-center justify-center">
              <User className="size-5 text-muted-foreground" />
            </div>
          )}
          <div>
            {user.name && <p className="text-sm font-medium text-foreground">{user.name}</p>}
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </Section>

      {/* Gmail connection */}
      <Section title="Gmail connection">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-foreground">
                {gmailConnected ? `Connected as ${user.email}` : "Not connected"}
              </p>
              {lastSyncedAt && (
                <p className="text-xs text-muted-foreground">
                  Last synced {new Date(lastSyncedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          {gmailConnected && (
            <Button
              variant="outline"
              size="sm"
              disabled={disconnecting}
              onClick={handleDisconnectGmail}
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          )}
        </div>
      </Section>

      {/* Export */}
      <Section title="Export data">
        <p className="text-xs text-muted-foreground">
          Download all your applications. CSV opens in Excel; JSON includes full status history.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={exporting !== null}
            onClick={() => handleExport("csv")}
          >
            <Download className="size-3.5 mr-1.5" />
            {exporting === "csv" ? "Exporting…" : "Export as CSV"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting !== null}
            onClick={() => handleExport("json")}
          >
            <Download className="size-3.5 mr-1.5" />
            {exporting === "json" ? "Exporting…" : "Export as JSON"}
          </Button>
        </div>
      </Section>

      {/* Delete */}
      <Section title="Delete all data">
        <p className="text-xs text-muted-foreground">
          Permanently deletes your account and all applications. This cannot be undone.
        </p>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">
            Type <span className="font-mono font-semibold text-foreground">delete</span> to confirm
          </label>
          <input
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            placeholder="delete"
            className="block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-destructive"
          />
          <Button
            variant="destructive"
            size="sm"
            disabled={deleteInput !== "delete" || deleting}
            onClick={handleDeleteAccount}
          >
            <Trash2 className="size-3.5 mr-1.5" />
            {deleting ? "Deleting…" : "Delete all data"}
          </Button>
        </div>
      </Section>
    </div>
  )
}
