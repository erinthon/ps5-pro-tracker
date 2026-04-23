---
name: clean-code
description: Code quality review for readability, naming, duplication, and simplicity in this TypeScript codebase. Flags violations of clean code principles and proposes minimal, targeted fixes. Use after implementing a feature or before a PR.
---

# Clean Code

Targeted code quality review for the PS5 Pro tracker TypeScript codebase.

## What This Skill Does

When invoked, review the specified file(s) or recent changes for clean code violations. Propose minimal fixes — do not refactor beyond the scope of the identified issue.

## Review Criteria

### Naming
- Variables, functions, and types should be self-documenting — no single-letter names outside of loop indices
- Boolean names: `isRunning`, `inStock`, `hasError` — not `flag`, `status`, `val`
- Functions should be verbs: `fetchOffers`, `clearOffers`, `upsertOffer`

### Functions
- Single responsibility — one function does one thing
- Max ~20 lines; if longer, check if it's doing multiple things
- No boolean flag parameters that change behavior: prefer two functions

### Duplication
- `ScrapedOffer` interface is duplicated in `crawler.ts`, `mercadolivre.ts`, `amazon.ts`, `magazineluiza.ts` — consolidate into `shared/types.ts`
- Any copy-pasted scraper logic should be extracted to a shared utility

### Comments
- No comments that restate what the code does
- Only comments for non-obvious WHY: hidden constraints, workarounds, invariants
- Dead code (commented-out blocks) — delete, not comment

### TypeScript
- No `any` — use proper types or `unknown` with a guard
- No non-null assertions (`!`) unless provably safe
- Explicit return types on exported functions

### React / Frontend
- No inline styles unless truly dynamic
- No `useEffect` for derived state — compute it inline
- Keys in lists must be stable identifiers, not array indices

## Output Format

For each issue:
```
<file>:<line> — [NAMING | DUPLICATION | COMPLEXITY | TYPES | COMMENTS]
Problem: <what's wrong>
Fix: <concrete minimal change>
```

End with a count: X issues found, Y critical (blocks PR), Z suggestions (optional).
