# Paila — Dashboard UI Design Plan

> AI-powered job application tracker. Zero-input philosophy — the app does the work, the user just reviews.

---

## Design Philosophy

Paila is a **daily-use productivity tool**, not a marketing site. Every design decision follows from this:

- **Minimal, clean, shadcn-inspired** — muted palette, tight spacing, functional typography
- **Command-first architecture** — keyboard shortcuts and command palette are first-class, inspired by Linear and Polytask (github.com/yangshun/polytask)
- **Motion with restraint** — follow Emil Kowalski's principles: UI animations under 300ms, no animation for keyboard-initiated actions, speed creates perceived performance. Animate only to communicate state changes, never for decoration. The one exception is the sync animation (the app's hero moment) which can be more theatrical
- **Zero-input UX** — emails sync automatically, applications are classified by AI, status transitions happen without user intervention. The UI surfaces results, not process

### Motion Design Rules (Emil Kowalski)

These rules apply globally across all components:

1. **Under 300ms for all UI transitions** — 150-200ms is ideal for most interactions. When in doubt, go faster
2. **Ease-out for entering elements, ease-in-out for moving elements** — use custom cubic-bezier curves, never default CSS `ease`. Recommended: `cubic-bezier(0.16, 1, 0.3, 1)` for snappy ease-out
3. **Animate only `transform` and `opacity`** — these are GPU-composited. Never animate `width`, `height`, `padding`, `margin`, or `top/left`
4. **No animation for keyboard-initiated actions** — when user presses `J/K` to navigate, `1-5` to change status, or any shortcut, the result should be instant. Animation is for mouse/touch interactions and system-initiated changes (sync, auto-ghost)
5. **Interruptible animations** — clicking rapidly should blend smoothly, not queue. Use Motion (framer-motion) which handles interruption natively, or CSS transitions (not keyframes) for interruptibility
6. **Origin-aware transforms** — dropdowns open from their trigger, toasts enter from the edge they're anchored to, sidebar slides from the right. Use `transform-origin` matching the logical source
7. **Scale buttons on press** — `scale(0.97)` on `:active` for tactile feedback. Never scale from `scale(0)`, always from `scale(0.9)` or higher
8. **Blur to bridge states** — when transitioning between complex states (view switching, sidebar open/close), a subtle `filter: blur(2px)` on the outgoing state masks imperfections for 1-2 frames
9. **Spring physics for drag interactions** — kanban drag-and-drop should use spring with `stiffness: 300, damping: 30`. Momentum-based dismissal with velocity threshold, not distance
10. **Respect `prefers-reduced-motion`** — provide opacity-only fallbacks, never remove all motion entirely

---

## Layout Structure

```
┌──────────────────────────────────────────────────────┐
│  Nav Bar                                             │
├──────────────────────────────────────────────────────┤
│  Toolbar                                             │
├──────────────────────────────────────────────────────┤
│  Weekly Summary Card (collapsible)                   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Content Area (Table or Kanban)                       │
│                                                      │
│                                                      │
├──────────────────────────────────────────────────────┤
│  Footer (table view only)                            │
└──────────────────────────────────────────────────────┘
```

When sidebar is open:

```
┌──────────────────────────────────────────────────────┐
│  Nav Bar                                             │
├──────────────────────────────────────────────────────┤
│  Toolbar                                             │
├──────────────────────────────────────────────────────┤
│  Weekly Summary (collapsible)                        │
├──────────────────────────┬───────────────────────────┤
│                          │                           │
│  Content Area (~60%)     │  Sidebar (~40%)           │
│                          │                           │
├──────────────────────────┴───────────────────────────┤
│  Footer                                              │
└──────────────────────────────────────────────────────┘
```

---

## Nav Bar

**Left:** Paila logo/wordmark

**Right (clustered, 8-12px gaps):**

- `⌘K` search pill — pill-shaped container with muted "Search..." placeholder text and a `⌘K` keyboard badge on the right end. Clicking or pressing `⌘K` opens the command palette. On mobile, this collapses to a magnifying glass icon
- Dark mode toggle — sun/moon icon button, no label. Instant switch, no animation on the toggle itself (high-frequency action)
- Account avatar — circular avatar that opens a dropdown with: settings, sync status, sign out

