# Dev Reset Button — Design Spec

**Date:** 2026-04-02
**Status:** Approved
**Scope:** Dev/testing only — remove before production

---

## Context

The `/api/sync/reset` endpoint exists and is functional (`fullResync`). It deletes all Gmail-sourced applications and runs a full re-sync from scratch. The dashboard needs a UI entry point to trigger this during development so the developer can test the full sync pipeline repeatedly without manually hitting the API.

This feature is explicitly temporary and will be removed before production.

---

## Design System (from ui-ux-pro-max)

- **Style:** Micro-interactions — small state transitions, tactile feedback, 150–300ms
- **Primary color:** `#2563EB` (matches existing dashboard)
- **Destructive:** shadcn `destructive` variant (red) — visually distinct from primary sync button
- **Typography:** Existing `text-sm` / `text-slate-*` scale
- **Feedback:** Brief inline success/error message (no toast library needed — consistent with existing `SyncButton` pattern)
- **Confirmation:** AlertDialog before destructive action (UX guideline: "Confirm before delete/irreversible actions")

---

## Component: `DevResetButton`

**File:** `components/DevResetButton.tsx`
**Type:** `"use client"` client component

### Visual Design

```
[Reset & Full Re-sync]   ← variant="destructive" size="sm", matches existing button height
Deleted 47 apps. Re-synced 52.  ← amber-600 inline text, appears after success
Reset failed — Gmail auth failed  ← red-600 inline text, appears on error
```

- Sits **below** `SyncButton` in the dashboard, separated by a thin `border-t border-dashed border-slate-200` line to visually signal "dev territory"
- Small `text-xs text-slate-400` label: `DEV ONLY` above or beside the button
- Button disabled + shows `"Resetting…"` during the async operation (matches `SyncButton` loading pattern)
- Message clears when reset is triggered again

### Confirmation Dialog (shadcn AlertDialog)

```
Title:    "Reset all application data?"
Body:     "This will permanently delete all Gmail-synced applications 
           and trigger a full re-sync from scratch. Use for testing only."
Cancel:   "Cancel"   ← outline/secondary variant
Confirm:  "Yes, reset"  ← destructive variant
```

- Dialog closes immediately on Confirm; loading state transfers to the button
- Escape key / clicking overlay dismisses (standard AlertDialog behavior)
- Transition: scale+fade, 150ms (shadcn default)

### State Machine

```
idle → [click button] → dialog open
dialog open → [cancel / escape] → idle
dialog open → [confirm] → resetting (button disabled, "Resetting…")
resetting → [success] → idle + success message + router.refresh()
resetting → [error] → idle + error message
```

### Response Handling

POST `/api/sync/reset` returns `{ synced, deleted, ghosted, lastSyncedAt }`.

- **Success message:** `"Deleted {deleted} app{plural}. Re-synced {synced}."`  — `text-amber-600`
- **Error message:** `"Reset failed — {error}"` — `text-red-500`
- On success: call `router.refresh()` to reload the application table and stats

---

## Dashboard Integration

**File:** `app/dashboard/page.tsx`

Add below `<SyncButton>`:
```tsx
{/* DEV ONLY — remove before production */}
<DevResetButton />
```

Wrapped in a `/* DEV ONLY */` comment so it's easy to find and delete.

---

## What Gets Installed

`npx shadcn@latest add alert-dialog` — adds `components/ui/alert-dialog.tsx`

shadcn is already in `package.json` (`"shadcn": "^4.1.0"`). No other packages needed.

---

## Accessibility

- AlertDialog uses `role="alertdialog"` (shadcn default) — screen reader announces it
- Focus trapped inside dialog while open
- Confirm/cancel buttons both ≥44px touch targets
- `aria-label` on reset button: `"Reset all Gmail application data and re-sync"`
- Destructive confirm button is visually distinct (red) + labeled (not icon-only)

---

## UX Rules Applied

| Rule | Application |
|---|---|
| `confirmation-dialogs` | AlertDialog before destructive action |
| `destructive-emphasis` | Red button variant, visually separated from primary sync |
| `loading-buttons` | Button disabled + label change during async |
| `submit-feedback` | Inline message after success/failure |
| `duration-timing` | 150–300ms shadcn default transitions |
| `primary-action` | One primary CTA per area — Reset is secondary/destructive, not competing |

---

## Files Changed

| File | Change |
|---|---|
| `components/DevResetButton.tsx` | **New** — the full component |
| `components/ui/alert-dialog.tsx` | **New** — installed via shadcn |
| `app/dashboard/page.tsx` | **Edit** — add `<DevResetButton />` below `<SyncButton>` |

No tests required — this is a dev-only UI wrapper around an already-tested API endpoint.
