---
name: senior-architect
description: Architecture review and design skill for this TypeScript monorepo. Evaluates structural decisions, data flow, scalability, and technical debt. Use when planning a new feature, refactoring a module, or evaluating a design tradeoff.
---

# Senior Architect

Architecture review and design guidance for the PS5 Pro tracker monorepo (React 19 + Vite / Express + tRPC / MySQL + Drizzle).

## What This Skill Does

When invoked, analyze the architecture relevant to the user's question. Identify coupling, single points of failure, data model issues, and scalability concerns. Propose concrete changes with tradeoffs.

## Architecture Reference

### Current Stack
- **Frontend:** React 19, Vite, Wouter router, tRPC client, superjson
- **Backend:** Express, tRPC, Helmet, rate limiting, Google OAuth
- **Database:** MySQL via Drizzle ORM (`users`, `stores`, `offers`, `priceHistory`)
- **Scheduler:** node-cron, hourly crawl, `isRunning` guard
- **Scrapers:** Cheerio — Mercado Livre, Amazon, Magazine Luiza

### Known Architectural Debt
1. `clearOffers()` in `crawler.ts` wipes history on every run — defeats price tracking
2. `ScrapedOffer` interface duplicated across 4 files — should live in `shared/types.ts`
3. `runCrawler` is `publicProcedure` — no auth gate
4. Sorting in `Offers.tsx` is client-side — won't scale past a few hundred offers
5. No pagination on the offers list query

### Design Principles to Apply
- **Bounded contexts:** scrapers produce `ScrapedOffer`, crawler owns persistence, tRPC owns transport
- **Deduplication key:** `offers.url` is the canonical identity — do not add secondary keys
- **Encoding contracts:** prices in centavos, ratings in centésimos, inStock as `int` — never break these
- **Null DB:** server must start without `DATABASE_URL`; all DB calls behind null-check guard

## Review Output Format

1. **Summary** — what was reviewed and the top concern
2. **Findings** — each with: area, problem, impact, recommended fix
3. **Tradeoffs** — what the fix costs vs. what it gains
4. **Migration path** — steps to get from current state to target state without breaking production
