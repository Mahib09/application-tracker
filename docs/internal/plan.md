# Application Tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-powered job application tracker that automatically imports and classifies job applications from Gmail into a dashboard with stats, sorting, filtering, and inline editing.

**Architecture:** Google OAuth (NextAuth v5) stores Gmail tokens in Postgres; a sync pipeline fetches emails with `format:full`, preprocesses them (strip HTML/PII, truncate to 500 chars), classifies via regex then Claude Haiku fallback, and upserts Application records; a Next.js server-component dashboard renders stats + table; a client-side SyncButton auto-fires on mount and handles manual re-sync.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · Prisma 7 + PostgreSQL (Supabase) · NextAuth v5 (`next-auth@beta`) · `googleapis` · `@anthropic-ai/sdk` (model: `claude-haiku-4-5-20251001`) · vitest

---

## Codebase Context (READ BEFORE STARTING ANY PHASE)

### What already exists

| File | What it does |
|------|-------------|
| `prisma/schema.prisma` | DB schema — `User`, `Application`, `SyncState`, `OauthToken` models |
| `server/lib/prisma.ts` | Prisma singleton via `@prisma/adapter-pg` |
| `server/services/application.service.ts` | `createApplication`, `listApplications`, `updateApplication` |
| `app/api/applications/route.ts` | GET (list) + POST (create) — currently reads userId from query/body |
| `app/api/applications/[id]/route.ts` | PATCH (update status/notes) — currently reads userId from body |
| `app/page.tsx` | Placeholder "hello" |

### Critical import patterns — match exactly

```typescript
// Prisma client (from server/ files — relative path)
import { PrismaClient } from "../../app/generated/prisma/client"

// Prisma singleton (from anywhere)
import { prisma } from "@/server/lib/prisma"

// Enums — MUST use this path, names are LOWERCASE
import { applicationStatus, applicationSource, lastSyncStatus } from "@/app/generated/prisma/enums"
// Values are UPPERCASE: applicationStatus.APPLIED, applicationStatus.INTERVIEW, etc.
```

### Schema gotchas

- `OauthToken.refreshToken` is `String` (required, NOT nullable) — always provide a value
- `User.upadatedAt` has a typo (two 'a's) — do NOT fix it, it's a live DB column
- All IDs are `@db.Uuid` — UUIDs stored as strings
- After any schema change: `npx prisma migrate dev --name <name>` → `npx prisma generate`
- `"type": "module"` in `package.json` — project is ESM

---

## Phase 0 — Test Setup (run once before any phase)

**Files:** `vitest.config.ts`, `vitest.setup.ts`, `package.json` (scripts only)

### Task 0.1 — Install and configure vitest

- [ ] Install dependencies:
  ```bash
  npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
  ```

- [ ] Create `vitest.config.ts`:
  ```typescript
  import { defineConfig } from "vitest/config"
  import react from "@vitejs/plugin-react"
  import path from "path"

  export default defineConfig({
    plugins: [react()],
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./vitest.setup.ts"],
      include: ["**/*.test.ts", "**/*.test.tsx"],
      exclude: ["node_modules", ".next", "app/generated"],
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, ".") },
    },
  })
  ```

- [ ] Create `vitest.setup.ts`:
  ```typescript
  import "@testing-library/jest-dom"
  ```

- [ ] Add to `package.json` `"scripts"` block:
  ```json
  "test": "vitest",
  "test:run": "vitest run"
  ```

- [ ] Verify:
  ```bash
  npm test -- --reporter=verbose
  ```
  Expected: "No test files found" (not an error)

- [ ] Commit:
  ```bash
  git add vitest.config.ts vitest.setup.ts package.json package-lock.json
  git commit -m "chore: add vitest testing setup"
  ```

---

## Phase 1 — Auth (Google OAuth + Token Storage)

**Goal:** Users sign in with Google, Gmail tokens stored in DB, all routes protected.

**Prerequisite env vars** (add to `.env` before starting):
```
AUTH_GOOGLE_ID=       # Google Cloud Console → Credentials → OAuth 2.0 Client ID
AUTH_GOOGLE_SECRET=   # Google Cloud Console → Credentials → OAuth 2.0 Client Secret
AUTH_SECRET=          # openssl rand -base64 32
```

**Google Cloud Console setup:**
1. Create OAuth 2.0 client (Web application type)
2. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
3. Scopes: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/gmail.readonly`

**Files:**
- Create: `auth.ts` (root)
- Create: `types/next-auth.d.ts`
- Create: `middleware.ts` (root)
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/login/page.tsx`
- Create: `server/services/auth.service.ts`
- Modify: `app/page.tsx`
- Modify: `app/api/applications/route.ts`
- Modify: `app/api/applications/[id]/route.ts`
- Create: `__tests__/auth/auth-callbacks.test.ts`
- Create: `__tests__/api/applications.test.ts`

---

### Task 1.1 — Install next-auth

- [ ] Install:
  ```bash
  npm install next-auth@beta
  ```
  > **Do NOT install `@auth/prisma-adapter`** — it requires `Account`, `Session`, `VerificationToken` tables that don't exist in this schema. Tokens are stored manually via callbacks.

- [ ] Commit: `git add package.json package-lock.json && git commit -m "chore: install next-auth@beta"`

---

### Task 1.2 — TypeScript session augmentation

- [ ] Create `types/next-auth.d.ts`:
  ```typescript
  import { DefaultSession } from "next-auth"

  declare module "next-auth" {
    interface Session {
      user: { id: string } & DefaultSession["user"]
    }
  }
  ```

- [ ] Commit: `git add types/ && git commit -m "chore: add next-auth session type augmentation"`

---

### Task 1.3 — Auth service (testable sign-in logic)

Extracting sign-in DB logic into a pure function makes it testable without spinning up NextAuth.

- [ ] Write failing test — create `__tests__/auth/auth-callbacks.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from "vitest"

  vi.mock("@/server/lib/prisma", () => ({
    prisma: {
      user: { upsert: vi.fn(), findUnique: vi.fn() },
      oauthToken: { upsert: vi.fn() },
    },
  }))

  import { prisma } from "@/server/lib/prisma"

  describe("handleSignIn", () => {
    beforeEach(() => vi.clearAllMocks())

    it("upserts user and stores tokens, returns true", async () => {
      const mockUser = { id: "uuid-123", email: "test@example.com", name: "Test", image: null }
      vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.oauthToken.upsert).mockResolvedValue({} as any)

      const { handleSignIn } = await import("@/server/services/auth.service")
      const result = await handleSignIn({
        email: "test@example.com",
        name: "Test",
        image: null,
        accessToken: "access-123",
        refreshToken: "refresh-456",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        scope: "openid email",
      })

      expect(result).toBe(true)
      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: "test@example.com" } })
      )
      expect(prisma.oauthToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "uuid-123" },
          create: expect.objectContaining({ accessToken: "access-123" }),
        })
      )
    })

    it("returns false when no refresh token (blocks sign-in)", async () => {
      const { handleSignIn } = await import("@/server/services/auth.service")
      const result = await handleSignIn({
        email: "test@example.com", name: "Test", image: null,
        accessToken: "access-123", refreshToken: null,
        expiresAt: null, scope: null,
      })
      expect(result).toBe(false)
      expect(prisma.user.upsert).not.toHaveBeenCalled()
    })
  })
  ```

- [ ] Run — expect FAIL: `npm test -- __tests__/auth/auth-callbacks.test.ts`

