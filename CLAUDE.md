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
- `_core/env.ts` — All env vars (`DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL`, `VITE_APP_ID`, `OWNER_OPEN_ID`)
- `_core/trpc.ts` — Exports three procedure types: `publicProcedure` (no auth), `protectedProcedure` (requires session), `adminProcedure` (requires `role === 'admin'`)
- `_core/context.ts` — Builds tRPC context; calls `sdk.authenticateRequest()` on every request, sets `ctx.user = null` if unauthenticated
- `routers/offers.ts` — tRPC procedures: `list`, `getById`, `getPriceHistory`, `getStores`, `runCrawler` (all currently `publicProcedure`)
- `crawler.ts` — Orchestrates scrapers, upserts offers by URL uniqueness, appends to `priceHistory` only when price changes. **Known issue:** calls `clearOffers()` at the start of every run, which cascade-deletes all `priceHistory` rows, defeating the tracking purpose.
- `scheduler.ts` — cron `0 * * * *`, `isRunning` module-level guard prevents concurrent runs, initial crawl 5 s after startup
- `scrapers/` — All three scrapers (Mercado Livre, Amazon, Magazine Luiza) are fully implemented with Cheerio. Magazine Luiza parses `__NEXT_DATA__` JSON embedded in the page.
- `scrapers/filters.ts` — `isMatchingProduct()`: checks all query terms are present and no accessory keywords match
- `db.ts` — Lazy singleton DB init (returns `null` if `DATABASE_URL` missing); all query functions live here

### Frontend (`client/src/`)

- `App.tsx` — Wouter router (not React Router)
- `pages/Offers.tsx` — Main page: offer cards, filters (price range, store, stock), sort (price / date), manual crawler trigger. Sorting is client-side on the returned array.
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

`types.ts` re-exports Drizzle schema types; `const.ts` holds `SEARCH_QUERY`, cookie names, and error message strings used by both client and server.

## Environment Setup

Requires `.env` with at minimum `DATABASE_URL` (MySQL connection string). Without it the server starts but all DB operations return empty/null gracefully. See `SETUP.md` for full setup in Portuguese.

## Known Issues

- `clearOffers()` in `crawler.ts` wipes all offers (and cascades into `priceHistory`) on every crawl cycle. The `isDuplicateOffer()` function in the same file is dead code as a result. To enable real price-history tracking, remove the `clearOffers()` call.
- `runCrawler` tRPC mutation is `publicProcedure` — any unauthenticated user can trigger it. Rate-limited to 5 req/min but not auth-gated. Switch to `protectedProcedure` or `adminProcedure` if public access is undesirable.
- `ScrapedOffer` interface is duplicated in `crawler.ts`, `mercadolivre.ts`, `amazon.ts`, and `magazineluiza.ts`.
