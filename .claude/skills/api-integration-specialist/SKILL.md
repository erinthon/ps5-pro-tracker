---
name: api-integration-specialist
description: Expert guidance for integrating external APIs and web scrapers in this project. Covers HTTP client setup, error handling, retry logic, rate limiting, data normalization, and testing scraped/API responses. Use when adding a new data source, debugging a scraper, or improving resilience of an existing integration.
---

# API Integration Specialist

Expert guidance for external API and web scraper integrations in the PS5 Pro tracker.

## What This Skill Does

When invoked, review or build an integration: scraper, REST API, or webhook. Produce robust, production-ready code following the patterns already established in this repo.

## Existing Integration Patterns (Reference These)

### Scraper Pattern (`server/scrapers/`)
```typescript
// Each scraper exports one async function
export async function scrape<StoreName>(): Promise<ScrapedOffer[]>

// Uses cheerio for HTML parsing
// Magazine Luiza: parses __NEXT_DATA__ JSON — preferred over brittle CSS selectors
// Mercado Livre: preserve `wid` query param in URLs (dedup key)
// All URLs normalized before return to avoid positional duplicates
```

### Shared Types (`shared/types.ts`)
```typescript
// ScrapedOffer should live here (currently duplicated — consolidate on next touch)
interface ScrapedOffer {
  title: string
  price: number        // centavos
  url: string          // canonical, normalized
  imageUrl?: string
  rating?: number      // centésimos
  inStock: boolean
  storeName: string
}
```

### Error Handling Rules
- Network errors: catch and return `[]` (empty array) — never throw from a scraper
- Partial failures: one store failing must not stop others
- Log the error with store name and URL for debugging
- No retries in the scraper itself — the scheduler handles re-runs hourly

### URL Normalization
- Strip tracking params that change per-visit but keep dedup params (e.g., `wid` on ML)
- Lowercase scheme and host
- Sort remaining query params alphabetically for stable comparison

## Adding a New Scraper

1. Create `server/scrapers/<storename>.ts`
2. Add store row to `stores` table in the initial seed or migration
3. Export `scrape<StoreName>(): Promise<ScrapedOffer[]>`
4. Import and call it in `server/crawler.ts` alongside existing scrapers
5. Write a Vitest test in `server/scrapers/<storename>.test.ts` using a fixture HTML file

## Testing Integrations

```typescript
// Use fixture HTML files to avoid live network calls in tests
// server/scrapers/__fixtures__/magazineluiza.html

import { scrapeML } from './mercadolivre'
import * as cheerio from 'cheerio'
import { readFileSync } from 'fs'

it('parses price in centavos', async () => {
  // mock fetch / axios with fixture
  const offers = await scrapeML()
  expect(offers[0].price).toBeGreaterThan(0)
})
```

## Resilience Checklist

- [ ] Returns `[]` on network error, never throws
- [ ] URL normalized and stable across runs
- [ ] Price parsed as integer centavos (no floats, no currency symbols)
- [ ] `inStock` derived from page state, not assumed
- [ ] Passes `isMatchingProduct()` filter from `scrapers/filters.ts`
- [ ] Test with a fixture covers the happy path and a missing-price edge case