- [ ] Create `server/services/auth.service.ts`:
  ```typescript
  import { prisma } from "@/server/lib/prisma"

  interface SignInParams {
    email: string
    name: string | null | undefined
    image: string | null | undefined
    accessToken: string
    refreshToken: string | null | undefined
    expiresAt: number | null | undefined
    scope: string | null | undefined
  }

  /**
   * Upserts the User record and stores OAuth tokens in OauthToken.
   * Returns false (blocks sign-in) if no refresh token is present.
   * A missing refresh token means the user previously consented but didn't
   * re-consent — they must sign out and sign in again with prompt:'consent'.
   */
  export async function handleSignIn(params: SignInParams): Promise<boolean> {
    if (!params.refreshToken) return false

    const dbUser = await prisma.user.upsert({
      where: { email: params.email },
      update: { name: params.name, image: params.image },
      create: { email: params.email, name: params.name, image: params.image },
    })

    await prisma.oauthToken.upsert({
      where: { userId: dbUser.id },
      update: {
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        expiresAt: params.expiresAt ? new Date(params.expiresAt * 1000) : null,
        scope: params.scope,
      },
      create: {
        userId: dbUser.id,
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        expiresAt: params.expiresAt ? new Date(params.expiresAt * 1000) : null,
        scope: params.scope,
      },
    })

    return true
  }
  ```

- [ ] Run — expect PASS: `npm test -- __tests__/auth/auth-callbacks.test.ts`

- [ ] Commit:
  ```bash
  git add server/services/auth.service.ts __tests__/auth/
  git commit -m "feat(auth): add auth service with testable sign-in logic"
  ```

---

### Task 1.4 — Create auth.ts (NextAuth config)

- [ ] Create `auth.ts` (root):
  ```typescript
  import NextAuth from "next-auth"
  import Google from "next-auth/providers/google"
  import { prisma } from "@/server/lib/prisma"
  import { handleSignIn } from "@/server/services/auth.service"

  export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        authorization: {
          params: {
            scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
            access_type: "offline",
            prompt: "consent", // Always request refresh_token
          },
        },
      }),
    ],
    session: { strategy: "jwt" },
    callbacks: {
      async signIn({ user, account }) {
        if (account?.provider !== "google") return false
        return handleSignIn({
          email: user.email!,
          name: user.name,
          image: user.image,
          accessToken: account.access_token!,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          scope: account.scope,
        })
      },
      async jwt({ token, user }) {
        // On first sign-in, user.email is available — resolve DB userId
        if (user?.email) {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email },
            select: { id: true },
          })
          if (dbUser) token.userId = dbUser.id
        }
        return token
      },
      async session({ session, token }) {
        if (token.userId) session.user.id = token.userId as string
        return session
      },
    },
  })
  ```

- [ ] Create `middleware.ts` (root):
  ```typescript
  import { auth } from "./auth"
  import { NextResponse } from "next/server"

  export default auth((req) => {
    const isAuthenticated = !!req.auth
    if (req.nextUrl.pathname.startsWith("/dashboard") && !isAuthenticated) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
    return NextResponse.next()
  })

  export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  }
  ```

- [ ] Create `app/api/auth/[...nextauth]/route.ts`:
  ```typescript
  import { handlers } from "@/auth"
  export const { GET, POST } = handlers
  ```

- [ ] Commit:
  ```bash
  git add auth.ts middleware.ts app/api/auth/
  git commit -m "feat(auth): add NextAuth v5 config, middleware, and auth handler"
  ```

---

### Task 1.5 — Login page + home redirect

- [ ] Create `app/login/page.tsx`:
  ```tsx
  "use client"
  import { signIn } from "next-auth/react"

  export default function LoginPage() {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-xl border bg-white p-10 shadow-sm text-center space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900">Application Tracker</h1>
          <p className="text-gray-500 text-sm">
            Automatically import and track job applications from Gmail.
          </p>
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </main>
    )
  }
  ```

- [ ] Update `app/page.tsx`:
  ```tsx
  import { auth } from "@/auth"
  import { redirect } from "next/navigation"

  export default async function Home() {
    const session = await auth()
    if (session) redirect("/dashboard")
    redirect("/login")
  }
  ```

- [ ] Create placeholder `app/dashboard/page.tsx` (replaced in Phase 3):
  ```tsx
  import { auth } from "@/auth"
  import { redirect } from "next/navigation"

  export default async function DashboardPage() {
    const session = await auth()
    if (!session) redirect("/login")
    return (
      <main className="p-8">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome, {session.user.name}</p>
        <p className="text-xs text-gray-400 mt-1">User ID: {session.user.id}</p>
      </main>
    )
  }
  ```

- [ ] Commit:
  ```bash
  git add app/login/ app/page.tsx app/dashboard/
  git commit -m "feat(auth): add login page, home redirect, and dashboard placeholder"
  ```

---

### Task 1.6 — Secure existing API routes

The current routes read `userId` from client-controlled inputs — a security flaw. Replace with server-side session.

- [ ] Write failing test — create `__tests__/api/applications.test.ts`:
  ```typescript
  import { describe, it, expect, vi } from "vitest"

  vi.mock("@/auth", () => ({ auth: vi.fn() }))
  vi.mock("@/server/services/application.service", () => ({
    listApplications: vi.fn().mockResolvedValue([]),
    createApplication: vi.fn().mockResolvedValue({ id: "app-1" }),
  }))

  import { auth } from "@/auth"
  import { GET, POST } from "@/app/api/applications/route"

  describe("GET /api/applications", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const res = await GET()
      expect(res.status).toBe(401)
    })

    it("returns 200 with applications for authenticated user", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
      const res = await GET()
      expect(res.status).toBe(200)
    })
  })

  describe("POST /api/applications", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const req = new Request("http://localhost/api/applications", {
        method: "POST",
        body: JSON.stringify({ company: "Acme", roleTitle: "SWE" }),
      })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })
  })
  ```

- [ ] Run — expect FAIL: `npm test -- __tests__/api/applications.test.ts`

- [ ] Update `app/api/applications/route.ts`:
  ```typescript
  import { auth } from "@/auth"
  import { createApplication, listApplications } from "@/server/services/application.service"
  import { NextResponse } from "next/server"

  export async function GET() {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    try {
      const applications = await listApplications(session.user.id)
      return NextResponse.json(applications, { status: 200 })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 400 },
      )
    }
  }

  export async function POST(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    try {
      const input = await req.json()
      const application = await createApplication(session.user.id, input)
      return NextResponse.json(application, { status: 201 })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 400 },
      )
    }
  }
  ```

- [ ] Update `app/api/applications/[id]/route.ts`:
  ```typescript
  import { auth } from "@/auth"
  import { updateApplication } from "@/server/services/application.service"
  import { NextResponse } from "next/server"

  export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    try {
      const { id: applicationId } = await params
      const patch = await req.json()
      const application = await updateApplication(session.user.id, applicationId, patch)
      return NextResponse.json(application, { status: 200 })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 },
      )
    }
  }
  ```

- [ ] Run — expect PASS: `npm test -- __tests__/api/applications.test.ts`

- [ ] Commit:
  ```bash
  git add app/api/applications/ __tests__/api/
  git commit -m "feat(auth): secure API routes — userId from session, not request body"
  ```

### Phase 1 verification

1. `npm run dev`
2. Visit `http://localhost:3000` → redirects to `/login`
3. Sign in with Google → redirects to `/dashboard` showing your name + UUID
4. Check Supabase: `User` table has your row; `OauthToken` has `accessToken` + `refreshToken`
5. `curl http://localhost:3000/api/applications` → `{"error":"Unauthorized"}` 401

---

## Phase 2 — Gmail Sync Pipeline

**Goal:** Fetch job emails from Gmail, classify via regex then Claude Haiku fallback, upsert Application records.

**Prerequisite:** Phase 1 complete (auth + OauthToken rows in DB).

