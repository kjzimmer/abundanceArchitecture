# Site Draft — the new AbundanceArchitecture.world (review draft)

*Started 2026-10-13. Source brief: [site-draft/BRIEF.md](site-draft/BRIEF.md), with
[OPEN_QUESTIONS.md](site-draft/OPEN_QUESTIONS.md) and the wireframes in `site-draft/wireframes/` (reference only).
Seed data and Home copy now live in `content/` at the repo root. The brief is authoritative for scope, pages,
routes, data model and content rules; this file records the plan and decisions made against it.*

## Status

- **Stage 1 (findings + plan):** approved by Karl 2026-10-14. All four decisions below made
- **Branch:** `feat/site-draft` (fast-forwarded to include `docs/groups-deployed`). Never merge it to `main` or
  deploy to prod (brief §3)
- **Staging:** Karl created the Railway `staging` environment (2026-10-13) tracking `feat/site-draft`. Verified
  2026-10-14: staging's `DATABASE_URL` resolves to its own Postgres, and both environments store it as
  `${{Postgres.DATABASE_URL}}`. Karl intends all future changes to go through staging; staging DB is disposable
  (periodic resets), so nothing the draft needs may live only in the staging DB
- **Staging use during the draft (Karl, 2026-10-14):** the `staging` env serves the draft until it ships. Other
  changes meanwhile go to prod directly as before (and get rebased into `feat/site-draft`). Staging becomes the
  pre-prod gate for every change only after the draft is live. Fallback for an urgent staged fix: point staging at
  the fix branch briefly, then back (reviewer links + file content survive)
- **Stage 2 (content mechanism, data model, seed import):** ✅ 2026-10-14. `content/*.json` (seed verbatim) +
  `server/src/content/` (`types.ts`, `load.ts`: validation, lookups, `related()`, `citation()`, flags).
  `npm run content:check` validates locally; the server validates the same way at startup. Citation keys:
  `<reference-slug>` (single-claim reference) or `<reference-slug>#<claim-id>` (claim id defaults to its 1-based
  position). Unanswered question fields take `answerPlaceholders`. Current warnings (seed gaps, not bugs):
  `centralization-readings`, `mullainathan-shafir-2013` and `ryan-deci-2000` have no domain tag; no question is
  tagged `health`
- **Stage 3 (layout, menu, footer, banner, access, no-index):** ✅ 2026-10-14. `routes/site.ts` (mounted before
  `express.static` only when `SITE_MODE=draft`), `middleware/reviewGate.ts`, `site/review.ts` (HMAC tokens),
  `site/layout.ts`, `site/html.ts` (auto-escaping `html` template; `text()` renders `[…]`/null as `.ph`
  placeholders), `site/pages/` (flags, sign-in, stubs), `public/site/site.css|js`. `npm run review:link`.
  Locally tested: no cookie → 403 private page; forged/revoked token → 403; owner sees `/review/flags`, reviewer
  gets 404; unknown slugs 404; `X-Robots-Tag` + `robots.txt` disallow; with `SITE_MODE` unset `/` is still the
  teaser and no draft routes exist. Stubs remain for every page built in stages 4–8
- **Staging live 2026-10-14:** `draft.abundancearchitecture.world` verified (gate, noindex, owner link works).
  Staging vars checked: `SITE_MODE=draft`, `EMAIL_MODE=redirect` + `EMAIL_REDIRECT_TO`, own `JWT_SECRET` and
  `REVIEW_LINK_SECRET`, `PUBLIC_BASE_URL` = draft domain; webhook secrets and `R2_*` removed. Karl's owner link was
  issued 2026-10-14 (regenerate any time with `review:link --owner`)
- **Stage 4 (Home):** ✅ 2026-10-14. Copy moved to `content/home.json` (71 strings machine-checked verbatim against
  the brief's copy, kept at `site-draft/home-copy.md`). `site/citation.ts` = the shared Source note (`<details>`:
  in place, keyboard + touch, no JS). Screenshots checked at 1280px and 390px (no overflow)
- **Stage 5 (Domains + domain page):** ✅ 2026-10-14. `site/pages/domains.ts`, shared `site/ui.ts` (breadcrumb,
  enum labels, record lists). Domain page: need (`needFull` if present), four-part analysis, structures table,
  computed questions/signs/initiatives, learning placeholder, side panel (state, members-only comment, neighbours),
  next-domain link. New optional domain fields `lastRevised`, `inTheBook` (placeholders until set). Wireframe-only
  examples not in the seed (Fasten Health, Cochrane) are not shown. References link goes to
  `/references?domain=<slug>` (filter built in stage 7)
- **Next: stage 6** — Initiatives register + initiative page; Questions; Vital Signs; Related panel
- `incoming/` emptied 2026-10-14 (no `_assessment.md`: a feature brief, not a standards transition)
- Also pending (unrelated): Karl's prod test of PR #30 (groups); `docs/groups-deployed` not yet merged to main

## Decisions (Karl, 2026-10-14) — the brief's §0 blanks

