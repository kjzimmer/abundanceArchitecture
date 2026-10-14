# Editing the site's content

Every record on the draft site lives in one file in this folder. Change it here and it changes on every page
that shows it: register, record page, domain pages, Related panels and citation notes.

## The workflow

1. Edit the JSON file (in VS Code, or ask Claude).
2. Run `npm run content:check`. It reports any broken reference (an unknown domain, form, stage or citation)
   and lists warnings such as records with no domain tag.
3. Commit and push `feat/site-draft`. Staging redeploys in about two minutes. If the content is invalid, the
   deploy fails and the previous version stays up.

Git keeps the dated history of every change, which the monthly report can draw on later.

## Rules that apply everywhere

- **Placeholders:** text in square brackets, like `[OWNER NAME]`, shows as a muted placeholder. A `null` or
  missing field shows as a placeholder too. Replace the brackets with real text when you have it.
- **Draft flags:** `"draft": true` and `"note": "…"` mark a record as awaiting your edit. They appear only on
  your Draft flags page (the banner link when you use your owner link). Delete them when a record is settled.
- **Tags drive everything:** `domains` (domain slugs from `domains.json`) and `forms` (ids from `enums.json`).
  Domain pages and Related panels are computed from them; nothing is listed by hand.
- **Fixed vocabularies** (forms, stages, statuses, evidence levels, source kinds) are in `enums.json`. Use the
  `id`, not the label.
- **Slugs** are the record's address (`/initiatives/<slug>`): lowercase words joined by hyphens. Changing a slug
  breaks old links, so settle them early.

## Each kind of record

| To change… | Edit | Notes |
|---|---|---|
| A domain's need, analysis, side panel | `domains.json` | `analysis` has the four parts. `analysisStatus`: `drafted` or `to-write`. Optional `needFull`, `lastRevised`, `inTheBook`, `neighbouringDomains` |
| A structure | `domains.json`, inside its domain's `structures` | `status`: `exists` / `partial` / `needed` / `speculative`. `forms` is a list. `captureRisk` is text |
| A question | `questions.json` | `domains` list. Answer fields: `whatWeThinkSoFar`, `whatWeDontKnow`, `whatWouldChangeOurMind` (missing = placeholder). Optional `status` (evidence level id) and `sources` (citation keys) |
| A vital sign | `vital-signs.json` | `reading` stays `null` until there is a real reading. `status`: `in-development` / `live` / `live-elsewhere`. Optional `method`, `sources`, `externalUrl` |
| An initiative | `initiatives.json` | `whose`: `ours` / `watching`. `stage`: one of the six stage ids. `statusLog`: list of `{ "date", "entry" }`, newest first |
| A reference and its claims | `references.json` | Evidence status sits on each claim (`claims[].status`: `established` / `extension` / `speculation`), not on the source. `howRead`: `In full` or `Summary only` |
| Home copy | `home.json` | Verbatim from the brief. Each evidence card's `cite` is a citation key |
| Learn page text | `learn.json` | Add videos and podcast episodes to `media` as `{ "title", "url", "transcript" }` |
| About, Ask, Report, Book, Join, Licence | `pages.json` | |

## Citations

A citation key is a reference slug, such as `ostrom-1990`, when the reference has a single claim. When it has
several, add `#<claim id>`: claims are numbered `1`, `2`, … in order, or give a claim an explicit `"id"`. Put
keys in a question's or sign's `sources`, or in a Home evidence card's `cite`. The References page then lists
that page under "Cited on" automatically.

## Reviewer links (not content, but you'll need them)

- **Make a link:** `railway run --environment staging --service abundanceArchitecture npm run review:link -- --name "Full Name" --email person@example.com`
  (add `--owner` for your own).
- **Revoke one:** add the reviewer's email to the staging variable `REVIEW_REVOKED` (comma-separated).
- **Revoke every link:** change `REVIEW_LINK_SECRET`.
- **Comments:** reviewers' "Comment on this page" messages arrive by email as `[AA Review] <page> — <name>`.
  Reply-To is the reviewer.