**Prerequisite env var:**
```
ANTHROPIC_API_KEY=    # console.anthropic.com
```

**Before running migrations:** Verify `DIRECT_URL` in `.env` points to the **true direct** Postgres host:
```
DIRECT_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
```
The host must be `db.[ref].supabase.co` — NOT `aws-0-us-west-2.pooler.supabase.com`. Get it from Supabase dashboard → Settings → Database → Connection string → URI (not the pooler). If wrong, migrations fail with "Tenant or user not found".

**Files:**
- Modify: `prisma/schema.prisma` (add `gmailMessageId`)
- Create: `server/services/gmail.service.ts`
- Create: `server/services/classification.service.ts`
- Create: `server/services/sync.service.ts`
- Create: `app/api/sync/route.ts`
- Create: `__tests__/services/gmail.test.ts`
- Create: `__tests__/services/classification.test.ts`
- Create: `__tests__/services/sync.test.ts`

---

### Task 2.1 — DB migration: add gmailMessageId

- [ ] Edit `prisma/schema.prisma` — inside the `Application` model, after `notes`:
  ```prisma
  gmailMessageId String? // Gmail message ID — deduplication key for re-syncs
  ```

- [ ] Run migration (verify DIRECT_URL first):
  ```bash
  npx prisma migrate dev --name add_gmail_message_id
  ```
  Expected: "Your database is now in sync with your schema."

- [ ] Regenerate client:
  ```bash
  npx prisma generate
  ```

- [ ] Commit:
  ```bash
  git add prisma/schema.prisma prisma/migrations/
  git commit -m "feat(db): add gmailMessageId to Application for sync deduplication"
  ```

---

### Task 2.2 — Install packages

- [ ] Install:
  ```bash
  npm install googleapis @anthropic-ai/sdk
  ```

- [ ] Commit: `git add package.json package-lock.json && git commit -m "chore: install googleapis and anthropic sdk"`

---

### Task 2.3 — Gmail service

- [ ] Write failing test — create `__tests__/services/gmail.test.ts`:
  ```typescript
  import { describe, it, expect } from "vitest"

  describe("extractBodyText", () => {
    it("decodes base64url text/plain body", async () => {
      const { extractBodyText } = await import("@/server/services/gmail.service")
      const encoded = Buffer.from("Hello world email body").toString("base64url")
      const result = extractBodyText({ mimeType: "text/plain", body: { data: encoded } })
      expect(result).toBe("Hello world email body")
    })

    it("strips HTML tags from text/html body", async () => {
      const { extractBodyText } = await import("@/server/services/gmail.service")
      const html = "<p>We received your <strong>application</strong>.</p>"
      const encoded = Buffer.from(html).toString("base64url")
      const result = extractBodyText({ mimeType: "text/html", body: { data: encoded } })
      expect(result).toContain("We received your")
      expect(result).not.toContain("<p>")
    })

    it("returns empty string for null payload", async () => {
      const { extractBodyText } = await import("@/server/services/gmail.service")
      expect(extractBodyText(null)).toBe("")
    })

    it("recurses into multipart parts", async () => {
      const { extractBodyText } = await import("@/server/services/gmail.service")
      const encoded = Buffer.from("Plain text part").toString("base64url")
      const payload = {
        mimeType: "multipart/alternative",
        parts: [{ mimeType: "text/plain", body: { data: encoded } }],
      }
      expect(extractBodyText(payload)).toBe("Plain text part")
    })
  })
  ```

- [ ] Run — expect FAIL: `npm test -- __tests__/services/gmail.test.ts`

- [ ] Create `server/services/gmail.service.ts`:
  ```typescript
  import { google } from "googleapis"
  import { prisma } from "@/server/lib/prisma"

  export interface EmailRaw {
    messageId: string
    subject: string
    bodyText: string  // Raw text — preprocessed in classification service
    date: Date
  }

  /**
   * Extracts plain text from a Gmail message payload.
   * Prefers text/plain, falls back to stripping HTML from text/html.
   * Recurses into multipart messages.
   */
  export function extractBodyText(payload: any): string {
    if (!payload) return ""
    if (payload.mimeType === "text/plain" && payload.body?.data) {
      return Buffer.from(payload.body.data, "base64url").toString("utf-8")
    }
    if (payload.mimeType === "text/html" && payload.body?.data) {
      const html = Buffer.from(payload.body.data, "base64url").toString("utf-8")
      return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        const text = extractBodyText(part)
        if (text) return text
      }
    }
    return ""
  }

  /**
   * Builds an authenticated Gmail API client.
   * Refreshes the access token if expiring within 60 seconds and writes
   * the new token back to DB so subsequent calls don't re-refresh.
   */
  export async function getGmailClient(userId: string) {
    const tokenRecord = await prisma.oauthToken.findUnique({ where: { userId } })
    if (!tokenRecord) throw new Error(`No OAuth token for userId: ${userId}`)

    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET,
    )
    oauth2Client.setCredentials({
      access_token: tokenRecord.accessToken,
      refresh_token: tokenRecord.refreshToken,
      expiry_date: tokenRecord.expiresAt?.getTime(),
    })

    const isExpiring = !tokenRecord.expiresAt || tokenRecord.expiresAt.getTime() < Date.now() + 60_000
    if (isExpiring) {
      const { credentials } = await oauth2Client.refreshAccessToken()
      await prisma.oauthToken.update({
        where: { userId },
        data: {
          accessToken: credentials.access_token!,
          expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        },
      })
      oauth2Client.setCredentials(credentials)
    }

    return google.gmail({ version: "v1", auth: oauth2Client })
  }

  /**
   * Fetches job-application emails from Gmail since a given date.
   * Uses format:'full' to get body text (needed for accurate classification).
   * Subject keywords filter out unrelated email.
   */
  export async function fetchEmailsSince(userId: string, since?: Date): Promise<EmailRaw[]> {
    const gmail = await getGmailClient(userId)

    let q = "subject:(applied OR interview OR offer OR rejection OR congratulations OR assessment OR invitation)"
    if (since) q += ` after:${Math.floor(since.getTime() / 1000)}`

    const listRes = await gmail.users.messages.list({ userId: "me", q, maxResults: 100 })
    const messages = listRes.data.messages ?? []
    const results: EmailRaw[] = []

    for (const msg of messages) {
      const detail = await gmail.users.messages.get({ userId: "me", id: msg.id!, format: "full" })
      const headers = detail.data.payload?.headers ?? []
      const subject = headers.find((h) => h.name === "Subject")?.value ?? ""
      const dateStr = headers.find((h) => h.name === "Date")?.value ?? ""
      results.push({
        messageId: msg.id!,
        subject,
        bodyText: extractBodyText(detail.data.payload),
        date: dateStr ? new Date(dateStr) : new Date(),
      })
    }

    return results
  }
  ```

- [ ] Run — expect PASS: `npm test -- __tests__/services/gmail.test.ts`

- [ ] Commit:
  ```bash
  git add server/services/gmail.service.ts __tests__/services/gmail.test.ts
  git commit -m "feat(sync): add Gmail service with token refresh and email fetching"
  ```

---

### Task 2.4 — Classification service

