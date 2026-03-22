# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # production build
npm run lint         # ESLint
npm test             # vitest in watch mode
npm run test:run     # vitest single run (CI)

# Run a single test file
npm test -- __tests__/services/classification.test.ts

# After any schema change — always run both
npx prisma migrate dev --name <migration_name>
npx prisma generate
```

## Architecture

Next.js 16 App Router with a strict layering convention:

```
app/api/          → Route handlers (auth check, delegate to services)
server/services/  → All business logic (no HTTP knowledge)
server/lib/       → Infrastructure (Prisma singleton)
components/       → Client components ("use client")
app/**/page.tsx   → Server components (data fetch, no client state)
```

**Data flow for a request:** Route handler → `auth()` → service function → Prisma → DB. Route handlers never contain business logic; services never import from `next/server`.

**Sync pipeline** (`server/services/`):
1. `gmail.service.ts` — Gmail API client, token refresh, email fetch (`format:'full'`)
2. `classification.service.ts` — `preprocessEmail` (strip HTML/PII, truncate 500 chars) → regex Stage 1 → Claude Haiku Stage 2 (only unclassified, batches of 20)
3. `sync.service.ts` — orchestrates: cooldown check → fetch → classify → upsert → update `SyncState`

Raw email text (subject + body) is **never persisted** — discarded after classification. Only extracted fields (`company`, `roleTitle`, `status`) are stored.

## Prisma 7 Critical Details

Connection URLs live in `prisma.config.ts`, **not** in `schema.prisma` datasource block (Prisma 7 breaking change).

```typescript
// Prisma client — import from generated output (relative from server/ files)
import { PrismaClient } from "../../app/generated/prisma/client"

// Prisma singleton — use everywhere else
import { prisma } from "@/server/lib/prisma"

// Enums — MUST use this exact path; names are lowercase, values are uppercase
import { applicationStatus, applicationSource, lastSyncStatus } from "@/app/generated/prisma/enums"
// e.g. applicationStatus.APPLIED  (not ApplicationStatus.APPLIED)
```

`app/generated/prisma/` is gitignored. Run `npx prisma generate` after any schema change, even without a migration.

## Schema Gotchas

- `OauthToken.refreshToken` is `String` (required, not nullable) — always provide a value
- `User.upadatedAt` has a typo (two 'a's) — it's a live DB column, do not rename it
- All model IDs use `@db.Uuid` — stored and returned as UUID strings

## Auth (NextAuth v5)

`auth.ts` (root) exports `{ handlers, auth, signIn, signOut }`. No `@auth/prisma-adapter` — tokens are stored manually in `signIn` callback via `server/services/auth.service.ts`.

- **Session strategy:** JWT. `session.user.id` is the DB UUID (set via `jwt` callback → `session` callback).
- **Token storage:** `OauthToken` table, one row per user (`userId` is the PK).
- **Gmail scope:** `https://www.googleapis.com/auth/gmail.readonly` with `access_type:'offline'` + `prompt:'consent'` — required to receive a `refresh_token`.
- All API routes must call `const session = await auth()` and return 401 if null. Never read `userId` from query params or request body.

## Database URLs

- `DATABASE_URL` — Supabase pooler (pgbouncer, port 6543) — used at runtime
- `DIRECT_URL` — must be the **true direct** host `db.[ref].supabase.co:5432` — used only for `prisma migrate dev`. If it points to the pooler host, migrations fail with "Tenant or user not found".

## Testing

Vitest with jsdom. Tests live in `__tests__/` mirroring the source structure.

- Server-side unit tests mock `@/server/lib/prisma` with `vi.mock`
- Component tests use `@testing-library/react`
- AI/external API calls (`googleapis`, `@anthropic-ai/sdk`) are always mocked in tests

## Key env vars

| Var | Used for |
|-----|----------|
| `DATABASE_URL` | Runtime Prisma queries |
| `DIRECT_URL` | Prisma migrations only |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | NextAuth Google provider |
| `AUTH_SECRET` | NextAuth JWT signing |
| `ANTHROPIC_API_KEY` | Claude Haiku classification fallback |

## Implementation Plan

`docs/plan.md` contains the full phase-by-phase implementation plan with TDD steps, exact code, and verification checklists. Each phase is independently triggerable. Read it before starting any implementation work.
