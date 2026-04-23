# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start dev server with hot reload
pnpm build            # Production build (Vite + esbuild)
pnpm start            # Run production build
pnpm check            # TypeScript type checking
pnpm format           # Format with Prettier
pnpm test             # Run all Vitest tests (server/**/*.test.ts)
pnpm test crawler     # Run a single test file by name pattern
pnpm db:push          # Push schema + run migrations
```

## Architecture

Full-stack TypeScript monorepo: React 19 + Vite frontend, Express + tRPC backend, MySQL via Drizzle ORM.

**Request flow:** React client → tRPC over HTTP → Express → DB queries / Crawler

**Path aliases:** `@/*` → `client/src/`, `@shared/*` → `shared/`

### Backend (`server/`)

- `_core/index.ts` — Express app entry: Helmet, rate limiting, OAuth routes, tRPC at `/api/trpc`, static/Vite serving, starts scheduler on listen
- `_core/env.ts` — All env vars (`DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL`, `VITE_APP_ID`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`)
- `_core/trpc.ts` — Exports three procedure types: `publicProcedure` (no auth), `protectedProcedure` (requires session), `adminProcedure` (requires `role === 'admin'`)
- `_core/context.ts` — Builds tRPC context; calls `sdk.authenticateRequest()` on every request, sets `ctx.user = null` if unauthenticated
- `_core/llm.ts` — `invokeLLM()` wrapper around the Forge API (Gemini 2.5 Flash); handles message normalization, tool calls, and structured output schemas
- `_core/notification.ts` — `notifyOwner()`: sends a push notification to the project owner via the Manus Notification Service; requires `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY`
- `_core/email.ts` — `sendPriceDropEmail()`: sends an HTML e-mail via Resend when a price drop is detected; reads the recipient from `users.email` where `openId = OWNER_OPEN_ID`; no-ops silently if `RESEND_API_KEY` is absent
- `routers.ts` — Root `appRouter`: mounts `system`, `auth` (`me` query + `logout` mutation), and `offers` sub-routers
- `routers/offers.ts` — tRPC procedures: `list`, `getById`, `getPriceHistory`, `getStores`, `getCatalog`, `runCrawler` (all `publicProcedure`). `runCrawler` accepts optional `itemId` from the catalog.
- `crawler.ts` — Orchestrates scrapers; applies `catalogItem.isMatch()` filter; upserts offers by URL; appends to `priceHistory` only on price change; calls `deleteStaleOffersForStore()` per store after each scrape (only when results are non-empty, to avoid accidental wipes on scraper failure)
- `scheduler.ts` — cron `0 * * * *`, `isRunning` module-level guard prevents concurrent runs, initial crawl 5 s after startup
- `scrapers/` — Four scrapers: Mercado Livre, Amazon, Magazine Luiza, KaBuM!. All use Cheerio. Magazine Luiza and KaBuM! first try `__NEXT_DATA__` JSON, then fall back to HTML parsing.
- `storage.ts` — `storagePut` / `storageGet` helpers for the Forge storage proxy; requires `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY`
- `db.ts` — Lazy singleton DB init (returns `null` if `DATABASE_URL` missing); all query functions live here, including `deleteStaleOffersForStore(storeId, activeUrls)`

### Frontend (`client/src/`)

- `App.tsx` — Wouter router (not React Router); routes: `/` → `Home`, `/offers` → `Offers`
- `pages/Home.tsx` — Landing page with Google OAuth login button (`/api/auth/google`)
- `pages/Offers.tsx` — Offer cards, filters (price range, store, stock), sort (price / date), manual crawler trigger. Sorting is client-side on the returned array.
- `lib/trpc.ts` — tRPC client setup with superjson transformer

### Database (`drizzle/schema.ts`)

Four tables: `users`, `stores`, `offers`, `priceHistory`.

Notable encoding choices — keep these consistent when writing queries or adding columns:
- **Prices** stored as `int` in **centavos** (e.g. `499900` = R$ 4.999,00)
- **`inStock`** stored as `int` (`1` / `0`), not a boolean column
- **`rating`** stored as `int` in **centésimos** (e.g. `450` = 4.50 stars)
- `priceHistory.offerId` has `onDelete: "cascade"` — deleting an offer removes its history
- `offers.url` is the deduplication key (unique index)

### Shared (`shared/`)

- `types.ts` — re-exports Drizzle schema types
- `const.ts` — cookie names and error message strings used by both client and server
- `catalog.ts` — `CATALOG: CatalogItem[]` defines trackable products; each item has `id`, `label`, `searchQuery`, and `isMatch(ctx)` (price-aware title filter). The crawler uses `getCatalogItem(itemId)` to drive scraping. Currently contains one item: `ps5-pro-console`.

## Environment Setup

Requires `.env` with at minimum `DATABASE_URL` (MySQL connection string). Without it the server starts but all DB operations return empty/null gracefully. See `SETUP.md` for full setup in Portuguese.

`BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` are required for LLM calls, push notifications, and file storage; the server runs without them but those features will throw at runtime.

`RESEND_API_KEY` enables e-mail notifications on price drops. Without it the feature is silently skipped. The recipient is the owner's e-mail stored in the DB (populated on first Google login). Get an API key at resend.com — free tier allows 3 000 e-mails/month.

## Known Issues

- `runCrawler` tRPC mutation is `publicProcedure` — any unauthenticated user can trigger it. Rate-limited to 5 req/min but not auth-gated. Switch to `protectedProcedure` or `adminProcedure` if public access is undesirable.
- `ScrapedOffer` interface is duplicated in `crawler.ts` and each scraper file (`mercadolivre.ts`, `amazon.ts`, `magazineluiza.ts`, `kabum.ts`).