- [ ] Write failing test — create `__tests__/services/classification.test.ts`:
  ```typescript
  import { describe, it, expect } from "vitest"
  import {
    preprocessEmail,
    classifyWithRegex,
    type EmailRaw,
  } from "@/server/services/classification.service"

  const email = (subject: string, bodyText = ""): EmailRaw => ({
    messageId: "m1", subject, bodyText, date: new Date(),
  })

  describe("preprocessEmail", () => {
    it("strips HTML tags", () => {
      expect(preprocessEmail("Sub", "<p>body</p>")).not.toContain("<p>")
    })
    it("replaces email addresses", () => {
      expect(preprocessEmail("Sub", "email hr@acme.com here")).toContain("[email]")
    })
    it("replaces phone numbers", () => {
      expect(preprocessEmail("Sub", "call 555-123-4567")).toContain("[phone]")
    })
    it("replaces URLs", () => {
      expect(preprocessEmail("Sub", "see https://jobs.io")).toContain("[url]")
    })
    it("truncates to 500 chars", () => {
      expect(preprocessEmail("Sub", "a".repeat(1000)).length).toBeLessThanOrEqual(500)
    })
  })

  describe("classifyWithRegex", () => {
    it("classifies APPLIED", () => {
      expect(classifyWithRegex(email("Application received: SWE at Acme")).status).toBe("APPLIED")
    })
    it("classifies INTERVIEW", () => {
      expect(classifyWithRegex(email("Interview invitation - Software Engineer")).status).toBe("INTERVIEW")
    })
    it("classifies OFFER", () => {
      expect(classifyWithRegex(email("Congratulations! Offer letter enclosed")).status).toBe("OFFER")
    })
    it("classifies REJECTED", () => {
      expect(classifyWithRegex(email("We will not be proceeding with your application")).status).toBe("REJECTED")
    })
    it("returns null for unrecognized email", () => {
      expect(classifyWithRegex(email("Quick question about your schedule")).status).toBeNull()
    })
    it("extracts company from 'at Company' pattern", () => {
      expect(classifyWithRegex(email("Application received for Engineer at Acme Corp")).company).toBe("Acme Corp")
    })
  })
  ```

- [ ] Run — expect FAIL: `npm test -- __tests__/services/classification.test.ts`

- [ ] Create `server/services/classification.service.ts`:
  ```typescript
  import Anthropic from "@anthropic-ai/sdk"
  import { applicationStatus } from "@/app/generated/prisma/enums"
  import type { EmailRaw } from "@/server/services/gmail.service"

  export type { EmailRaw }

  export interface ClassifiedEmail {
    messageId: string
    company: string | null
    roleTitle: string | null
    status: applicationStatus
    date: Date
  }

  // Stage 1 regex patterns — handles ~80% of emails for free
  const PATTERNS: Partial<Record<applicationStatus, RegExp>> = {
    [applicationStatus.OFFER]:
      /offer letter|congratulations|pleased to inform|we('d| would) like to offer|accepted your application/i,
    [applicationStatus.INTERVIEW]:
      /interview|technical screen|assessment|coding challenge|phone screen|schedule.*call|invitation to interview/i,
    [applicationStatus.APPLIED]:
      /application received|thank you for applying|we('ve| have) received your application|application confirmation|successfully submitted/i,
    [applicationStatus.REJECTED]:
      /not moving forward|unfortunately|other candidates|will not be proceeding|not selected|not a match/i,
  }

  /**
   * Cleans email text before classification.
   * Strips HTML, removes PII (emails, phones, URLs), truncates to 500 chars.
   * Text is used transiently — never stored in DB.
   */
  export function preprocessEmail(subject: string, bodyText: string): string {
    let text = `${subject} ${bodyText}`
    text = text.replace(/<[^>]+>/g, " ")
    text = text.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    text = text.replace(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[phone]")
    text = text.replace(/https?:\/\/[^\s]+/g, "[url]")
    return text.replace(/\s+/g, " ").trim().slice(0, 500)
  }

  function extractCompanyAndRole(subject: string) {
    // "Application received for Software Engineer at Acme Corp"
    const atMatch = subject.match(
      /(?:application|applying|applied).*?(?:for\s+)?(.+?)\s+at\s+([A-Za-z][A-Za-z0-9\s&.,]+?)(?:\s*[-–(]|$)/i,
    )
    if (atMatch) return { roleTitle: atMatch[1].trim(), company: atMatch[2].trim() }

    // "Acme Corp - Application Received"
    const dashMatch = subject.match(/^([A-Za-z][^-–]+?)\s*[-–]\s*(?:application|your application)/i)
    if (dashMatch) return { company: dashMatch[1].trim(), roleTitle: null }

    return { company: null, roleTitle: null }
  }

  /** Stage 1: fast regex classification. Returns null status if no match. */
  export function classifyWithRegex(email: EmailRaw) {
    const cleanedText = preprocessEmail(email.subject, email.bodyText)
    for (const [status, pattern] of Object.entries(PATTERNS)) {
      if (pattern.test(cleanedText)) {
        return { status: status as applicationStatus, ...extractCompanyAndRole(email.subject) }
      }
    }
    return { status: null, company: null, roleTitle: null }
  }

  /**
   * Stage 2: Claude Haiku fallback for emails regex couldn't classify.
   * Sends anonymized/preprocessed text only — never raw email content.
   * Batches in groups of 20 to control API cost.
   */
  export async function classifyWithAI(
    emails: Array<{ messageId: string; cleanedText: string; date: Date }>,
  ): Promise<ClassifiedEmail[]> {
    const client = new Anthropic()
    const results: ClassifiedEmail[] = []

    for (let i = 0; i < emails.length; i += 20) {
      const batch = emails.slice(i, i + 20)
      const prompt = `Classify these job application emails. Return ONLY a JSON array, no markdown.

Emails:
${batch.map((e, idx) => `${idx + 1}. ID:${e.messageId}\n${e.cleanedText}`).join("\n\n---\n\n")}

Return: [{"messageId":"...","company":"..." or null,"roleTitle":"..." or null,"status":"APPLIED|INTERVIEW|OFFER|REJECTED|GHOSTED"}]`

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      })

      const text = response.content[0].type === "text" ? response.content[0].text : ""

      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error("No JSON array in response")
        const parsed: Array<{ messageId: string; company: string | null; roleTitle: string | null; status: string }> =
          JSON.parse(jsonMatch[0])
        for (const item of parsed) {
          const original = batch.find((e) => e.messageId === item.messageId)
          results.push({
            messageId: item.messageId,
            company: item.company ?? null,
            roleTitle: item.roleTitle ?? null,
            status: (item.status as applicationStatus) ?? applicationStatus.APPLIED,
            date: original?.date ?? new Date(),
          })
        }
      } catch {
        // Fallback: mark entire batch as APPLIED rather than losing records
        for (const e of batch) {
          results.push({ messageId: e.messageId, company: null, roleTitle: null, status: applicationStatus.APPLIED, date: e.date })
        }
      }
    }

    return results
  }

  /**
   * Main entry: regex first (free), AI only for unclassified emails.
   */
  export async function classifyBatch(emails: EmailRaw[]): Promise<ClassifiedEmail[]> {
    const classified: ClassifiedEmail[] = []
    const needsAI: Array<{ messageId: string; cleanedText: string; date: Date }> = []

    for (const email of emails) {
      const { status, company, roleTitle } = classifyWithRegex(email)
      if (status !== null) {
        classified.push({ messageId: email.messageId, company, roleTitle, status, date: email.date })
      } else {
        needsAI.push({
          messageId: email.messageId,
          cleanedText: preprocessEmail(email.subject, email.bodyText),
          date: email.date,
        })
      }
    }

    if (needsAI.length > 0) classified.push(...(await classifyWithAI(needsAI)))
    return classified
  }
  ```

- [ ] Run — expect PASS: `npm test -- __tests__/services/classification.test.ts`

- [ ] Commit:
  ```bash
  git add server/services/classification.service.ts __tests__/services/classification.test.ts
  git commit -m "feat(sync): add classification service with regex + Claude Haiku fallback"
  ```

---

### Task 2.5 — Sync service + API route

