# CLAUDE.md

## Commands

```bash
npm run dev          # dev server (localhost:3000)
npm run build        # production build
npm run lint         # ESLint
npm test             # vitest watch
npm run test:run     # vitest single run (CI)
npx prisma migrate dev --name <name>  # after schema changes
npx prisma generate                   # always run after migrate
```

## Architecture

Next.js 16 App Router. Route handlers delegate to `server/services/` — no business logic in routes, no `next/server` in services.

### Classification Pipeline

Deterministic filter → Haiku triage → Sonnet classification → confidence routing. Deterministic code NEVER decides role, status, or job-relevance — that is always AI. Full design: `docs/pipeline-redesign.md`.

## Prisma 7

Connection URLs in `prisma.config.ts`, NOT in `schema.prisma`. Generated client at `app/generated/prisma/` (gitignored). Enums: `import { applicationStatus } from "@/app/generated/prisma/enums"` (lowercase names, uppercase values).

## Gotchas

- `User.upadatedAt` — typo is intentional, live DB column, do not rename
- `OauthToken.refreshToken` — required `String`, not nullable
- `DIRECT_URL` must be true direct host `db.[ref].supabase.co:5432` — pooler host fails migrations
- All model IDs are `@db.Uuid`

## Auth

`auth.ts` exports `{ handlers, auth, signIn, signOut }`. JWT strategy, no prisma-adapter. All API routes must call `await auth()` and return 401 if null. Never read userId from request body.

## Testing

Vitest + jsdom. Tests in `__tests__/` mirror source. Always mock `@/server/lib/prisma`, `googleapis`, and `@anthropic-ai/sdk`.

## Env Vars

`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `DATABASE_URL` (pooler, runtime), `DIRECT_URL` (direct, migrations only).
