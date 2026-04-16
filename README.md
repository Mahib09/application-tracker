# Application Tracker

AI-powered job application tracker that reads your Gmail and classifies applications automatically.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)
![License](https://img.shields.io/badge/License-MIT-green)

<!-- Replace with an actual screenshot: drop an image in docs/images/ and update the path -->
![Dashboard](docs/images/dashboard.png)

## Features

- **One-click Gmail sync** — fetches application emails via Gmail API (`gmail.readonly`)
- **AI-powered classification** — three-stage pipeline: deterministic filter → Haiku triage → Sonnet extraction
- **Confidence routing** — high-confidence results auto-commit; low-confidence flagged for review
- **Kanban + table views** — drag-and-drop cards or flat table with inline editing
- **Command palette** — quick navigation and actions via `Ctrl+K`
- **Keyboard shortcuts** — full keyboard navigation throughout the app
- **Undo toasts** — non-destructive actions with instant undo
- **Weekly summary** — at-a-glance stats for your job search
- **Google OAuth** — secure sign-in with Auth.js v5
- **Responsive + accessible** — works on desktop and mobile

## How It Works

```
Gmail Inbox
    │
    ▼
┌─────────────────────────┐
│  Deterministic Filter    │  Drops newsletters, social media,
│  (metadata only)         │  promotions — no AI cost
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  Haiku Triage            │  YES / NO / UNCERTAIN
│  (Claude Haiku 4.5)      │  Cost gate — cheap and fast
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  Sonnet Classification   │  Extracts company, role, status,
│  (Claude Sonnet 4.6)     │  location, and confidence score
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  Confidence Routing      │  >0.9 auto-commit
│                          │  0.7–0.9 flagged
│                          │  <0.7 → NEEDS_REVIEW
└─────────────────────────┘
```

## Tech Stack

| Layer     | Technology                                              |
|-----------|---------------------------------------------------------|
| Frontend  | Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui, Motion, Recharts |
| Backend   | Next.js Route Handlers → `server/services/`             |
| Data      | Prisma 7, PostgreSQL (Supabase)                         |
| Auth      | Auth.js v5 (next-auth), Google OAuth, `gmail.readonly`  |
| AI        | Anthropic SDK — Claude Haiku 4.5 (triage) + Sonnet 4.6 (classification) |
| Testing   | Vitest, Testing Library, jsdom                          |

## Architecture

Route handlers in `app/api/` delegate to service modules in `server/services/` — no business logic lives in route files. The Prisma client is a singleton (`server/lib/prisma.ts`). Auth uses JWT strategy with no database adapter.

For deeper details:

- [Architecture overview](docs/architecture.md)
- [Classification pipeline design](docs/pipeline.md)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or [Supabase](https://supabase.com) free tier)
- Google Cloud project with OAuth 2.0 credentials and Gmail API enabled
- [Anthropic API key](https://console.anthropic.com)

### Setup

```bash
git clone https://github.com/Mahib09/application-tracker.git
cd application-tracker
npm install
```

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Run the database migration and start the dev server:

```bash
npx prisma migrate dev
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable             | Description                                                       |
|----------------------|-------------------------------------------------------------------|
| `AUTH_GOOGLE_ID`     | Google OAuth 2.0 client ID                                        |
| `AUTH_GOOGLE_SECRET` | Google OAuth 2.0 client secret                                    |
| `AUTH_SECRET`        | Random string for Auth.js session encryption                      |
| `ANTHROPIC_API_KEY`  | Anthropic API key for Claude                                      |
| `DATABASE_URL`       | PostgreSQL connection URL (pooler/pgbouncer for runtime)           |
| `DIRECT_URL`         | Direct PostgreSQL URL for Prisma migrations (`db.<ref>.supabase.co:5432`) |

See [`.env.example`](.env.example) for full details.

## Scripts

| Command              | Description                    |
|----------------------|--------------------------------|
| `npm run dev`        | Start dev server (port 3000)   |
| `npm run build`      | Production build               |
| `npm run start`      | Start production server        |
| `npm run lint`       | Run ESLint                     |
| `npm test`           | Vitest in watch mode           |
| `npm run test:run`   | Vitest single run (CI)         |

## Project Structure

```
app/
  api/              Route handlers
  dashboard/        Dashboard pages
  login/            Login page
  layout.tsx        Root layout
  page.tsx          Landing page
components/
  ui/               shadcn/ui primitives
  dashboard/        Dashboard-specific components
  layout/           Layout components (sidebar, header)
server/
  services/         Business logic (sync, classification, gmail)
  lib/              Prisma client, shared utilities
lib/                Client-side utilities, hooks, constants
prisma/
  schema.prisma     Database schema
types/              Shared TypeScript types
docs/               Architecture and pipeline documentation
__tests__/          Test files (mirrors source structure)
```

## Privacy

This app requests the `gmail.readonly` scope and uses `format: 'minimal'` when fetching emails — only the subject line and snippet are read. Email content is never stored; only the extracted fields (company, role, status) are saved to the database. Subject and snippet are discarded immediately after classification.

## Status

Portfolio project, actively developed.

- [x] Gmail sync with OAuth
- [x] AI classification pipeline (Haiku + Sonnet)
- [x] Kanban and table views
- [x] Command palette and keyboard shortcuts
- [x] Weekly summary dashboard
- [ ] Bulk actions
- [ ] Export to CSV
- [ ] Email notifications

## License

[MIT](LICENSE)