- [ ] Write failing test — create `__tests__/services/sync.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from "vitest"

  vi.mock("@/server/lib/prisma", () => ({
    prisma: {
      syncState: { findUnique: vi.fn(), upsert: vi.fn() },
      application: { upsert: vi.fn() },
    },
  }))
  vi.mock("@/server/services/gmail.service", () => ({ fetchEmailsSince: vi.fn() }))
  vi.mock("@/server/services/classification.service", () => ({ classifyBatch: vi.fn() }))

  import { prisma } from "@/server/lib/prisma"
  import { fetchEmailsSince } from "@/server/services/gmail.service"
  import { classifyBatch } from "@/server/services/classification.service"

  describe("syncApplications", () => {
    beforeEach(() => vi.clearAllMocks())

    it("skips sync within 15-min cooldown", async () => {
      vi.mocked(prisma.syncState.findUnique).mockResolvedValue({
        lastSyncedAt: new Date(Date.now() - 5 * 60 * 1000),
      } as any)
      const { syncApplications } = await import("@/server/services/sync.service")
      const result = await syncApplications("user-1")
      expect(result.skipped).toBe(true)
      expect(result.cooldownMs).toBeGreaterThan(0)
      expect(fetchEmailsSince).not.toHaveBeenCalled()
    })

    it("runs full sync when cooldown passed", async () => {
      vi.mocked(prisma.syncState.findUnique).mockResolvedValue({
        lastSyncedAt: new Date(Date.now() - 20 * 60 * 1000),
      } as any)
      vi.mocked(fetchEmailsSince).mockResolvedValue([
        { messageId: "msg-1", subject: "App received", bodyText: "", date: new Date() },
      ])
      vi.mocked(classifyBatch).mockResolvedValue([
        { messageId: "msg-1", company: "Acme", roleTitle: "SWE", status: "APPLIED" as any, date: new Date() },
      ])
      vi.mocked(prisma.application.upsert).mockResolvedValue({} as any)
      vi.mocked(prisma.syncState.upsert).mockResolvedValue({} as any)

      const { syncApplications } = await import("@/server/services/sync.service")
      const result = await syncApplications("user-1")

      expect(result.skipped).toBe(false)
      expect(result.synced).toBe(1)
      expect(prisma.application.upsert).toHaveBeenCalledTimes(1)
    })

    it("records FAIL status and rethrows on Gmail error", async () => {
      vi.mocked(prisma.syncState.findUnique).mockResolvedValue(null)
      vi.mocked(fetchEmailsSince).mockRejectedValue(new Error("Gmail API error"))
      vi.mocked(prisma.syncState.upsert).mockResolvedValue({} as any)

      const { syncApplications } = await import("@/server/services/sync.service")
      await expect(syncApplications("user-1")).rejects.toThrow("Gmail API error")
      expect(prisma.syncState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ lastSyncStatus: "FAIL" }),
        }),
      )
    })
  })
  ```

- [ ] Run — expect FAIL: `npm test -- __tests__/services/sync.test.ts`

- [ ] Create `server/services/sync.service.ts`:
  ```typescript
  import { prisma } from "@/server/lib/prisma"
  import { fetchEmailsSince } from "@/server/services/gmail.service"
  import { classifyBatch } from "@/server/services/classification.service"
  import { applicationSource, lastSyncStatus } from "@/app/generated/prisma/enums"

  const COOLDOWN_MS = 15 * 60 * 1000

  export interface SyncResult {
    synced: number
    skipped: boolean
    cooldownMs: number
    lastSyncedAt: Date | null
  }

  /**
   * Full sync pipeline for a user:
   * 1. Check 15-min cooldown
   * 2. Fetch new emails from Gmail
   * 3. Classify (regex → Claude Haiku fallback)
   * 4. Upsert Application records (deduped by gmailMessageId)
   * 5. Update SyncState
   */
  export async function syncApplications(userId: string): Promise<SyncResult> {
    const syncState = await prisma.syncState.findUnique({ where: { userId } })

    if (syncState?.lastSyncedAt) {
      const elapsed = Date.now() - syncState.lastSyncedAt.getTime()
      if (elapsed < COOLDOWN_MS) {
        return { synced: 0, skipped: true, cooldownMs: COOLDOWN_MS - elapsed, lastSyncedAt: syncState.lastSyncedAt }
      }
    }

    try {
      const emails = await fetchEmailsSince(userId, syncState?.lastSyncedAt ?? undefined)
      const classified = await classifyBatch(emails)

      for (const item of classified) {
        await prisma.application.upsert({
          where: { gmailMessageId: item.messageId },
          update: { status: item.status },
          create: {
            userId,
            company: item.company ?? "Unknown",
            roleTitle: item.roleTitle ?? "Unknown",
            status: item.status,
            source: applicationSource.GMAIL,
            appliedAt: item.date,
            gmailMessageId: item.messageId,
          },
        })
      }

      const now = new Date()
      await prisma.syncState.upsert({
        where: { userId },
        update: { lastSyncedAt: now, lastSyncStatus: lastSyncStatus.SUCCESS, lastSyncError: null },
        create: { userId, lastSyncedAt: now, lastSyncStatus: lastSyncStatus.SUCCESS },
      })

      return { synced: classified.length, skipped: false, cooldownMs: 0, lastSyncedAt: now }
    } catch (error) {
      await prisma.syncState.upsert({
        where: { userId },
        update: {
          lastSyncStatus: lastSyncStatus.FAIL,
          lastSyncError: error instanceof Error ? error.message : "Unknown error",
        },
        create: {
          userId,
          lastSyncStatus: lastSyncStatus.FAIL,
          lastSyncError: error instanceof Error ? error.message : "Unknown error",
        },
      })
      throw error
    }
  }
  ```

- [ ] Create `app/api/sync/route.ts`:
  ```typescript
  import { auth } from "@/auth"
  import { syncApplications } from "@/server/services/sync.service"
  import { NextResponse } from "next/server"

  export async function POST() {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    try {
      const result = await syncApplications(session.user.id)
      return NextResponse.json(result, { status: 200 })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Sync failed" },
        { status: 500 },
      )
    }
  }
  ```

- [ ] Run — expect PASS: `npm test -- __tests__/services/sync.test.ts`

- [ ] Commit:
  ```bash
  git add server/services/sync.service.ts app/api/sync/ __tests__/services/sync.test.ts
  git commit -m "feat(sync): add sync service with cooldown and POST /api/sync"
  ```

### Phase 2 verification

1. Sign in, then: `curl -X POST http://localhost:3000/api/sync -H "Cookie: <session-cookie>"`
2. Expected: `{"synced": N, "skipped": false, "cooldownMs": 0, ...}`
3. Check Supabase `Application` table — rows with `source: GMAIL`
4. Check `SyncState` table — `lastSyncStatus: SUCCESS`
5. POST again immediately → `{"skipped": true, "cooldownMs": ...}`
6. Without cookie → 401

---

## Phase 3 — Dashboard UI

**Goal:** Dashboard page with stats bar, sortable/filterable table, sync button that auto-fires on mount.

**Prerequisite:** Phases 1 + 2 complete. No new env vars. No new packages.

**Files:**
- Create: `components/StatsBar.tsx`
- Create: `components/ApplicationTable.tsx`
- Create: `components/SyncButton.tsx`
- Modify: `app/dashboard/page.tsx` (replace placeholder)
- Create: `__tests__/components/StatsBar.test.tsx`
- Create: `__tests__/components/ApplicationTable.test.tsx`
- Create: `__tests__/components/SyncButton.test.tsx`

---

### Task 3.1 — StatsBar

