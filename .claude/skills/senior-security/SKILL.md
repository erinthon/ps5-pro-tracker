---
name: senior-security
description: Security review and hardening skill for TypeScript/Node.js applications. Covers OWASP Top 10, authentication, authorization, injection prevention, secrets management, rate limiting, and dependency auditing. Use when hardening an endpoint, reviewing auth flows, or doing a security audit.
---

# Senior Security

Security auditing and hardening for full-stack TypeScript applications.

## What This Skill Does

When invoked, perform a targeted security review of the current codebase or the scope the user specifies. Cover all layers: HTTP, auth, DB, frontend, and secrets.

## Review Checklist

### 1. Authentication & Authorization
- JWT secret strength and expiry policy (`JWT_SECRET` in `server/_core/env.ts`)
- Session cookie flags: `HttpOnly`, `Secure`, `SameSite`
- `adminProcedure` / `protectedProcedure` used on all sensitive tRPC routes
- OAuth redirect URI validation (no open redirects)

### 2. Injection Prevention
- All DB queries use Drizzle ORM parameterized calls — no raw SQL string concatenation
- HTML output from scrapers sanitized before storage or rendering
- `eval`, `Function()`, dynamic `require()` — flag any occurrence

### 3. HTTP Security (Express)
- Helmet enabled with a strict CSP
- CORS origin whitelist, not wildcard in production
- Rate limiting on all public endpoints (check `_core/index.ts`)
- `runCrawler` tRPC mutation — currently `publicProcedure`, flag if unauthenticated access is undesirable

### 4. Secrets & Environment
- No secrets in source code or committed `.env` files
- `DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL` sourced only from environment
- `.env` in `.gitignore`

### 5. Dependency Audit
```bash
pnpm audit
pnpm outdated
```
Flag any critical/high CVEs. Check `cheerio`, `express`, `drizzle-orm` versions.

### 6. Frontend XSS
- No `dangerouslySetInnerHTML` with unescaped user/scraper data
- Price and product name fields treated as plain text, not HTML

### 7. Error Handling & Information Leakage
- Stack traces not exposed to clients in production
- tRPC error messages sanitized — no DB error details sent to frontend

## Output Format

For each finding:
```
[SEVERITY: CRITICAL/HIGH/MEDIUM/LOW] <file>:<line>
Issue: <what is wrong>
Fix: <concrete code change>
```

Then provide a prioritized fix list: CRITICAL first, quick wins second.
