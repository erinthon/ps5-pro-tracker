---
name: git-commit-helper
description: Guides structured, conventional commits for this repository. Generates commit messages following Conventional Commits spec, groups related changes, and ensures nothing sensitive is staged. Use before committing or when you want a well-formed commit message drafted.
---

# Git Commit Helper

Structured commit workflow for the PS5 Pro tracker repo.

## What This Skill Does

When invoked, inspect staged/unstaged changes and produce a ready-to-use commit command following Conventional Commits. Flag anything that should NOT be committed (secrets, build artifacts, lock-file-only noise).

## Conventional Commits Reference

```
<type>(<scope>): <short summary>

[optional body — only if the WHY is non-obvious]
```

### Types
| Type | When to use |
|------|-------------|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `chore` | Tooling, deps, config (no prod code change) |
| `docs` | Documentation only |
| `revert` | Reverts a previous commit |

### Scopes for This Repo
`crawler`, `scraper`, `scheduler`, `db`, `trpc`, `auth`, `frontend`, `offers`, `price-history`, `env`, `deps`

## Workflow

1. Run `git diff --cached` and `git status` to see what's staged
2. Check for sensitive files: `.env`, `*.key`, `*.pem`, `secrets.*`
3. Check for build artifacts that shouldn't be committed: `dist/`, `node_modules/`
4. Draft the commit message
5. Output the ready-to-run `git commit -m` command using a HEREDOC

## Example Output

```bash
git commit -m "$(cat <<'EOF'
fix(crawler): remove clearOffers() to preserve price history

Calling clearOffers() at the start of every crawl cascaded into
priceHistory, making historical tracking impossible.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

## Rules
- Keep the subject line under 72 characters
- Use imperative mood: "add", "fix", "remove" — not "added", "fixed"
- No period at the end of the subject line
- Body only when the diff alone doesn't explain the why