- [ ] Write failing test — create `__tests__/components/StatsBar.test.tsx`:
  ```tsx
  import { render, screen } from "@testing-library/react"
  import { describe, it, expect } from "vitest"
  import StatsBar from "@/components/StatsBar"
  import { applicationStatus } from "@/app/generated/prisma/enums"

  const app = (status: applicationStatus) => ({
    id: Math.random().toString(), status, company: "Acme", roleTitle: "SWE",
    source: "GMAIL" as any, userId: "u1", createdAt: new Date(), updatedAt: new Date(),
    appliedAt: null, jobUrl: null, location: null, notes: null, gmailMessageId: null,
  })

  describe("StatsBar", () => {
    it("shows total count", () => {
      render(<StatsBar applications={[app(applicationStatus.APPLIED), app(applicationStatus.INTERVIEW)]} />)
      expect(screen.getByText("2")).toBeInTheDocument()
    })

    it("shows per-status count via data-testid", () => {
      render(<StatsBar applications={[app(applicationStatus.APPLIED), app(applicationStatus.APPLIED), app(applicationStatus.OFFER)]} />)
      expect(screen.getByTestId("stat-APPLIED")).toHaveTextContent("2")
      expect(screen.getByTestId("stat-OFFER")).toHaveTextContent("1")
    })

    it("renders with empty array without crashing", () => {
      render(<StatsBar applications={[]} />)
      expect(screen.getAllByText("0").length).toBeGreaterThan(0)
    })
  })
  ```

- [ ] Run — expect FAIL

- [ ] Create `components/StatsBar.tsx`:
  ```tsx
  "use client"
  import { applicationStatus } from "@/app/generated/prisma/enums"

  interface Application { status: applicationStatus }
  interface Props { applications: Application[] }

  const STATUS_CONFIG: Record<applicationStatus, { label: string; color: string }> = {
    [applicationStatus.APPLIED]:   { label: "Applied",   color: "bg-blue-100 text-blue-800" },
    [applicationStatus.INTERVIEW]: { label: "Interview", color: "bg-yellow-100 text-yellow-800" },
    [applicationStatus.OFFER]:     { label: "Offer",     color: "bg-green-100 text-green-800" },
    [applicationStatus.REJECTED]:  { label: "Rejected",  color: "bg-red-100 text-red-800" },
    [applicationStatus.GHOSTED]:   { label: "Ghosted",   color: "bg-gray-100 text-gray-600" },
  }

  export default function StatsBar({ applications }: Props) {
    const counts = Object.values(applicationStatus).reduce(
      (acc, s) => { acc[s] = applications.filter((a) => a.status === s).length; return acc },
      {} as Record<applicationStatus, number>,
    )

    return (
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1 text-sm font-medium text-white">
          <span>{applications.length}</span>
          <span className="text-gray-300">Total</span>
        </div>
        {Object.values(applicationStatus).map((s) => (
          <div
            key={s}
            data-testid={`stat-${s}`}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${STATUS_CONFIG[s].color}`}
          >
            <span>{counts[s]}</span>
            <span>{STATUS_CONFIG[s].label}</span>
          </div>
        ))}
      </div>
    )
  }
  ```

- [ ] Run — expect PASS: `npm test -- __tests__/components/StatsBar.test.tsx`

- [ ] Commit: `git add components/StatsBar.tsx __tests__/components/ && git commit -m "feat(ui): add StatsBar component"`

---

### Task 3.2 — ApplicationTable (display only)

- [ ] Write failing test — create `__tests__/components/ApplicationTable.test.tsx`:
  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react"
  import { describe, it, expect } from "vitest"
  import ApplicationTable from "@/components/ApplicationTable"
  import { applicationStatus, applicationSource } from "@/app/generated/prisma/enums"

  const app = (overrides = {}) => ({
    id: "a1", userId: "u1", company: "Acme Corp", roleTitle: "Software Engineer",
    status: applicationStatus.APPLIED, source: applicationSource.GMAIL,
    appliedAt: new Date("2024-01-15"), jobUrl: null, location: "Remote",
    notes: null, gmailMessageId: "m1", createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  })

  describe("ApplicationTable", () => {
    it("renders application rows", () => {
      render(<ApplicationTable applications={[app()]} onStatusChange={async () => {}} onNotesSave={async () => {}} />)
      expect(screen.getByText("Acme Corp")).toBeInTheDocument()
    })

    it("shows empty state", () => {
      render(<ApplicationTable applications={[]} onStatusChange={async () => {}} onNotesSave={async () => {}} />)
      expect(screen.getByText(/no applications yet/i)).toBeInTheDocument()
    })

    it("filters by status", () => {
      const apps = [
        app({ id: "1", company: "Acme", status: applicationStatus.APPLIED }),
        app({ id: "2", company: "Beta Corp", status: applicationStatus.INTERVIEW }),
      ]
      render(<ApplicationTable applications={apps} onStatusChange={async () => {}} onNotesSave={async () => {}} />)
      fireEvent.change(screen.getByRole("combobox", { name: /filter/i }), {
        target: { value: applicationStatus.INTERVIEW },
      })
      expect(screen.getByText("Beta Corp")).toBeInTheDocument()
      expect(screen.queryByText("Acme")).not.toBeInTheDocument()
    })
  })
  ```

- [ ] Run — expect FAIL