**Motion:** Nav bar is static. No scroll-hide, no shrink. It's always there. Dropdown menus open with `opacity 0→1` + `translateY(-4px)→0` + `scale(0.97)→1` in 150ms ease-out, transform-origin top-right.

---

## Toolbar

**Left:** Sync status indicator

- **Idle state:** Small green dot (6px) + "Synced 2m ago" in muted text + subtle refresh icon
- **Syncing state:** Dot replaced by a small spinner (12px) + "Syncing..." text. Spinner should be CSS-only, not a GIF
- **Error state:** Red dot + "Sync failed" + retry icon
- Clicking the refresh icon or "Sync failed" triggers a manual sync

**Right:** View toggle — two icon buttons (table icon, grid/kanban icon) with the active one highlighted. Switching views is instant on click (no animation — this is a high-frequency toggle). The content area below swaps without transition

**Motion:** Sync status text changes with a crossfade (`opacity` transition, 150ms). The green dot to spinner transition uses `scale(0.9)→1` + `opacity 0→1` in 150ms.

---

## Weekly Summary Card

A collapsible horizontal bar between toolbar and content.

**Collapsed (default after first visit):** Single line showing key stats:
"This week: 8 sent · 2 replies · 1 interview"
Small chevron icon on the right to expand.

**Expanded:** Slightly taller card showing:

- Mini bar chart of daily activity (past 7 days) — lightweight, inline SVG or a tiny recharts bar chart
- Week-over-week comparison: "↑ 3 more replies than last week" or "↓ 2 fewer interviews"
- Chevron flips to collapse

**"Since last visit" awareness:** If the user hasn't visited in 24+ hours, the collapsed line should read:
"Since last visit: 6 new applications, 3 auto-classified, 1 auto-ghosted"
This replaces the need for a notification center.

**Motion:** Collapse/expand animates height with `ease-out` at 200ms. Content fades in with 100ms delay after height reaches full. Chevron rotates 180° with the same timing. Use `clip-path` or `overflow: hidden` on the container to avoid layout shift — never animate `height` directly, instead animate `max-height` or use Motion's `layout` animation.

**Remembers preference:** Store collapse state in local storage. Default to collapsed.

---

## Statuses & Color System

Six fixed statuses in pipeline order. Colors are muted/pastel to fit the minimal aesthetic — not saturated primaries.

| Status       | Color                    | Icon            | Auto-Trigger                |
| ------------ | ------------------------ | --------------- | --------------------------- |
| Saved        | Gray (`#8B8B8B`)         | Bookmark        | Manual only                 |
| Applied      | Blue (`#3B82F6`)         | Send / Arrow-up | AI classification           |
| Interviewing | Amber (`#F59E0B`)        | Calendar        | AI classification           |
| Offer        | Green (`#22C55E`)        | Check-circle    | AI classification           |
| Rejected     | Red (`#EF4444`)          | X-circle        | AI classification           |
| Ghosted      | Muted purple (`#8B5CF6`) | Clock           | Auto at 30 days no response |

Colors appear as:

- **Table rows:** Small colored left-border (3px solid) or a colored dot (6px circle) in the status column
- **Kanban columns:** Colored accent on column header (bottom border or small dot next to title)
- **Sidebar:** Colored dot inside the status dropdown
- **Footer:** Colored dots next to each count

---

## Table View

### Structure

Each row represents one application. Rows have a subtle colored left border (3px) matching their status color.

**Columns (left to right):**

1. **Checkbox** — for bulk selection. Hidden by default, appears on hover over the row's left edge area (where the checkbox would be). When any checkbox is checked, all checkboxes become visible
2. **PAI-ID** — e.g. "PAI-047". Muted text, monospace-ish font. Useful for command palette quick-jump
3. **Company** — primary text, medium weight
4. **Role** — secondary text, regular weight
5. **Status** — colored dot (6px) + status label in muted text
6. **Date Applied** — relative format: "3d ago", "2w ago". Full date on hover tooltip
7. **Days Since** — days since last status change. Muted text. "14d" format. Turns amber past 20d for Applied status (ghost warning)

**Column headers** are clickable to sort. Small arrow indicator shows sort direction. Default sort: newest first by date applied.

### Row Interactions

