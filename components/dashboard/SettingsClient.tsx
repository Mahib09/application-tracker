"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import {
  Download,
  Trash2,
  Mail,
  User as UserIcon,
  FileJson,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface Props {
  user: { name: string | null; email: string; image: string | null };
  lastSyncedAt: Date | null;
  gmailConnected: boolean;
}

type Tone = "neutral" | "blue" | "emerald" | "violet" | "red";

function IconChip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  const toneClass = {
    neutral: "bg-muted text-foreground",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    violet:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  }[tone];
  return (
    <span
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${toneClass}`}
    >
      {children}
    </span>
  );
}

function Section({
  icon,
  tone,
  title,
  description,
  danger,
  children,
}: {
  icon: React.ReactNode;
  tone?: Tone;
  title: string;
  description?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border bg-card px-5 py-4 ${
        danger ? "border-red-200 dark:border-red-900/50" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <IconChip tone={tone ?? "neutral"}>{icon}</IconChip>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-foreground leading-tight">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="pl-12">{children}</div>
    </div>
  );
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SettingsClient({
  user,
  lastSyncedAt,
  gmailConnected: initialGmailConnected,
}: Props) {
  const [gmailConnected, setGmailConnected] = useState(initialGmailConnected);
  const [disconnecting, setDisconnecting] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDisconnectGmail = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/account/gmail", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setGmailConnected(false);
      toast.success("Gmail disconnected");
    } catch {
      toast.error("Failed to disconnect Gmail");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleExport = async (format: "csv" | "json") => {
    setExporting(format);
    try {
      const res = await fetch(`/api/export?format=${format}`);
      if (!res.ok) throw new Error("Failed");
      const content = await res.text();
      const type = format === "csv" ? "text/csv" : "application/json";
      downloadBlob(content, `applications.${format}`, type);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== "delete") return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      await signOut({ callbackUrl: "/login" });
    } catch {
      toast.error("Failed to delete account");
      setDeleting(false);
    }
  };

  return (
    <div className="py-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, connections, and data.
        </p>
      </div>

      {/* Account */}
      <Section
        icon={<UserIcon className="size-4" />}
        tone="violet"
        title="Account"
        description="Your Google identity — used to sign in."
      >
        <div className="flex items-center gap-3">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name ?? ""}
              className="size-12 rounded-full ring-1 ring-border"
            />
          ) : (
            <div className="size-12 rounded-full bg-linear-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-semibold">
              {(user.name ?? user.email).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            {user.name && (
              <p className="text-sm font-medium text-foreground">{user.name}</p>
            )}
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </Section>

      {/* Gmail connection */}
      <Section
        icon={<Mail className="size-4" />}
        tone="blue"
        title="Gmail connection"
        description="Pull application emails into your tracker."
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {gmailConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckCircle2 className="size-3" /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Not connected
              </span>
            )}
            {lastSyncedAt && (
              <span className="text-xs text-muted-foreground">
                · Last synced {new Date(lastSyncedAt).toLocaleString()}
              </span>
            )}
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
      <Section
        icon={<Download className="size-4" />}
        tone="emerald"
        title="Export your data"
        description="CSV opens cleanly in Excel; JSON includes full status history."
      >
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            disabled={exporting !== null}
            onClick={() => handleExport("csv")}
          >
            <FileSpreadsheet className="size-3.5 mr-1.5" />
            {exporting === "csv" ? "Exporting…" : "Export as CSV"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting !== null}
            onClick={() => handleExport("json")}
          >
            <FileJson className="size-3.5 mr-1.5" />
            {exporting === "json" ? "Exporting…" : "Export as JSON"}
          </Button>
        </div>
      </Section>

      <div className="h-px bg-border" />

      {/* Danger zone */}
      <Section
        icon={<AlertTriangle className="size-4" />}
        tone="red"
        title="Danger zone"
        description="Permanently delete your account and all applications. This cannot be undone."
        danger
      >
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">
            Type{" "}
            <span className="font-mono font-semibold text-foreground">
              delete
            </span>{" "}
            to confirm
          </label>
          <input
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            placeholder="delete"
            className="block w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-destructive"
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
  );
}