- [ ] Create `components/ApplicationTable.tsx`:
  ```tsx
  "use client"
  import { useState, useCallback } from "react"
  import { applicationStatus, applicationSource } from "@/app/generated/prisma/enums"

  export interface Application {
    id: string
    company: string
    roleTitle: string
    status: applicationStatus
    source: applicationSource
    appliedAt: Date | null
    location: string | null
    notes: string | null
    gmailMessageId: string | null
  }

  interface Props {
    applications: Application[]
    onStatusChange: (id: string, prev: applicationStatus, next: applicationStatus) => Promise<void>
    onNotesSave: (id: string, notes: string) => Promise<void>
  }

  const STATUS_COLORS: Record<applicationStatus, string> = {
    [applicationStatus.APPLIED]:   "bg-blue-100 text-blue-800",
    [applicationStatus.INTERVIEW]: "bg-yellow-100 text-yellow-800",
    [applicationStatus.OFFER]:     "bg-green-100 text-green-800",
    [applicationStatus.REJECTED]:  "bg-red-100 text-red-800",
    [applicationStatus.GHOSTED]:   "bg-gray-100 text-gray-600",
  }

  type SortKey = "company" | "roleTitle" | "status" | "appliedAt"

  export default function ApplicationTable({ applications, onStatusChange, onNotesSave }: Props) {
    const [filterStatus, setFilterStatus] = useState<applicationStatus | "ALL">("ALL")
    const [sortKey, setSortKey] = useState<SortKey>("appliedAt")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
    const [statusOverrides, setStatusOverrides] = useState<Record<string, applicationStatus>>({})
    const [notesOverrides, setNotesOverrides] = useState<Record<string, string>>({})
    const [expandedNotes, setExpandedNotes] = useState<string | null>(null)

    const handleSort = (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
      else { setSortKey(key); setSortDir("asc") }
    }

    const handleStatusChange = useCallback(
      async (id: string, prev: applicationStatus, next: applicationStatus) => {
        setStatusOverrides((s) => ({ ...s, [id]: next }))
        try { await onStatusChange(id, prev, next) }
        catch { setStatusOverrides((s) => ({ ...s, [id]: prev })) }
      },
      [onStatusChange],
    )

    const handleNotesSave = useCallback(
      async (id: string, notes: string) => {
        const original = notesOverrides[id]
        setNotesOverrides((s) => ({ ...s, [id]: notes }))
        try { await onNotesSave(id, notes) }
        catch { setNotesOverrides((s) => original !== undefined ? { ...s, [id]: original } : (() => { const n = { ...s }; delete n[id]; return n })()) }
      },
      [onNotesSave, notesOverrides],
    )

    const filtered = applications.filter(
      (a) => filterStatus === "ALL" || (statusOverrides[a.id] ?? a.status) === filterStatus,
    )
    const sorted = [...filtered].sort((a, b) => {
      const va = sortKey === "appliedAt" ? (a.appliedAt?.getTime() ?? 0) : (statusOverrides[a.id] ?? a[sortKey] ?? "") as string | number
      const vb = sortKey === "appliedAt" ? (b.appliedAt?.getTime() ?? 0) : (statusOverrides[b.id] ?? b[sortKey] ?? "") as string | number
      if (va < vb) return sortDir === "asc" ? -1 : 1
      if (va > vb) return sortDir === "asc" ? 1 : -1
      return 0
    })

    const Chevron = ({ k }: { k: SortKey }) => <span>{sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}</span>

    return (
      <div>
        <div className="mb-4">
          <select
            aria-label="Filter by status"
            className="rounded-lg border px-3 py-1.5 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as applicationStatus | "ALL")}
          >
            <option value="ALL">All statuses</option>
            {Object.values(applicationStatus).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {sorted.length === 0 ? (
          <p className="text-center text-gray-400 py-16 text-sm">
            No applications yet. Click Sync Now to import from Gmail.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  {(["company", "roleTitle", "status", "appliedAt"] as SortKey[]).map((k) => (
                    <th key={k} className="px-4 py-3 cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort(k)}>
                      {k === "roleTitle" ? "Role" : k === "appliedAt" ? "Date" : k.charAt(0).toUpperCase() + k.slice(1)}
                      <Chevron k={k} />
                    </th>
                  ))}
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.flatMap((app) => {
                  const currentStatus = statusOverrides[app.id] ?? app.status
                  const currentNotes = notesOverrides[app.id] !== undefined ? notesOverrides[app.id] : (app.notes ?? "")
                  const isExpanded = expandedNotes === app.id

                  return [
                    <tr key={app.id} className="bg-white hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{app.company}</td>
                      <td className="px-4 py-3 text-gray-700">{app.roleTitle}</td>
                      <td className="px-4 py-3">
                        <select
                          aria-label="status"
                          value={currentStatus}
                          onChange={(e) => handleStatusChange(app.id, currentStatus, e.target.value as applicationStatus)}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium border-0 cursor-pointer ${STATUS_COLORS[currentStatus]}`}
                        >
                          {Object.values(applicationStatus).map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="text-gray-400 hover:text-gray-600 text-xs"
                          onClick={() => setExpandedNotes(isExpanded ? null : app.id)}
                        >
                          {currentNotes ? currentNotes.slice(0, 30) + (currentNotes.length > 30 ? "…" : "") : "Add note"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{app.location ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${app.source === applicationSource.GMAIL ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                          {app.source}
                        </span>
                      </td>
                    </tr>,
                    isExpanded && (
                      <tr key={`${app.id}-notes`} className="bg-gray-50">
                        <td colSpan={7} className="px-4 pb-3">
                          <textarea
                            autoFocus
                            defaultValue={currentNotes}
                            rows={3}
                            placeholder="Add notes…"
                            className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onBlur={(e) => {
                              if (e.target.value !== currentNotes) handleNotesSave(app.id, e.target.value)
                              setExpandedNotes(null)
                            }}
                          />
                        </td>
                      </tr>
                    ),
                  ].filter(Boolean)
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] Run — expect PASS: `npm test -- __tests__/components/ApplicationTable.test.tsx`

- [ ] Commit:
  ```bash
  git add components/ApplicationTable.tsx __tests__/components/ApplicationTable.test.tsx
  git commit -m "feat(ui): add ApplicationTable with sort, filter, inline status edit and notes"
  ```

---

### Task 3.3 — SyncButton

- [ ] Write failing test — create `__tests__/components/SyncButton.test.tsx`:
  ```tsx
  import { render, screen, waitFor } from "@testing-library/react"
  import { describe, it, expect, vi, beforeEach } from "vitest"
  import SyncButton from "@/components/SyncButton"

  vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

  const mockFetch = vi.fn()
  global.fetch = mockFetch

  describe("SyncButton", () => {
    beforeEach(() => vi.clearAllMocks())

    it("auto-syncs on mount when cooldownMs is 0", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ synced: 3, skipped: false, cooldownMs: 0 }) })
      render(<SyncButton lastSyncedAt={null} cooldownMs={0} />)
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/sync", expect.objectContaining({ method: "POST" }))
      })
    })

    it("does NOT auto-sync when within cooldown", () => {
      render(<SyncButton lastSyncedAt={new Date()} cooldownMs={500_000} />)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("disables button during cooldown", () => {
      render(<SyncButton lastSyncedAt={new Date()} cooldownMs={500_000} />)
      expect(screen.getByRole("button")).toBeDisabled()
    })
  })
  ```

- [ ] Run — expect FAIL

- [ ] Create `components/SyncButton.tsx`:
  ```tsx
  "use client"
  import { useEffect, useState, useRef } from "react"
  import { useRouter } from "next/navigation"

  interface Props {
    lastSyncedAt: Date | null
    cooldownMs: number
  }

  function relativeTime(date: Date): string {
    const m = Math.floor((Date.now() - date.getTime()) / 60_000)
    return m < 1 ? "just now" : m === 1 ? "1 min ago" : `${m} min ago`
  }

  function countdown(ms: number): string {
    const s = Math.ceil(ms / 1000)
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
  }

  export default function SyncButton({ lastSyncedAt, cooldownMs: initialCooldown }: Props) {
    const router = useRouter()
    const [syncing, setSyncing] = useState(false)
    const [cooldownMs, setCooldownMs] = useState(initialCooldown)
    const [lastSynced, setLastSynced] = useState<Date | null>(lastSyncedAt)
    const [message, setMessage] = useState<string | null>(null)
    const mounted = useRef(false)

    useEffect(() => {
      if (cooldownMs <= 0) return
      const t = setInterval(() => setCooldownMs((ms) => (ms <= 1000 ? (clearInterval(t), 0) : ms - 1000)), 1000)
      return () => clearInterval(t)
    }, [cooldownMs])

    const doSync = async () => {
      setSyncing(true)
      setMessage(null)
      try {
        const res = await fetch("/api/sync", { method: "POST" })
        const data = await res.json()
        if (data.skipped) {
          setCooldownMs(data.cooldownMs)
        } else {
          setLastSynced(new Date())
          setCooldownMs(0)
          setMessage(`Synced ${data.synced} new application${data.synced !== 1 ? "s" : ""}`)
          router.refresh()
        }
      } catch {
        setMessage("Sync failed — check connection")
      } finally {
        setSyncing(false)
      }
    }

    // Auto-sync once on mount if not in cooldown
    useEffect(() => {
      if (!mounted.current && cooldownMs === 0) {
        mounted.current = true
        doSync()
      }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={doSync}
          disabled={syncing || cooldownMs > 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {syncing ? "Syncing…" : cooldownMs > 0 ? `Available in ${countdown(cooldownMs)}` : "Sync Now"}
        </button>
        <span className="text-sm text-gray-500">
          {lastSynced ? `Last synced ${relativeTime(lastSynced)}` : "Never synced"}
          {message && <span className="ml-2 text-green-600">{message}</span>}
        </span>
      </div>
    )
  }
  ```

- [ ] Run — expect PASS: `npm test -- __tests__/components/SyncButton.test.tsx`

- [ ] Commit:
  ```bash
  git add components/SyncButton.tsx __tests__/components/SyncButton.test.tsx
  git commit -m "feat(ui): add SyncButton with auto-sync on mount and cooldown countdown"
  ```

---

### Task 3.4 — Wire up dashboard page

- [ ] Replace `app/dashboard/page.tsx`:
  ```tsx
  import { auth, signOut } from "@/auth"
  import { redirect } from "next/navigation"
  import { listApplications } from "@/server/services/application.service"
  import { prisma } from "@/server/lib/prisma"
  import StatsBar from "@/components/StatsBar"
  import ApplicationTable from "@/components/ApplicationTable"
  import SyncButton from "@/components/SyncButton"

  const COOLDOWN_MS = 15 * 60 * 1000

  export default async function DashboardPage() {
    const session = await auth()
    if (!session) redirect("/login")

    const userId = session.user.id
    const [applications, syncState] = await Promise.all([
      listApplications(userId),
      prisma.syncState.findUnique({ where: { userId } }),
    ])

    const cooldownMs = syncState?.lastSyncedAt
      ? Math.max(0, COOLDOWN_MS - (Date.now() - syncState.lastSyncedAt.getTime()))
      : 0

    async function handleStatusChange(id: string, _prev: string, next: string) {
      "use server"
      // Handled client-side via fetch — this is a placeholder for server action if needed
    }

    return (
      <main className="min-h-screen bg-gray-50">
        <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Application Tracker</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{session.user.name}</span>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }) }}>
              <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
            </form>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <StatsBar applications={applications} />
          <SyncButton lastSyncedAt={syncState?.lastSyncedAt ?? null} cooldownMs={cooldownMs} />
          <ApplicationTable
            applications={applications}
            onStatusChange={async (id, prev, next) => {
              await fetch(`/api/applications/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: next }),
              }).then((r) => { if (!r.ok) throw new Error("Failed") })
            }}
            onNotesSave={async (id, notes) => {
              await fetch(`/api/applications/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes }),
              }).then((r) => { if (!r.ok) throw new Error("Failed") })
            }}
          />
        </div>
      </main>
    )
  }
  ```

  > **Note:** `onStatusChange` and `onNotesSave` are inline arrow functions passed as props. They're defined in a server component but called client-side — this works because they're passed as serializable props. The `fetch` calls go to the existing PATCH API route which is already auth-protected.

- [ ] Commit:
  ```bash
  git add app/dashboard/page.tsx
  git commit -m "feat(ui): wire up dashboard with StatsBar, SyncButton, ApplicationTable"
  ```

### Phase 3 verification

1. `npm run dev`, sign in
2. Dashboard loads → SyncButton auto-fires → "Syncing…" → "Synced N new applications"
3. Table populates; stats bar shows correct counts
4. Filter by status → rows update (no page reload)
5. Click column header → sorts; click again → reverses
6. "Sync Now" within 15 min → button shows countdown
7. Run full test suite: `npm run test:run` — all pass

---

## Phase 4 — Inline Edit (Notes)

**Goal:** Notes editing is already built into `ApplicationTable` (expand on click, blur to save). This phase verifies the integration end-to-end and adds a test for the optimistic rollback path.

**Prerequisite:** Phase 3 complete.

**Files:**
- Create: `__tests__/components/ApplicationTable.edit.test.tsx`

---

### Task 4.1 — Test inline edit + rollback

- [ ] Write test — create `__tests__/components/ApplicationTable.edit.test.tsx`:
  ```tsx
  import { render, screen, fireEvent, waitFor } from "@testing-library/react"
  import { describe, it, expect, vi, beforeEach } from "vitest"
  import ApplicationTable from "@/components/ApplicationTable"
  import { applicationStatus, applicationSource } from "@/app/generated/prisma/enums"

  const app = (overrides = {}) => ({
    id: "app-1", userId: "u1", company: "Acme Corp", roleTitle: "SWE",
    status: applicationStatus.APPLIED, source: applicationSource.GMAIL,
    appliedAt: new Date("2024-01-15"), jobUrl: null, location: null,
    notes: null, gmailMessageId: "m1", createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  })

  describe("ApplicationTable inline status edit", () => {
    beforeEach(() => vi.clearAllMocks())

    it("calls onStatusChange when status select changes", async () => {
      const onStatusChange = vi.fn().mockResolvedValue(undefined)
      render(
        <ApplicationTable applications={[app()]} onStatusChange={onStatusChange} onNotesSave={async () => {}} />
      )
      const selects = screen.getAllByRole("combobox")
      const statusSelect = selects.find((s) => s.getAttribute("aria-label") === "status")!
      fireEvent.change(statusSelect, { target: { value: applicationStatus.INTERVIEW } })
      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith("app-1", applicationStatus.APPLIED, applicationStatus.INTERVIEW)
      })
    })

    it("reverts status optimistically on onStatusChange rejection", async () => {
      const onStatusChange = vi.fn().mockRejectedValue(new Error("API error"))
      render(
        <ApplicationTable applications={[app()]} onStatusChange={onStatusChange} onNotesSave={async () => {}} />
      )
      const selects = screen.getAllByRole("combobox")
      const statusSelect = selects.find((s) => s.getAttribute("aria-label") === "status")!
      fireEvent.change(statusSelect, { target: { value: applicationStatus.INTERVIEW } })
      await waitFor(() => {
        expect(statusSelect).toHaveValue(applicationStatus.APPLIED)
      })
    })
  })
  ```

- [ ] Run — expect PASS: `npm test -- __tests__/components/ApplicationTable.edit.test.tsx`

- [ ] Run full suite: `npm run test:run` — all green

- [ ] Commit:
  ```bash
  git add __tests__/components/ApplicationTable.edit.test.tsx
  git commit -m "test(ui): add inline edit and optimistic rollback tests"
  ```

### Phase 4 verification

1. Table row → click status select → pick INTERVIEW → badge updates immediately
2. Refresh page → status persisted in DB
3. Table row → click "Add note" → textarea expands → type → click away → note saved
4. Refresh → note persists
5. DevTools → Network → block `/api/applications/*` → change status → status reverts after fail

---

## Full Test Suite

```bash
npm run test:run
```

Expected:
```
✓ __tests__/auth/auth-callbacks.test.ts        (2 tests)
✓ __tests__/api/applications.test.ts           (3 tests)
✓ __tests__/services/gmail.test.ts             (4 tests)
✓ __tests__/services/classification.test.ts    (11 tests)
✓ __tests__/services/sync.test.ts              (3 tests)
✓ __tests__/components/StatsBar.test.tsx       (3 tests)
✓ __tests__/components/ApplicationTable.test.tsx (3 tests)
✓ __tests__/components/SyncButton.test.tsx     (3 tests)
✓ __tests__/components/ApplicationTable.edit.test.tsx (2 tests)
```

---

## Env Var Reference

| Variable | Phase | Where to get it |
|----------|-------|-----------------|
| `DATABASE_URL` | All | Supabase → Settings → Database → Pooler connection string (port 6543) |
| `DIRECT_URL` | Phase 2 migrations only | Supabase → Settings → Database → Direct connection string (port 5432, host: `db.[ref].supabase.co`) |
| `AUTH_GOOGLE_ID` | 1+ | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID |
| `AUTH_GOOGLE_SECRET` | 1+ | Same as above |
| `AUTH_SECRET` | 1+ | `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | 2+ | console.anthropic.com |

## Deployment (Vercel)

Each phase is independently deployable. After each phase:

```bash
vercel --prod
```

Or push to `master` if GitHub → Vercel auto-deploy is configured.

**Vercel env vars to set** (Settings → Environment Variables): all vars above except `DIRECT_URL` (only needed for local migrations).

**After Phase 1 deploy:** Add `https://your-app.vercel.app/api/auth/callback/google` to Google Cloud Console → OAuth 2.0 client → Authorized redirect URIs.