| # | Decision | Choice |
|---|---|---|
| 1 | Staging target | Railway `staging` env, own Postgres, `draft.abundancearchitecture.world` |
| 2 | Reviewer access | **Signed per-reviewer links**: `/r/<token>`, token = reviewer name + email signed with a server secret (HMAC), no DB table, so links survive staging resets. Opening it sets an HttpOnly Secure cookie and redirects to a clean URL; every page checks the cookie. Revoke one via an env var list; rotate the secret to revoke all. Comments carry the reviewer's identity automatically. Karl's own link is the owner link (sees draft flags) |
| 3 | Who receives feedback | Karl, **by email** (`[AA Review]` notice with page URL, reviewer, comment) — the durable record, since the staging DB is disposable. Staging Inbox copy is optional/expendable. With `EMAIL_MODE=redirect`, a reviewer's Report sign-up confirmation goes to Karl |
| 4 | Content mechanism | **Files in the repo**: `content/*.json` + Markdown for long text. Edit in VS Code or via Claude, live after a deploy; git = dated change history. They travel with the branch, so nothing to migrate from the disposable staging DB |
| 5 | Going live | Merge `feat/site-draft` to `main` once mature; `SITE_MODE` unset = the teaser (prod stays unchanged by the merge); `draft` = new site + gate + banner + noindex. Launch = a `live` mode (new site, public, indexed) added then, plus Karl lifting the `index.html` freeze in CLAUDE.md |

## Staging setup checklist (given to Karl)

1. Project → environments → New Environment → **Duplicate production** → review staged changes → Deploy
2. App service → Settings → Source → branch `feat/site-draft`. Auto-deploy on; no PR environments
3. Variables (check before the first deploy completes; use Raw Editor to see unresolved values):
   - `DATABASE_URL` must be `${{Postgres.DATABASE_URL}}` (a pasted string would point at the **prod DB**)
   - `JWT_SECRET` new value · `EMAIL_MODE=redirect` · `EMAIL_REDIRECT_TO=<Karl>` ·
     `PUBLIC_BASE_URL=https://draft.abundancearchitecture.world` · `SITE_MODE=draft`
   - Delete `INBOUND_WEBHOOK_SECRET`, `RESEND_WEBHOOK_SECRET` (Worker + Resend webhook only target prod)
   - `R2_*`: separate bucket (`aa-files-staging`) or delete for now (local disk fallback is wiped per deploy)
   - Keep: `NODE_ENV=production`, Resend key, Turnstile, CF analytics, `ADMIN_NOTIFY_EMAIL`
4. Custom domain `draft.abundancearchitecture.world` → CNAME in Cloudflare (proxied). Optionally remove the
   `*.up.railway.app` domain
5. Turnstile widget "AA forms": add the draft hostname
6. Migrations run on start (`railway.toml`), so the empty DB gets the schema. Admin user needs seeding (Claude
   does this; `railway run` can't reach the internal DB host, so use the public DB URL)
7. Railway CLI is linked to production: always pass `--environment staging`

## Plan

- **`SITE_MODE=draft`** mounts the new site routes before `express.static` (so `/` is the new Home), plus the access
  gate, draft banner ("Draft for review. Not yet public."), `X-Robots-Tag: noindex` and a disallow-all
  `robots.txt`. Unset (prod) → nothing changes and `/` stays the frozen teaser. `public/index.html` is not edited
- **Rendering:** server-rendered HTML from TypeScript templates (pattern of `server/src/lib/publicPage.ts`), no new
  framework. One stylesheet on the teaser tokens (`brand.ts`: paper `#eeeae0`, ink `#1a1917`, green `#2d4a2d`,
  EB Garamond + Inter). Wireframes fix structure/wording only; ignore their IBM Plex/greyscale styles
- **Small vanilla JS:** citation notes (disclosure button, in place, keyboard + phone), register filters
  (progressive enhancement; page works without JS)
- **Content:** loader validates slugs and domain/form tags at startup (broken cross-links fail the deploy). Related
  panels and domain pages computed from tags. Evidence status lives on the claim, not the source
- **Placeholders:** `[…]` text and null fields render in a muted placeholder style. Never invent content
- **Draft flags:** visible to Karl only (marker + `/review/flags` listing every `draft: true` / `note`)
- **Feedback:** "Comment on this page" → Inbox conversation (page URL, reviewer, comment) + email notice
- **Ask a question (footer):** new `/ask` page on the existing `/api/contact` + Turnstile (the existing form is
  embedded in the teaser only)
- **Join:** interest form → Person + "Founding member interest" Group + notice. No price shown ($10/month is only in
  OPEN_QUESTIONS, unconfirmed)
- **Report:** archive placeholder + existing subscribe endpoint. **Sign in:** "After first launch" page → Join
- **Commits:** one per brief §10 stage (2 content/model/seed → 3 layout/gate → 4 Home → 5 Domains → 6 Initiatives,
  Questions, Vital Signs → 7 References + citations → 8 Learn, Book, Report, Join, About, Licence → 9 feedback +
  editing note for Karl)

## Gaps and conflicts noted to Karl

- CLAUDE.md "What Never Changes" freezes `public/index.html`; making the new Home public needs Karl to change that
- Long-lived branch: rebase `feat/site-draft` on `main` regularly while email work continues
- No data for: question evidence status, vital-sign method/sources, "learning material" in Related panels → placeholders
- The three Home citations are unrated → their notes say "not yet rated"
- OPEN_QUESTIONS C16 (Health becomes a section; HealthUnveiled not built separately) contradicts current suite docs
- FreeMarketWatch is a separate repo (`../freeMarketWatch`), not changed. "Architecture of Abundance" appears in
  `client/src/components/Footer.tsx:87`, `client/src/content/acts.ts:568,591`, `client/src/pages/LensHub.tsx:243`.
  Karl has been told
