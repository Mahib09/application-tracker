# Architecture

## Overview

Application Tracker is a Next.js 16 App Router application that automatically imports job applications from Gmail and classifies them using a multi-stage AI pipeline.

## Request Flow

```
Browser → Next.js Route Handler (app/api/) → Service Layer (server/services/) → Prisma → PostgreSQL
```

Route handlers in `app/api/` handle auth checks and HTTP concerns, then delegate all business logic to service modules. No business logic lives in route files, and no `next/server` imports appear in services.

## Key Modules

### Auth (`auth.ts`, `middleware.ts`)

Auth.js v5 with Google OAuth. JWT strategy — no database session adapter. The middleware protects `/dashboard` routes, redirecting unauthenticated users to `/login`.

Gmail tokens (`access_token`, `refresh_token`) are stored in the `OauthToken` table and refreshed automatically when expired.

### Gmail Service (`server/services/gmail.service.ts`)

Builds an authenticated Gmail API client per user. Fetches emails using `format: 'minimal'` (subject + snippet only) with keyword and ATS domain queries. Refreshes expired OAuth tokens and writes them back to the database.

### Classification Pipeline (`server/services/classification.service.ts`)

Three-stage pipeline that processes fetched emails:

1. **Deterministic filter** — drops newsletters, social media, and promotions using metadata signals (unsubscribe headers, blocklisted domains, Gmail category labels). No AI cost.
2. **Haiku triage** — Claude Haiku 4.5 classifies remaining emails as YES/NO/UNCERTAIN for job relevance. Acts as a cost gate before the more expensive Sonnet stage.
3. **Sonnet classification** — Claude Sonnet 4.6 extracts company, role, status, location, and a confidence score from each email.

Confidence routing after classification:
- **> 0.9** — auto-committed
- **0.7–0.9** — flagged for review
- **< 0.7** — marked NEEDS_REVIEW

See [pipeline.md](pipeline.md) for the full design including prompts, fallback behavior, and observability fields.

### Sync Service (`server/services/sync.service.ts`)

Orchestrates the full sync flow: fetch emails → classify → upsert applications. Enforces a 15-minute cooldown between syncs. Tracks sync state and error info in the `SyncState` table. Runs a 30-day GHOSTED sweep for applications with no response.

### Application Service (`server/services/application.service.ts`)

CRUD operations for the `Application` model. Used by both the sync pipeline (create/update) and dashboard API routes (list/update).

## Data Layer

**ORM:** Prisma 7 with `@prisma/adapter-pg` for connection pooling.

**Connection URLs:**
- `DATABASE_URL` — pooler URL (port 6543, pgbouncer) for runtime queries
- `DIRECT_URL` — direct host (`db.<ref>.supabase.co:5432`) for migrations only

Connection URLs are configured in `prisma.config.ts` (Prisma 7 convention), not in the schema datasource block.

**Generated client** lives at `app/generated/prisma/` (gitignored). Run `npx prisma generate` after any schema change.

## Frontend

React 19 with Tailwind v4 and shadcn/ui components. Two views:

- **Table view** — sortable, filterable flat table with inline editing
- **Kanban view** — drag-and-drop columns by application status

Additional UI: command palette (`Ctrl+K`), keyboard shortcuts, undo toasts (Sonner), weekly summary with Recharts, responsive layout, dark mode via `next-themes`.

## Project Structure

```
app/
  api/              Route handlers (auth, applications, sync)
  dashboard/        Dashboard pages
  login/            Login page
components/
  ui/               shadcn/ui primitives
  dashboard/        Dashboard-specific components
  layout/           Layout components
server/
  services/         Business logic modules
  lib/              Prisma client singleton
lib/                Client-side utilities, hooks
prisma/
  schema.prisma     Database schema
types/              Shared TypeScript types
```