- **Hover:** Subtle background highlight (`bg-muted/50` equivalent). Checkbox area becomes visible
- **Click:** Opens sidebar with that application's details. Row gets a stronger highlight to indicate selection
- **Right-click:** Context menu with: status change submenu (all 6 statuses with colored dots), delete, copy PAI-ID. Context menu opens with `opacity 0→1` + `scale(0.97)→1` in 120ms ease-out, origin-aware from cursor position
- **Keyboard focus (J/K):** Focused row gets a distinct left-border glow or a slightly brighter highlight. Focus is instant — no animation for keyboard navigation
- **Long-press (mobile):** Opens context menu

### Bulk Actions

When one or more checkboxes are selected, a floating action bar appears at the bottom of the content area (above the footer):
"3 selected — Move to [status dropdown] | Delete"

**Motion:** Action bar enters from below with `translateY(8px)→0` + `opacity 0→1` in 150ms ease-out. Exits the same way reversed.

### Review Items

Applications in the 60-90% AI confidence band that need human confirmation appear as special rows in the table. They have:

- A slightly different background (very subtle warm tint or dashed left border instead of solid)
- Grouped at the top of the table
- Inline **Confirm** and **Dismiss** buttons on the right side of the row
- The row shows what the AI thinks: "Looks like: Applied to Stripe, SE · 78% confidence"

After confirming, the row smoothly transitions to a normal row (background change fades over 200ms, confirm/dismiss buttons fade out). After dismissing, the row fades out and collapses (`opacity→0` + `height→0` in 250ms ease-in-out).

### Footer

Fixed at the bottom of the table view. Single line with status breakdown:
"47 total · 12 Applied · 3 Interviewing · 1 Offer · 8 Rejected · 5 Ghosted · 18 Saved"

