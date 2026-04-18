# Scrollable Non-Dashboard Pages

**Date:** 2026-04-17
**Status:** Approved

## Context

All app pages share `DashboardShell` as their layout wrapper. The shell's root div uses `h-screen overflow-hidden`, which works for the main dashboard (DashboardContent manages its own internal scroll) but clips content on other pages (analytics, review, followups, settings) when it exceeds the viewport height. Users can't scroll to see content below the fold.

The fix: add a `scrollable` prop to DashboardShell that swaps the fixed-height, overflow-hidden root for a natural full-page scroll layout.

## Design

### DashboardShell — single prop addition

`scrollable?: boolean` (default `false`)

When `false` (current behavior):
```
root: h-screen flex bg-background overflow-hidden
```

When `true` (full-page scroll):
```
root: min-h-screen flex flex-col bg-background
```

The NavBar, NavSidebar, and content area are unchanged in structure — only the root's height constraint and overflow behavior change.

### Files changed

| File | Change |
|------|--------|
| `components/layout/DashboardShell.tsx` | Add `scrollable?: boolean` prop; conditionally apply root class |
| `app/dashboard/analytics/page.tsx` | Add `scrollable` to `<DashboardShell>` |
| `app/dashboard/review/page.tsx` | Add `scrollable` to `<DashboardShell>` |
| `app/dashboard/followups/page.tsx` | Add `scrollable` to `<DashboardShell>` |
| `app/dashboard/settings/page.tsx` | Add `scrollable` to `<DashboardShell>` |

### What stays the same

- Dashboard page (`app/dashboard/page.tsx`) — no change, keeps fixed layout
- NavSidebar on mobile (overlay drawer) — unaffected
- Toolbar, NavBar, CommandPalette — unaffected
- All existing tests — no behavior change

## Verification

1. Open `/dashboard/analytics` — all 6 metric sections visible by scrolling down
2. Open `/dashboard/settings` — all 4 sections reachable by scroll
3. Open `/dashboard` — layout unchanged, DashboardContent internal scroll still works
4. Resize viewport to mobile — no regression on any page
