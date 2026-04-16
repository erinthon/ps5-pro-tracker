# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start dev server with hot reload
pnpm build      # Production build (Vite + esbuild)
pnpm start      # Run production build
pnpm check      # TypeScript type checking
pnpm format     # Format with Prettier
pnpm test       # Run Vitest tests (server/**/*.test.ts)
pnpm db:push    # Push schema + run migrations
```

## Architecture

Full-stack TypeScript monorepo: React 19 + Vite frontend, Express + tRPC backend, MySQL via Drizzle ORM.

**Request flow:** React client → tRPC over HTTP → Express → DB queries / Crawler

**Key path aliases:** `@/*` → `client/src/`, `@shared/*` → `shared/`

### Backend (`server/`)

- `_core/index.ts` — Express app entry: body parser, OAuth routes, tRPC middleware at `/api/trpc`, Vite dev server or static files, port auto-increment from 3000, starts scheduler
- `_core/env.ts` — All env vars (`DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL`, `VITE_APP_ID`, `OWNER_OPEN_ID`)
- `routers/offers.ts` — tRPC procedures: `list`, `runCrawler`, `getStores`, `getPriceHistory`
- `crawler.ts` — Orchestrates scrapers, upserts offers by URL uniqueness, logs price history only on changes
- `scheduler.ts` — cron `0 * * * *`, `isRunning` guard, initial crawl 5s after startup
- `scrapers/` — `mercadolivre.ts` and `amazon.ts` use Cheerio; `magazineluiza.ts` placeholder (needs Puppeteer)
- `db.ts` — Lazy DB init (safe without DB for local tooling); all query functions live here

### Frontend (`client/src/`)

- `App.tsx` — Wouter router (not React Router)
- `pages/Home.tsx` — Landing page
- `pages/Offers.tsx` — Main page: offer list, filters, sorting, manual crawler trigger via tRPC mutation
- `lib/trpc.ts` — tRPC client setup

### Database (`drizzle/schema.ts`)

Four tables: `users`, `stores`, `offers`, `priceHistory`. Prices stored in **centavos** (integer) to avoid float precision issues. Offer URLs are unique — the deduplication key. `priceHistory` cascade-deletes with `offers`.

### Shared (`shared/`)

`types.ts` re-exports from drizzle schema; `const.ts` holds cookie names and app-wide constants.

## Environment Setup

Requires a `.env` file with at minimum `DATABASE_URL` (MySQL connection string). Without it the server starts but crawling and DB queries fail. See `SETUP.md` for full setup in Portuguese.
