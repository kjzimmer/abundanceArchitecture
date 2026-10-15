# Site Draft — the new AbundanceArchitecture.world (review draft)

*Started 2026-10-13. Source brief: [site-draft/BRIEF.md](site-draft/BRIEF.md), with
[OPEN_QUESTIONS.md](site-draft/OPEN_QUESTIONS.md) and the wireframes in `site-draft/wireframes/` (reference only).
Seed data and Home copy now live in `content/` at the repo root. The brief is authoritative for scope, pages,
routes, data model and content rules; this file records the plan and decisions made against it.*

## Resume here (fresh session)

*Updated 2026-10-14.* The draft is fully built (all 9 brief stages) and live on staging. **Karl is doing a full
walkthrough and will bring many questions and comments.** Next session: start from his feedback, log it in
"Review feedback" below, then plan changes with him before editing. Nothing here is blocked.

- **See it:** https://draft.abundancearchitecture.world with Karl's owner link (lost link → regenerate:
  `railway run --environment staging --service abundanceArchitecture npm run review:link -- --name "Karl Zimmer" --email karl@abundancearchitecture.world --owner`)
- **Code map:** `content/*.json` (all records + copy; guide in `content/README.md`) → `server/src/content/load.ts`
  (validation, lookups, related, citations) → `server/src/routes/site.ts` (pages) → `server/src/site/pages/*.ts`
  (one file per section) + `site/layout.ts`, `site/ui.ts`, `site/html.ts`, `site/citation.ts`;
  forms: `routes/siteForms.ts` → `services/SiteDraftService.ts`; styles/JS: `public/site/`
- **Verify locally:** `npm run content:check`; server with `SITE_MODE=draft REVIEW_LINK_SECRET=<32+ chars>
  EMAIL_MODE=log` + a link from `npm run review:link`
- **Workflow:** commit to `feat/site-draft` and push → staging redeploys (~2 min). Never merge to `main` until Karl
  says so

## Reviewer links issued

*Revoke one by adding the email to staging's `REVIEW_REVOKED`.*

| Reviewer | Email | Role | Issued |
|---|---|---|---|
| Karl Zimmer | karl@abundancearchitecture.world | owner | 2026-10-14 |
| Hans Prahl | hans.t.prahl@gmail.com | reviewer | 2026-10-15 |

## Review feedback (Karl)

*Log Karl's questions and comments here as they come, with what was decided and done.*

