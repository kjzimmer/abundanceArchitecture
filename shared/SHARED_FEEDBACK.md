# Shared Doc Feedback
**Site:** abundance-architecture
**Governance:** CC appends here when shared docs have gaps, conflicts, or errors.
Never edit SHARED_TECH_STACK.md or SHARED_ADMIN_MODULES.md directly.
This file is reviewed in Claude.ai and resolved there.

---

## [2026-06-30] SHARED_TECH_STACK.md
**Site:** abundance-architecture
**Type:** Gap
**Section:** Infrastructure — Root package.json Scripts Pattern
**Issue:** The root package.json pattern only lists `prisma` in dependencies. Any site using
Prisma with a `prisma.config.ts` that imports `dotenv/config` also needs `dotenv` in root
dependencies. The `npx prisma migrate deploy` start command loads `prisma.config.ts` from
the repo root, so `dotenv` must be resolvable from root `node_modules` — it is not
sufficient to have it only in `server/package.json`.
**Suggested fix:** Add `dotenv` to the root package.json dependencies example alongside `prisma`.
**Workaround used:** Added `dotenv` to root `package.json` dependencies in hotfix PR #7.

