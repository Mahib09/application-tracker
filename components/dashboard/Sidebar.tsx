"use client";
import { useState, useEffect } from "react";
import {
  applicationStatus,
  applicationSource,
} from "@/app/generated/prisma/enums";
import { type Application, type StatusChangeRecord } from "@/types/application";
import {
  STATUS_CONFIG,
  STATUS_COLORS,
  STATUS_DISPLAY_ORDER,
} from "@/lib/constants";
import InlineEdit from "@/components/dashboard/InlineEdit";
import SidebarTimeline from "@/components/dashboard/SidebarTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { ExternalLink, ChevronUp, ChevronDown, Trash2, X, Mail, Calendar, User } from "lucide-react";

interface Props {
  app: Application;
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onDelete?: () => void;
  onClose?: () => void;
}

export default function Sidebar({
  app,
  onUpdate,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onDelete,
  onClose,
}: Props) {
  const [statusHistory, setStatusHistory] = useState<StatusChangeRecord[]>([]);
  const [statusDropdown, setStatusDropdown] = useState(false);
  const reduced = useReducedMotion();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const initial = reduced
    ? { opacity: 0 }
    : isMobile
      ? { y: "100%" }
      : { x: "100%" };
  const animate = reduced ? { opacity: 1 } : isMobile ? { y: 0 } : { x: 0 };
  const exitTo = reduced
    ? { opacity: 0 }
    : isMobile
      ? { y: "100%" }
      : { x: "100%" };
  const transition = reduced
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 400, damping: 35 } as const);

  useEffect(() => {
    fetch(`/api/applications/${app.id}/history`)
      .then((r) => r.json())
      .then((data) => setStatusHistory(data))
      .catch(() => setStatusHistory([]));
  }, [app.id]);

  const handleStatusChange = (status: applicationStatus) => {
    setStatusDropdown(false);
    onUpdate(app.id, { status });
  };

  return (
    <motion.aside
      key="sidebar"
      initial={initial}
      animate={animate}
      exit={exitTo}
      transition={transition}
      className={
        isMobile
          ? "fixed inset-x-0 bottom-0 z-40 max-h-[85vh] rounded-t-2xl border-t border-border bg-card shadow-2xl flex flex-col overflow-hidden"
          : "w-2/5 shrink-0 bg-card flex flex-col overflow-hidden"
      }
    >
      {/* Header strip — aligns with table <thead> */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 shrink-0">
        <span className="text-xs font-medium text-muted-foreground truncate">
          {app.company} — {app.roleTitle}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onPrev}
              disabled={!hasPrev}
              aria-label="Previous"
            >
              <ChevronUp className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onNext}
              disabled={!hasNext}
              aria-label="Next"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </div>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Delete"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4 space-y-4 flex-1 overflow-y-auto">
        {/* Status */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Status
          </label>
          <div className="relative">
            <button
              onClick={() => setStatusDropdown(!statusDropdown)}
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[app.status] }}
              />
              {STATUS_CONFIG[app.status].label}
            </button>
            {statusDropdown && (
              <div className="absolute top-full mt-1 left-0 z-20 rounded-lg border border-border bg-card shadow-lg py-1 min-w-36">
                {STATUS_DISPLAY_ORDER.map((s) => (
                  <button
                    key={s}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left"
                    onClick={() => handleStatusChange(s)}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[s] }}
                    />
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Company */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Company
          </label>
          <InlineEdit
            value={app.company}
            onSave={(v) => onUpdate(app.id, { company: v })}
            className="text-sm font-medium text-foreground"
          />
        </div>

        {/* Role and Location */}
        <div className="flex w-full">
          <div className="w-1/2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Role
            </label>
            <InlineEdit
              value={app.roleTitle}
              onSave={(v) => onUpdate(app.id, { roleTitle: v })}
              className="text-sm text-foreground"
            />
          </div>
          <div className="mx-auto w-1/2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Location
            </label>
            <InlineEdit
              value={app.location ?? ""}
              onSave={(v) => onUpdate(app.id, { location: v })}
              placeholder="Add location"
              className="text-sm text-foreground"
            />
          </div>
        </div>

        {/* Date Applied and source*/}
        <div className="flex w-full">
          <div className="w-1/2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Date Applied
            </label>
            <span className="text-sm text-foreground">
              {app.appliedAt
                ? new Date(app.appliedAt).toLocaleDateString()
                : "—"}
            </span>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Source
            </label>
            <Badge
              variant="outline"
              className={
                app.source === applicationSource.GMAIL
                  ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800"
                  : ""
              }
            >
              {app.source === applicationSource.GMAIL ? "Gmail" : "Manual"}
            </Badge>
          </div>
        </div>

        {/* Source */}

        {/* URL */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Job URL
          </label>
          {app.jobUrl ? (
            <a
              href={app.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {new URL(app.jobUrl).hostname}
              <ExternalLink className="size-3" />
            </a>
          ) : (
            <InlineEdit
              value=""
              onSave={(v) => onUpdate(app.id, { jobUrl: v })}
              placeholder="Add URL"
              className="text-sm"
            />
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Notes
          </label>
          <InlineEdit
            value={app.notes ?? ""}
            onSave={(v) => onUpdate(app.id, { notes: v })}
            placeholder="Add notes..."
            as="textarea"
            className="text-sm text-foreground"
          />
        </div>

        {/* Confidence */}
        {app.confidence != null && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              AI Confidence
            </label>
            <span className="text-sm tabular-nums text-foreground">
              {Math.round(app.confidence * 100)}%
            </span>
          </div>
        )}

        {/* Source email */}
        {app.sourceEmailSubject && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Mail className="size-3.5 text-muted-foreground" />
              <label className="text-xs font-medium text-muted-foreground">
                Source email
              </label>
            </div>
            <p className="text-sm font-medium text-foreground leading-snug">
              {app.sourceEmailSubject}
            </p>
            {app.sourceEmailSnippet && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {app.sourceEmailSnippet}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              {app.sourceEmailReceivedAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(app.sourceEmailReceivedAt).toLocaleDateString()}
                </span>
              )}
              {app.sourceEmailId && (
                <a
                  href={`https://mail.google.com/mail/u/0/#inbox/${app.sourceEmailId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View in Gmail
                  <ExternalLink className="size-2.5" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Interview brief */}
        {app.status === "INTERVIEW" && (app.interviewDate || app.interviewUrl || app.interviewer) && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="size-3.5 text-muted-foreground" />
              <label className="text-xs font-medium text-muted-foreground">
                Interview
              </label>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 space-y-1.5">
              {app.interviewDate && (
                <p className="text-sm text-foreground">
                  {new Date(app.interviewDate).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
              {app.interviewer && (
                <p className="text-xs text-muted-foreground">
                  with {app.interviewer}
                </p>
              )}
              {app.interviewUrl && (
                <a
                  href={app.interviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Join meeting
                  <ExternalLink className="size-2.5" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Recruiter */}
        {app.recruiterEmail && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <User className="size-3.5 text-muted-foreground" />
              <label className="text-xs font-medium text-muted-foreground">Recruiter</label>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground shrink-0">
                {(app.recruiterName ?? app.recruiterEmail)[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                {app.recruiterName && (
                  <p className="text-sm font-medium text-foreground truncate">{app.recruiterName}</p>
                )}
                <a
                  href={`mailto:${app.recruiterEmail}`}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block"
                >
                  {app.recruiterEmail}
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Job description snapshot */}
        {app.jobDescriptionSnapshot && (
          <div className="pt-2 border-t border-border">
            <details>
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors select-none">
                Saved job description
                {app.jobDescriptionFetchedAt && (
                  <span className="ml-1 font-normal">
                    (fetched {new Date(app.jobDescriptionFetchedAt).toLocaleDateString()})
                  </span>
                )}
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed max-h-48 overflow-y-auto">
                {app.jobDescriptionSnapshot}
              </pre>
              {app.jobUrl && (
                <a
                  href={app.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 mt-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View original <ExternalLink className="size-2.5" />
                </a>
              )}
            </details>
          </div>
        )}

        {/* Timeline */}
        {statusHistory.length > 0 && (
          <div className="pt-2 border-t border-border">
            <label className="text-xs font-medium text-muted-foreground mb-3 block">
              Timeline
            </label>
            <SidebarTimeline history={statusHistory} />
          </div>
        )}
      </div>
    </motion.aside>
  );
}