Each status has its colored dot before the count. The counts update in real-time during sync (numbers tick up, not jump — use a counter animation that's very fast, ~100ms per increment).

---

## Grid / Kanban View

### Structure

Six fixed columns in pipeline order: Saved → Applied → Interviewing → Offer → Rejected → Ghosted

Each column has:

- **Header:** Status icon + status name + count in parentheses. Small colored bottom-border accent (2px). Count pulses briefly (scale 1→1.1→1 in 200ms) when a new card enters the column during sync
- **Body:** Vertically scrollable stack of cards. Empty columns show just the header and blank space below — no placeholder text, no dashed borders

### Cards

Each card shows:

- Status icon (matching column, small, left-aligned)
- Company name (primary text, medium weight)
- Role title (secondary text, regular weight, muted color)
- Days since last status change ("14d" in muted small text)
- **Ghost progress ring** (Applied and Saved cards only): A tiny 16px circular progress indicator. Empty at day 0, fills clockwise to full at day 30. Gray by default, transitions to amber past day 20. Positioned top-right of the card. Built with SVG `stroke-dasharray` / `stroke-dashoffset`

**Card interactions:**

- **Hover:** Subtle shadow lift or background brightening
- **Click:** Opens sidebar with application details
- **Right-click:** Same context menu as table rows
- **Drag:** Pick up card for drag-and-drop between columns

### Drag and Drop

- **Pickup:** Card lifts with `scale(1.02)` + subtle shadow increase in 150ms. Other cards in the column smoothly close the gap (Motion `layout` animation with spring `stiffness: 300, damping: 30`)
- **Dragging:** Card follows cursor/finger with spring physics (slight lag for natural feel). Target column highlights with a very subtle background change when the card hovers over it
- **Drop:** Card settles into new column with spring animation. The card's left border/icon color transitions from old status to new status over 200ms. Column counts update — old column count decreases, new column count increases with the pulse animation
- **Cancel (drop back):** Card springs back to original position

**Motion notes:** Use spring physics, not linear/ease timing, for all drag interactions. Enable pointer capture during drag so tracking continues even if pointer leaves the card boundary. On mobile, long-press to initiate drag. Consider velocity-based acceptance — a fast flick toward a column should snap the card there even if the pointer isn't precisely over the column.

### Status Transition Animation

When a card moves between columns (via drag, context menu, sidebar dropdown, or auto-classification):

- Card slides horizontally to the new column with spring animation (~250ms)
- Card's accent color transitions from old status color to new status color over 200ms ease-in-out
- Source column cards close the gap, target column cards make room — both with spring layout animation

---

## Sidebar (Application Detail Panel)

### Layout

Opens on the right side. Content area shrinks to ~60% width, sidebar takes ~40%. The split is fixed, not resizable.

**Motion:** Sidebar slides in from right with `translateX(100%)→0` in 200ms `cubic-bezier(0.16, 1, 0.3, 1)`. Content area width transition happens simultaneously — use a CSS transition on `width` or `flex-basis` at the same duration. The combined effect should feel like the sidebar pushes the content to the left.

### Sidebar Header (fixed, non-scrollable)

- **PAI-ID** — "PAI-047" in muted monospace text, top-left
- **Navigation arrows** — Up (↑) and Down (↓) icon buttons to cycle through applications without closing the sidebar. These follow the current table sort order or kanban column order
- **Close button** — X icon, top-right
- **Delete button** — Trash icon with muted/danger styling. Triggers delete with undo toast (no confirmation modal)

### Sidebar Body (scrollable)

All fields are editable inline. Clicking a field switches it to edit mode (input/dropdown). Pressing Enter or clicking outside confirms. Changes save automatically (optimistic update).

**Fields in order:**

1. **Status** — dropdown with colored dot for each option. Changing status here triggers the same transition animation as drag-and-drop (if in kanban view, the card visually moves columns)
2. **Company** — text input
3. **Role** — text input
4. **Salary / Compensation** — text input (freeform, user might write "$120k-150k" or "CAD $80k")
5. **Location** — text input
6. **Date Applied** — date picker
7. **Source** — dropdown: Cold Email, Inbound, Job Board, Referral, Other
8. **URL** — text input for job posting link (clickable when not editing)
9. **Notes** — textarea, expandable

### Status Timeline (bottom of sidebar body)

A vertical timeline showing every status change for this application. Newest at top.

**Structure:** Small dots connected by a thin vertical line. Each entry:

- Colored dot matching the status
- Status name in that status's color
- Date (relative: "3d ago")
- Source label in muted text: "Auto-classified" | "Manual" | "Auto-ghosted · 30d no response" | "Drag-and-drop" | "Command palette"

This timeline is read-only. It's a log, not an interaction point.

**Motion:** When a new entry is added (status changes while sidebar is open), the new entry slides in from the top with `translateY(-8px)→0` + `opacity 0→1` in 150ms, pushing older entries down with layout animation.

---

## Sync Animation (Hero Moment)

This is Paila's signature interaction — the moment emails are classified and applications appear in the pipeline. It should feel alive.

### During Sync

1. Toolbar sync indicator switches to spinning state + "Syncing..." text
2. As each new application is classified and created:
   - **Table view:** New row slides in from the top with `translateY(-12px)→0` + `opacity 0→1` in 200ms ease-out. The status dot animates from gray to its final color over 300ms (the only animation allowed to exceed 300ms — it represents "AI deciding"). Rows are staggered 150ms apart if multiple arrive at once
   - **Kanban view:** New card drops into its column from above with the same stagger. Column header count pulses as each card lands
3. Footer counts tick up in real-time as cards/rows land
4. When sync completes, toolbar returns to idle state with "Synced just now"

### First Sync (Account Setup)

The very first sync after connecting Gmail is more dramatic — potentially processing 50+ emails. The stagger timing can be slower (200ms apart) and the empty state transitions to populated state. This is the onboarding moment — let it breathe.

### Toast on Sync Completion

A single toast appears: "Synced: 4 new, 2 auto-classified, 3 need review"
Tapping the toast scrolls to new items (table) or highlights them (kanban).
Toast auto-dismisses after 4 seconds. Uses Sonner pattern: enters from bottom with `translateY(100%)→0` in 400ms ease, dismisses with swipe or auto-timeout.

---

## Auto-Ghost System

Every sync checks: are there Applied-status applications older than 30 days with no detected email reply?

If yes:

- Status auto-transitions to Ghosted
- Timeline entry logged: "Auto-ghosted · 30d no response"
- If the sidebar is open for that application, the status dropdown animates to Ghosted
- On kanban, the card slides from Applied column to Ghosted column with the standard transition animation
- A toast appears: "2 applications auto-ghosted (30d no response)" with an **Undo** button
- Undo button persists for 5 seconds, then the toast dismisses

If a reply email is detected later for a ghosted application:

- Status auto-transitions back to the appropriate status (likely Interviewing or Applied)
- Timeline logs: "Auto-reclassified · Reply detected"
- Toast: "Stripe replied — moved back to Applied"

---

## Empty States

Three distinct states for three moments:

### 1. Pre-Connect (No Gmail linked)

The entire dashboard renders with **skeleton/ghost data** — fake rows in the table (or fake cards in kanban) with blurred or pulsing placeholder blocks where text would be. Muted gray, subtle pulse animation (opacity 0.4→0.7 cycling at 1.5s). Footer shows placeholder counts.

Overlaid centered: A card with:

- Paila logo or icon
- "Connect your Gmail to start tracking"
- Single "Connect Gmail" primary button
- One-line subtext: "Paila automatically finds and classifies your job applications"

**Motion:** The skeleton pulse is the only animation. The overlay card is static.

### 2. Post-Connect, Syncing

Skeletons remain but the overlay changes to:

- "Scanning your inbox..."
- A count of emails processed so far (incrementing number)
- A small progress indicator (not a progress bar — you don't know total, so use a spinner or pulsing dot)

As applications are found, skeleton rows/cards start being replaced by real data (skeleton fades out, real row fades in).

### 3. Synced but Zero Results

Overlay replaced by a centered message in the content area:

- "No applications detected yet"
- "Paila will automatically track new ones as they arrive"
- No action button needed — the system is working, there's just nothing yet

---

## Command Palette

Triggered by clicking the `⌘K` search pill or pressing `⌘K`. Built with `cmdk` library.

### Structure

Centered overlay with backdrop dim. Search input at top. Grouped results below.

**Groups:**

- **Search** — type to find applications by company name, role, or PAI-ID. Results show as mini rows with status dot + company + role
- **Navigation** — Switch to Table View, Switch to Grid View, Open Settings
- **Actions** — Change Status (opens sub-menu with all 6 statuses), Delete Selected, Trigger Sync, Mark All Reviewed
- **Theme** — Toggle Dark Mode

Selecting a search result opens that application's sidebar. Selecting an action executes it immediately.

**Motion:** Palette opens with `opacity 0→1` + `scale(0.97)→1` in 150ms ease-out. Results list updates instantly as you type (no animation on list changes — this is a high-frequency interaction). Palette closes with reverse animation. Backdrop fades with `opacity 0→0.5` in 150ms.

---

## Keyboard Shortcuts

| Shortcut  | Action                                           | Animation?                                                                    |
| --------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `J` / `K` | Navigate down/up between applications            | No — instant focus change                                                     |
| `T`       | Switch to table view                             | No — instant                                                                  |
| `G`       | Switch to grid/kanban view                       | No — instant                                                                  |
| `E`       | Open edit mode on first field in sidebar         | No — instant focus                                                            |
| `D`       | Delete selected application (undo toast)         | Toast animates in                                                             |
| `1-6`     | Quick-set status (1=Saved, 2=Applied, etc.)      | No — instant status change, but kanban card movement animates if in grid view |
| `⌘K`      | Open command palette                             | Palette open animation                                                        |
| `Esc`     | Close sidebar / palette / cancel                 | Reverse of open animation                                                     |
| `?`       | Open keyboard shortcut cheatsheet modal          | Modal open animation                                                          |
| `Enter`   | Open sidebar for focused application             | Sidebar slide animation                                                       |
| `Y`       | Confirm review item (when review row is focused) | Row transitions to normal                                                     |
| `N`       | Dismiss review item (when review row is focused) | Row fades out                                                                 |

### Keyboard Shortcut Cheatsheet Modal

Pressing `?` opens a centered modal listing all shortcuts grouped by category. Simple two-column layout: shortcut key(s) on left, description on right.

**Motion:** Same as command palette — `opacity` + `scale(0.97)→1` in 150ms.

---

## Responsive Behavior

### Desktop (> 1024px)

Full layout as described above. Table and kanban views both available. Sidebar splits content at ~60/40.

### Tablet (640px - 1024px)

- Table view available but with fewer columns: Company, Role, Status, Date. PAI-ID and Days Since hidden
- Kanban shows all 6 columns, compressed cards (company name only, no role subtitle). Horizontal scroll if columns overflow
- Sidebar does 50/50 split. On smaller tablets (640-768px), sidebar becomes an overlay instead of split
- Weekly summary card works at full width
- Nav bar unchanged

### Mobile (< 640px)

- **No table view** — view toggle hidden. Always kanban
- **Logo** shrinks to "P" mark or small icon
- **⌘K pill** becomes a magnifying glass icon button
- **Kanban is horizontal scroll with snap:**
  - Each column is 75-80% of screen width (peek at next column to signal scrollability)
  - `scroll-snap-type: x mandatory` on container, `scroll-snap-align: start` on each column
  - Snap should feel magnetic — smooth deceleration with firm lock-in. CSS scroll-snap handles this natively
  - Flick velocity matters: light swipe = one column, hard flick = skip columns
  - Small dot indicator below columns (like iOS page dots) showing current position. Active dot colored to match current status column
  - Empty columns still snap to and display at full width — just header + blank space
  - Cards stack vertically within each column with normal vertical scroll
  - Status header with count stays sticky at top of each column as you scroll vertically
- **Sidebar becomes bottom sheet:**
  - Slides up to ~85% screen height with drag handle at top
  - Swipe down to dismiss
  - Up/down arrows in header still cycle through applications
  - When bottom sheet is open, bulk select mode is disabled (and vice versa)
- **Drag-and-drop:** Disabled on mobile. Use context menu (long-press) or sidebar status dropdown to change status instead — touch drag-and-drop is always janky
- **Right-click → Long-press:** Context menu triggered by long-press on cards
- **Bulk select:** Long-press to enter select mode, tap to toggle selection, floating action bar at bottom
- **Toolbar:** Sync status and filter icon (if filtering added later). Tighter spacing
- **Weekly summary:** Default collapsed, single-line stats only

---

## Undo System

All destructive actions use undo toasts instead of confirmation modals. This is faster and more forgiving.

**Pattern:**

1. Action executes immediately (optimistic)
2. Toast appears: "[Description of action] · **Undo**"
3. Toast persists for 5 seconds with a subtle progress bar showing time remaining
4. If Undo is clicked: action is reversed, toast changes to "Undone" for 1.5 seconds then dismisses
5. If toast expires: action is committed permanently

**Actions that support undo:**

- Delete application
- Status change (manual)
- Bulk status change
- Bulk delete
- Auto-ghost (when toast appears for ghosted applications)

**Toast motion:** Follows Sonner patterns — enters from bottom-left with `translateY(100%)→0` in 400ms ease. Stacks if multiple toasts (scale + offset stagger). Dismisses with swipe-right or auto-timeout. Progress bar is a thin line at the bottom of the toast that shrinks from left to right over the 5-second window.

---

## Search & Filtering

### Command Palette Search

Typing in `⌘K` searches across all applications by company, role, or PAI-ID. Results appear instantly (filter client-side data, no debounce needed for local search).

### Search Highlighting

When a search term is active (from `⌘K` or a future filter bar), matching text in table rows or kanban cards is highlighted with a subtle warm background (like `bg-yellow-100` in light mode, `bg-yellow-900/30` in dark mode). The highlight is applied to the substring match only, not the entire field.

---

## Dark Mode

Toggle via nav bar icon or command palette. Uses `next-themes` for system preference detection + manual override.

**Approach:** CSS variables for all colors. Dark mode inverts backgrounds and adjusts text contrast but keeps status colors consistent (blue, amber, green, red, purple stay recognizable in both themes). The ghost progress ring, status dots, and kanban column accents should look good in both modes — test specifically.

**Motion on toggle:** No animation. Instant switch. This is a high-frequency preference toggle — adding a transition would feel sluggish on repeated use.

---

## Design References

- **Polytask** (github.com/yangshun/polytask) — command registry architecture, keyboard shortcut system, command palette with cmdk, Redux with undo/redo
- **Linear** — overall aesthetic, information density, keyboard-first UX
- **Emil Kowalski** (emilkowal.ski) — motion design principles, Sonner toast patterns, restraint philosophy
- **shadcn/ui** — component styling baseline, muted palette, clean forms

---

## Post-V1 Backlog (Not in scope now)

- Interview sub-stages (Phone Screen, Take Home, Onsite, Final) as a detail inside sidebar, not new kanban columns
- Custom statuses
- Resizable sidebar (draggable edge)
- Onboarding tooltip walkthrough
- AI confidence score display on cards/rows
- Notification center
- Table view on mobile