- **2026-10-15 Home + About copy update** (Karl's brief:
  [site-draft/UPDATE_2026-10-15_home_about.md](site-draft/UPDATE_2026-10-15_home_about.md)). Done:
  new Home purpose statement; new part 2 heading, paragraph, three cited points (`points` + `leadIn` in
  `home.json`, rendered by `home.ts`) before the unchanged cards; About replaced (`pages.json` → `about.intro`,
  `sections`, `links`; "Who is behind it" stays a placeholder). References: added `hayek-1945`, `scott-1998`
  (appended, so existing numbering is unchanged) and a second claim on `ostrom-1990`. Knock-on: part 1's card now
  cites `ostrom-1990#1` (a bare slug is ambiguous once a reference has two claims). Short citations for the two
  new references follow the existing "Author, Title (year)" pattern (derived from Karl's table, not invented).
  Purpose statement font scaled down a step so the longer statement keeps the question near the fold. Verified:
  29 copy strings verbatim; before/after render of every page shows only Home, About, References and the
  references count on Governance / Production and labor changed

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
- **Stage 6 (Initiatives, Questions, Vital Signs, Related panel):** ✅ 2026-10-14. `site/pages/initiatives.ts`,
  `questions.ts`, `signs.ts`; `relatedPanel()` + filter helpers in `site/ui.ts`. Register filters are a GET form
  (work without JS, shareable URLs; JS auto-submits selects). Initiative page: tags, six-step stage tracker, status
  log, members-only discussion/working group. Tables become labelled cards at phone width. Omitted the wireframe
  line "Nothing is listed without a named owner" (false: all seed owners are unnamed). Questions intro = site map
  wording; Vital Signs intro = Home card wording. Vital sign "basis" is shown on the sign page; two bases mention
  internal chats ("metrics chat") — Karl to reword if unwanted
- **Stage 7 (References + citation notes):** ✅ 2026-10-14. `site/pages/references.ts`. Evidence levels explained
  from `enums.json`; filters: domain (incl. "Across domains" = untagged), kind, evidence status, search. Per claim:
  "Cited on" (computed by `content.citedOn()` from Home/question/sign citations, merged with the seed's `citedOn`)
  and evidence status; per source: how we read it, "Open the source" (placeholder when no URL). Reference page adds
  a Related panel. Verified: all three Home citation notes link to reference pages that list Home as cited on
- **Stage 8 (Learn, Book, Report, Join, About, Licence, Ask):** ✅ 2026-10-14. `site/pages/sections.ts`; copy in
  new `content/pages.json` (About/Ask/Report reuse live-teaser wording; Join reuses Home part 4). Forms post JSON
  via `public/site/site.js` with Turnstile: Ask → existing `/api/contact` (Inbox), Report → existing
  `/api/subscribe` (double opt-in; staging redirects the email to Karl), Join → new `/api/site/join`
  (`routes/siteForms.ts` behind the reviewer gate → `services/SiteDraftService.ts`: Inbox conversation
  "Founding member interest" + membership of the auto-created "Founding member interest" group). Learn: Ask box,
  answer modes and feedback buttons visibly disabled ("After first launch"); 3 video + 1 podcast placeholders.
  New UI wording of mine for Karl to check: Join "No payment is taken here. This records your interest.", button
  "Register interest", success "Thank you. Your interest is recorded."
- **Stage 9 (reviewer feedback + editing note):** ✅ 2026-10-14. "Comment on this page" (`<details>` above the
  footer, every page) → `POST /api/site/feedback` (reviewer gate; identity from the signed link, never the form;
  same-site paths only; no Turnstile) → `SiteDraftService.recordReviewComment` → `[AA Review] <page> — <name>`
  admin notice (new `NoticeType` 'Review'), Reply-To = reviewer. Editing guide: `content/README.md`
- **Build complete 2026-10-14; awaiting Karl's review on staging.** Not merged to `main` (by design)

## Definition of done (brief §10) — status

| Criterion | Status |
|---|---|
| Every menu and footer link leads to a working page; every seed record has its own page | ✅ Crawl: 75 pages, 0 non-200; all 43 seed records have pages |
| Changing a record in one place changes it everywhere | ✅ One file per collection; every page reads `content/` |
| Health domain page lists its structures and, automatically, its initiatives | ✅ 2 structures; 2 initiatives by tag |
| The three Home citations open their notes and link to the right references | ✅ Each reference page lists Home under "Cited on" |
| A reviewer can read every page on a phone and leave a comment that reaches Karl | ✅ Locally (log mode). **Karl to confirm on staging**: comment → `[AA Review]` email at the redirect address |
| No bracketed placeholder replaced with invented text | ✅ All `[…]` render as placeholders; Home copy machine-checked verbatim |
| Live site, subscribers and data unchanged | ✅ Nothing merged to `main`; prod verified unchanged (teaser, no noindex) |

## For Karl after review (not blocking)

- Content gaps the build surfaced: no question tagged `health`; three records untagged (see Draft flags page)
- Two vital-sign "basis" fields mention the internal "metrics chat"
- UI wording of mine to confirm: Join note/button/success text (stage 8); "Commenting as … Your comment goes to
  Karl with the address of this page."
- To make it public later: add a `live` `SITE_MODE`, lift the `index.html` freeze in CLAUDE.md, merge to `main`
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
