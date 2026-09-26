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

## [2026-09-24] SHARED_ADMIN_MODULES.md
**Site:** abundance-architecture
**Type:** Gap
**Section:** (new) — Email / Newsletter modules
**Issue:** No module covers outbound email (send log, delivery webhooks, suppression),
double opt-in / unsubscribe, inbound email, or newsletter compose/send/history. The
Contact module's `NOTIFICATION_EMAIL_ENDPOINT` fire-and-forget pattern is superseded once
Resend is integrated. AA is building these per `docs/wip/email-newsletter.md`.
**Suggested fix:** After AA ships PR A–C, extract Email Foundation, Inbound/Conversations,
and Newsletter modules into SHARED_ADMIN_MODULES.md, with the NewsletterSubscriber
additions (token, confirmedAt, unsubscribedAt) and the Contact notification replaced.
**Workaround used:** Designing in the AA wip spec; will propose the module text after ship.

## [2026-09-24] SHARED_TECH_STACK.md
**Site:** abundance-architecture
**Type:** Gap
**Section:** Repository Structure; External Services; What Is Deliberately Not Prescribed
**Issue:** (1) The repo structure has no place for a Cloudflare Worker package. AA's inbound
email uses a Cloudflare Email Worker, planned at `worker/` with its own package.json and
wrangler.toml. (2) "Email capture service — decide before first broadcast" is now decided
for AA: self-built on Resend, with the subscriber list in Postgres (no Mailchimp/ConvertKit).
(3) Cloudflare Email Routing and DMARC setup aren't in the DNS Setup Pattern.
**Suggested fix:** Add an optional `worker/` folder to the repo structure; record the Resend +
self-built newsletter decision; extend the DNS Setup Pattern with Email Routing MX/SPF, Resend
Domain Connect records, and a DMARC `p=none` starting policy.
**Workaround used:** Proceeding with `worker/` in AA (PR B) and documenting in the wip spec.

## [2026-09-24] docs/ARCHITECTURE.md
**Site:** abundance-architecture
**Type:** Error
**Section:** Data Model (Pending), Admin login flow, Folder Notes
**Issue:** Out of date after PR3 and Module 6. It still lists RefreshToken/TOTP as pending,
describes a 7-day localStorage token, and shows AdminLayout as top-tab nav. SITE_DESIGN.md
also still describes the pre-Module-6 admin layout.
**Suggested fix:** Refresh both docs to the current state; after the email work ships, add
the email models, routes, and env vars from `docs/wip/email-newsletter.md`.
**Workaround used:** Treating the code and wip spec as the source of truth.

## [2026-09-24] docs/SITE_DESIGN.md
**Site:** abundance-architecture
**Type:** Error
**Section:** Public Teaser Page — Design Tokens
**Issue:** The listed tokens (navy `#0a0a1a`, gold `#c9a84c`, off-white text, Georgia) don't match
`public/index.html`. The page's `:root` is ink `#1a1917`, paper `#eeeae0`, accent green `#2d4a2d`,
accent-light `#e8efe8`, ink-light `#6b6764`, EB Garamond (serif) + Inter (sans), with a sticky ink masthead.
**Suggested fix:** Replace the token list with the actual `:root` values from `public/index.html`.
**Workaround used:** Email templates and confirm/unsubscribe pages follow the actual `index.html` tokens.

## [2026-09-24] SHARED_TECH_STACK.md
**Site:** abundance-architecture
**Type:** Gap
**Section:** Database — Prisma; Root package.json Scripts Pattern
**Issue:** With `prisma/` at the repo root and `@prisma/client` only in `server/package.json`,
`prisma generate --schema=../prisma/schema.prisma` can't find a client next to the schema. It then
**auto-installs `@prisma/client` into the root** (editing root package.json and the lockfile) and
generates there. At runtime, `server/node_modules/@prisma/client` resolves `.prisma/client` by walking
up to the root. It works, but it's fragile: a leftover `server/node_modules/.prisma` placeholder
(from @prisma/client's postinstall) hides the real client. In AA that meant `PrismaClient: any` for
local type-checking, so Prisma types were never actually checked. Every local generate also leaves
root package.json dirty.
**Suggested fix:** Pick one location and document it. Either (a) add `@prisma/client` to root
dependencies explicitly, or (b) set `output` in the generator block and import from that path.
Add a gotcha for the placeholder-shadowing symptom (`PrismaClient: any`, missing model types).
**Workaround used:** Deleted the stale `server/node_modules/.prisma` locally. Reverted Prisma's
automatic root package.json edits so the PR matches the existing (working) Railway behavior.

## [2026-09-25] SHARED_TECH_STACK.md
**Site:** abundance-architecture
**Type:** Error
**Section:** Rate Limiting
**Issue:** With Cloudflare → Railway, express-rate-limit's default key (`req.ip`, with `trust proxy` off)
is Railway's internal proxy address, so every visitor shares one bucket. A bot can then lock the admin out
of login site-wide. The log shows `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`. The obvious fix,
`trust proxy = N`, is also wrong here. Measured in AA prod: Railway's edge rewrites X-Forwarded-For to
`<connecting ip>, <edge ip>`, and on the Cloudflare path the connecting IP is a Cloudflare server, so
visitors behind the same Cloudflare location would still share a bucket. `X-Real-IP`, set by Railway's edge,
is the true client via Cloudflare and via `*.up.railway.app`, and can't be spoofed (tested). FMW and HU
likely have the same problem.
**Suggested fix:** In Rate Limiting, specify
`keyGenerator: req => ipKeyGenerator(clientIp(req))`, where `clientIp` reads `X-Real-IP` (validated with
`net.isIP`) and falls back to `req.ip`. Also `validate: { xForwardedForHeader: false }`, and don't set `trust proxy`.
Reference: `abundanceArchitecture/server/src/lib/clientIp.ts`.
**Workaround used:** Implemented as above in AA.

