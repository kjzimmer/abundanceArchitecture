# Email + Newsletter — WIP Spec
*Authoritative spec while in flight. Branch: `feature/email-newsletter` (PR A), then follow-on branches for PR B / PR C.*
*Started: 2026-09-24*

---

## Goal

Give AbundanceArchitecture.world first-class email:

1. Send from `@abundancearchitecture.world` (acknowledgements, replies, newsletter) with every send recorded in Postgres
2. Receive mail at `hello@abundancearchitecture.world` into the admin panel, and reply from there
3. Compose, send, and track a Markdown-authored newsletter, with replies grouped per issue

Built as reusable modules so FreeMarketWatch.world and HealthUnveiled.world can adopt them.
**Porting guide:** `docs/wip/email-porting-guide.md`. Site identity lives in `server/src/lib/brand.ts`.
Planned layout (Karl, 2026-09-25): the AA family (AA, HU, FMW) in one Railway project with a **shared DB**
and one Resend account. myGalleryWorks stays separate. See the porting guide → Shared database implications.

---

## Decisions (confirmed with Karl 2026-09-24)

| Topic | Decision |
|-------|----------|
| Sending | Resend, root domain `abundancearchitecture.world` verified. API key `aa-app`, Sending access, domain-scoped |
| Receiving | Cloudflare Email Routing → Email Worker. Not Resend Inbound (subdomain-only on a domain with existing MX; payload is metadata-only) |
| Replying | From the admin panel only (via Resend). Gmail "send mail as" not used |
| Subscribe | Double opt-in. Existing subscribers grandfathered as confirmed |
| Newsletter authoring | Markdown + live preview. Visual editor possibly later |
| Newsletter replies | Private, grouped by issue in admin. Public discussion deferred |
| Delivery order | PR A (foundation) → **PR C (newsletter)** → PR B (inbound + general email). Order changed by Karl 2026-09-29 |
| Identity | One account per person across AA-family sites; newsletter choices per list (see porting guide) |
| General email | PR B grows into basic email in admin: inbox, reply, **compose new threads** to anyone (Karl, 2026-09-29) |
| Subscriber list | Owned in Postgres; Resend Audiences/Broadcasts not used |

---

## Infrastructure (done 2026-09-24)

| Item | State |
|------|-------|
| Cloudflare Email Routing | Enabled. MX `route1/2/3.mx.cloudflare.net`, SPF `v=spf1 include:_spf.mx.cloudflare.net ~all` on root |
| Routing rules | Catch-all → Karl's EE inbox (plain forward; becomes Worker in PR B) |
| Resend domain | Verified via Domain Connect: CNAME `send` → `send.forge.rmta.net`, CNAME `rsend` → `rsend.forge.rmta.net`, TXT `resend._domainkey` (DKIM). Region us-east-1 |
| Resend tracking | Click tracking off, open tracking off |
| DMARC | `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:dmarc@abundancearchitecture.world` (reports arrive via catch-all) |
| Verified | Resend → EE inbox delivered; Resend → `test@` → Cloudflare → EE round-trip delivered |

**Later:** after ~2–4 weeks of clean DMARC reports, tighten to `p=quarantine`.

---

## Free-Tier Constraints (Resend, verified 2026-09-24)

- 3,000 emails/month, **100/day**, 3 domains, 30-day log retention
- Daily cap is shared by *all* sends (acks, replies, newsletter). The send queue must
  reserve headroom so transactional mail is never starved by a newsletter (see PR C)

---

## PR A — Email Foundation

### Scope

1. `EmailService` — single entry point for all outbound mail (wraps Resend SDK)
2. `OutboundEmail` log — every send recorded with Resend ID and status
3. Resend webhook → status updates + automatic suppression on bounce/complaint
4. Subscribe → double opt-in confirmation email; confirm + unsubscribe flows
5. Contact → acknowledgement email to sender + notification email to admin
   (replaces `NOTIFICATION_EMAIL_ENDPOINT`)
6. Cloudflare Turnstile on subscribe + contact
7. Dev safety: no real sends from local unless explicitly enabled

### Data Model

```prisma
model NewsletterSubscriber {
  // existing: id, personId, active, sourceSite, subscribedAt
  token          String    @unique            // random 32-byte hex; used in confirm + unsubscribe links
  confirmedAt    DateTime? @map("confirmed_at") // null = pending confirmation
  unsubscribedAt DateTime? @map("unsubscribed_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
}
```

- **Migration backfill:** existing rows get `token` generated in SQL and
  `confirmed_at = subscribed_at` (grandfathered)
- **Mailable** = `active && confirmedAt != null` and email not suppressed
- Re-subscribing after unsubscribe → `active = true`, `confirmedAt = null`, new confirmation sent

```prisma
enum EmailKind   { SUBSCRIBE_CONFIRM CONTACT_ACK ADMIN_NOTIFY REPLY NEWSLETTER NEWSLETTER_TEST }
enum EmailStatus { QUEUED SENT DELIVERED DELAYED BOUNCED COMPLAINED FAILED SUPPRESSED }

model OutboundEmail {
  id                String      @id @default(cuid())
  personId          String?     @map("person_id")        // fk → person, set null on delete
  toEmail           String      @map("to_email")          // denormalized
  fromEmail         String      @map("from_email")
  subject           String
  kind              EmailKind
  status            EmailStatus @default(QUEUED)
  resendId          String?     @unique @map("resend_id")
  error             String?
  newsletterIssueId String?     @map("newsletter_issue_id") // PR C
  conversationId    String?     @map("conversation_id")     // PR B
  sentAt            DateTime?   @map("sent_at")
  createdAt         DateTime    @default(now()) @map("created_at")
  updatedAt         DateTime    @updatedAt @map("updated_at")
  @@index([status, createdAt])
  @@map("outbound_email")
}

model EmailEvent {                     // raw Resend webhook log — audit + learning
  id        String   @id @default(cuid())
  svixId    String   @unique @map("svix_id")   // idempotency
  type      String                              // email.delivered, email.bounced, ...
  resendId  String?  @map("resend_id")
  payload   Json
  createdAt DateTime @default(now()) @map("created_at")
  @@map("email_event")
}

model EmailSuppression {
  id        String   @id @default(cuid())
  email     String   @unique                    // lowercased
  reason    String                               // bounce | complaint | manual
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  @@map("email_suppression")
}
```

Bodies of templated system emails are not stored (reproducible from template + kind).
Reply and newsletter bodies live on their own records (PR B / PR C).

### Routes

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/subscribe` | Public, rate limited | Now creates pending subscriber + sends confirmation |
| POST | `/api/contact` | Public, rate limited | Now sends ack + admin notification |
| GET | `/confirm?t=` | Public | Page with "Confirm subscription" button (GET never mutates — link scanners prefetch) |
| POST | `/confirm` | Public, linkLimiter | HTML form post (`t` urlencoded) → sets `confirmedAt`, renders result page |
| GET | `/unsubscribe?t=` | Public | Page with "Unsubscribe" button |
| POST | `/unsubscribe` | Public, linkLimiter | Form post, and RFC 8058 one-click target (`?t=` in query, body `List-Unsubscribe=One-Click`) |
| POST | `/api/webhooks/resend` | Svix signature | Must receive **raw body** — mounted before `express.json()` |
| GET | `/api/public-config` | Public | `{ turnstileSiteKey }` for `main.js` |
| GET | `/api/email/outbound` | Admin | Sent-mail log (cursor-paginated) |
| GET/DELETE | `/api/email/suppressions` | Admin | View / remove suppressions |
| GET | `/api/email/status` | Admin | `{ mode, notifyTo }` |
| POST | `/api/email/test` | Admin | Sends `[AA Test]` notice to `ADMIN_NOTIFY_EMAIL` |

`/confirm` and `/unsubscribe` are small server-rendered HTML pages (`server/src/lib/publicPage.ts`)
using the teaser's real tokens (ink masthead, paper background, green accent, EB Garamond + Inter).
They are new pages; `public/index.html` is not touched.

### Email Templates

- `server/src/lib/email/templates/` — typed functions returning `{ subject, html, text }`
- Shared layout: table-based HTML, inline styles, max-width 600px
- Design: mirrors `public/index.html` `:root` tokens: ink `#1a1917` masthead with paper-colored
  uppercase Inter wordmark, paper `#eeeae0` background, `#f7f5f0` content card, green `#2d4a2d`
  buttons and links, EB Garamond headings/body (Georgia fallback). Note: `docs/SITE_DESIGN.md`
  lists navy/gold tokens that don't match the actual page, logged in SHARED_FEEDBACK
- Preview all templates for real: `EMAIL_MODE=redirect EMAIL_REDIRECT_TO=you@… npx tsx --env-file ../.env src/scripts/preview-emails.ts` (from `server/`)
- Every email has a plain-text part
- Contact ack **does not echo** the submitted message (prevents using the form to relay spam)

### Webhook Handling

Resend events → `EmailEvent` (dedupe on `svix-id`) → update `OutboundEmail.status` by `resendId`.
- `email.bounced` (hard) → add `EmailSuppression(reason=bounce)`
- `email.complained` → add `EmailSuppression(reason=complaint)` + set subscriber `active=false`
- `EmailService.send()` checks suppression first → records `SUPPRESSED`, does not call Resend

Webhook endpoint + signing secret configured in Resend dashboard (manual step).

### Dev Safety

- `EMAIL_MODE=live | log | redirect` — `log` (default when unset) prints to console and
  records `OutboundEmail` with status `SENT` and no `resendId`; `redirect` sends real mail but
  replaces every recipient with `EMAIL_REDIRECT_TO`
- Production sets `EMAIL_MODE=live`

### Environment Variables (add to `.env.example`)

```env
RESEND_API_KEY=            # Resend "aa-app" key — Sending access, domain-scoped
RESEND_WEBHOOK_SECRET=     # Resend dashboard → Webhooks → signing secret (whsec_...)
EMAIL_FROM=                # Abundance Architecture <hello@abundancearchitecture.world>
EMAIL_MODE=                # live | log | redirect  (default: log)
EMAIL_REDIRECT_TO=         # required when EMAIL_MODE=redirect
ADMIN_NOTIFY_EMAIL=        # where contact-form notifications go
PUBLIC_BASE_URL=           # https://abundancearchitecture.world — used in email links
TURNSTILE_SITE_KEY=        # Cloudflare Turnstile — public, served to main.js
TURNSTILE_SECRET_KEY=
```

`NOTIFICATION_EMAIL_ENDPOINT` removed.

### New Dependencies (server)

`resend` (its `webhooks.verify()` handles Svix signature checks, so no separate `svix` package).
PR C adds `marked`, `node-cron`.

### Throttles

- Subscribe confirmation: max 1 per address per hour (skipped on resubscribe, since the token rotated and
  resubscribe is only reachable after the owner used their private unsubscribe link)
- Contact ack: max 1 per address per hour
- Confirm/unsubscribe POSTs: `linkLimiter` 30 / 15 min / IP

### Admin UI (PR A)

- **Email** nav item (after Inbox): Sent log table (to, subject, kind, status, date) + Suppressions tab
- **People** detail: show subscriber status (pending / confirmed / unsubscribed) and sent emails

---

## PR B — split into B1 (conversations) and B2 (inbound), designed 2026-09-30

### B1 — Conversations in admin (help-desk pattern)

**Model**
```prisma
enum ConversationStatus  { OPEN WAITING CLOSED }
enum ConversationChannel { CONTACT_FORM EMAIL NEWSLETTER_REPLY COMPOSED }
enum MessageDirection    { INBOUND OUTBOUND }
model Conversation { sourceSite, personId?, subject, status, channel, unread, newsletterIssueId?,
                     lastMessageAt, messages[] }
model Message      { conversationId, direction, fromEmail, fromName?, toEmail, subject, text, html?,
                     messageIdHeader? (RFC Message-ID), inReplyTo?, references?, outboundEmailId? (→ status),
                     attachments Json?, meta Json? (e.g. contact-form phone) }
OutboundEmail.conversationId gets a real relation.
```
- **Migration:** every `ContactMessage` becomes a CONTACT_FORM conversation with one inbound message
  (unread mirrors `read`). `ContactMessage` stays as a read-only legacy table, to be dropped in a later cleanup PR
- **Statuses:** new inbound → OPEN + unread. Admin reply → WAITING, or CLOSED with "Send & close". Inbound
  reply → OPEN again. Manual Close / Reopen
- **Reply email:** plain personal-email look (not the newsletter layout), From `EMAIL_FROM` (hello@),
  `Reply-To: reply+c-<conversationId>@<domain>`, `In-Reply-To`/`References` to the last inbound message,
  subject `Re: …`, a signature from **Settings → Inbox → Signature**, and the previous message quoted below.
  Resend's delivery webhook fills in our outbound `Message-ID` (from `data.message_id`) for header matching in B2
- **Compose:** to (email + optional name) → upserts Person → COMPOSED conversation (WAITING after send)
- **Admin Inbox:** three panes (list | thread | person sidebar). Tabs Open · Waiting · Closed · All,
  newest activity first. Search (Postgres full-text over subject + bodies, plus sender name/email). The nav badge
  shows the Open count
- **Person sidebar:** name, email, phone, tags, notes, newsletter status and lists, other conversations
- **People detail:** "Conversations" replaces the old "Messages"
- **Until B2:** replies to our emails reach Karl's EE inbox via the catch-all (not threaded in admin yet)

### B2 — Inbound (outline)

### Cloudflare Email Worker (`worker/`)

- Separate package in repo: `worker/package.json`, `wrangler.toml`, `src/index.ts` (TypeScript)
- Bound to the **catch-all** rule. For every message:
  1. `message.forward(<EE +aa-raw plus-address>)`: always, and first (raw backup; see Admin Notifications)
  2. If recipient is `hello@` or `reply+*@`: parse with `postal-mime`, POST JSON to
     `/api/inbound-email` with HMAC-SHA256 signature + timestamp header (`INBOUND_WEBHOOK_SECRET`)
  3. Other addresses (e.g. `dmarc@`): forward only
- Deployed with `wrangler deploy` from local (manual); secrets via `wrangler secret put`
- v1 attachments: metadata only (name, type, size). Content remains in the EE copy

### Conversations

- New `Conversation` + `Message` models. Contact-form submissions and inbound email both
  become conversations; existing `ContactMessage` rows migrated in
- Threading: outbound replies set `Reply-To: reply+c-<conversationId>@abundancearchitecture.world`;
  fallback match on `In-Reply-To` / `References`, then sender + subject
- Admin Inbox becomes a conversation list → thread view → reply composer (sends `REPLY` via `EmailService`)
- **Compose new:** start a thread to any address (or pick a Person) from admin. Creates a Conversation with an
  outbound first Message, and replies thread back via `reply+c-<id>@`. This makes admin a basic email client
  for `hello@`

---

## PR C — Newsletter (designed 2026-09-29)

### Data model

```prisma
model NewsletterList {            // one per newsletter: 'aa' now; HU/FMW/digest later
  key, name, description?, siteKey
  subscriptions ListSubscription[], issues NewsletterIssue[]
}
model ListSubscription {          // a person's choice for one list
  personId, listId  @@unique([personId, listId])
  active, confirmedAt?            // confirmedAt null = awaiting the confirm click
  subscribedAt, unsubscribedAt?, unsubscribedIssueId?   // which issue's link they used
}
enum IssueStatus { DRAFT SENDING SENT }
model NewsletterIssue {
  listId, subject, preheader?, markdown, status, recipientCount,
  sendStartedAt?, sentAt?         // sentAt = queue fully drained
}
OutboundEmail += sourceSite (from brand.siteKey), relation to NewsletterIssue
```

**Migration:** creates the `aa` list and gives every existing subscriber a ListSubscription mirroring
their current state (grandfathered confirmed subscribers stay confirmed). Backfills `OutboundEmail.source_site`.

### Consent rules

- **Mailable for list L** = `NewsletterSubscriber.active && confirmedAt` (verified email, not stopped-all)
  AND `ListSubscription(L).active && confirmedAt` AND address not suppressed
- Home-page subscribe → upserts the site's default list (`brand.defaultListKey`). New or reactivated list
  rows start **unconfirmed**. One confirmation email covers the email address and pending lists, so a bot
  can never (re)add someone without the owner's click
- `/confirm` confirms the address and all pending list rows
- Issue footer links: **Unsubscribe from this list** (`/unsubscribe?t=&l=&i=`, also the RFC 8058 one-click
  target) and **Manage preferences** (`/preferences?t=`). Plain `/unsubscribe?t=` without `l` = stop all
- `/preferences?t=` lists every NewsletterList with checkboxes plus "unsubscribe from everything".
  Holding the token proves ownership, so lists ticked there are confirmed immediately

### Authoring and sending

- Markdown (`marked` v15; v16+ is ESM-only and won't load under CJS on local Node 20.12), rendered into the
  brand email layout with inline styles. Plain-text part derived from the markdown
- Admin → **Newsletter**: issue list with stats → editor (list, subject, preheader, markdown | live preview
  iframe) → **Save**, **Send test** (to `ADMIN_NOTIFY_EMAIL`, kind `NEWSLETTER_TEST`), **Send to N subscribers**
- Send: validates, then creates one QUEUED `OutboundEmail` per mailable person, status `SENDING`
- **Queue** (`server/src/jobs/newsletterQueue.ts`, `node-cron` every minute + an immediate kick): re-checks
  mailability at send time, batches up to 100 through Resend's batch API. Budget = `EMAIL_DAILY_LIMIT`
  (100) − `EMAIL_TRANSACTIONAL_RESERVE` (20) − sends in the last 24h, so acknowledgements are never starved.
  Leftovers go on the next run. When drained: `SENT` + `[AA Newsletter]` notice with counts
- Per-recipient headers: `List-Unsubscribe`, `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
  `Reply-To: reply+n-<issueId>@<domain>`. Until PR B, replies reach Karl through the catch-all
- **CAN-SPAM:** footer includes `NEWSLETTER_POSTAL_ADDRESS`. **Live sends are blocked until it's set**
  (tests are allowed). **Karl to choose the address** (PO box / mailbox service is fine)
- History: recipients, sent, delivered, bounced, complained, unsubscribed via this issue
- **First issue:** "You're on the list — stay tuned" to grandfathered subscribers

### Deferred

- Public web archive / "view in browser", scheduled sends, per-list sign-up checkboxes on other sites' forms,
  replies grouped under issues (needs PR B), visual editor

---

## Admin Notifications

All notifications go to `ADMIN_NOTIFY_EMAIL` (Karl's EE inbox). Each type has a fixed
subject prefix, so Gmail filters can label them automatically (filter: `subject:"AA Inquiry"`, etc.).

| Prefix | Trigger | PR |
|--------|---------|----|
| `[AA Inquiry]` | Contact form submitted — `[AA Inquiry] {subject} — {name}` | A |
| `[AA Subscriber]` | Subscription **confirmed** (not on pending, to avoid bot noise) | A |
| `[AA Unsubscribe]` | Subscriber unsubscribed | A |
| `[AA Deliverability]` | Bounce or spam complaint recorded | A |
| `[AA Email]` | Inbound mail to `hello@` — `[AA Email] {subject} — {from}` | B |
| `[AA Newsletter Reply]` | Reply to an issue — `[AA Newsletter Reply] {issue} — {from}` | B/C |
| `[AA Newsletter]` | Issue finished sending — counts summary | C |

- Notifications use kind `ADMIN_NOTIFY`. They are sent through `EmailService` and logged like any other send
- Body: short summary plus a link to the item in `/admin`. For inquiries and inbound mail
  the body includes the message text, since it goes only to Karl
- **Raw inbound copies (PR B):** the Worker's backup forward goes to a plus-address
  (`ADMIN_NOTIFY_EMAIL` with a `+aa-raw` suffix) so it can be filtered or archived separately
  from the labeled notifications and never looks like a duplicate. Requires verifying that
  plus-address as a Cloudflare destination

## Resolved Questions (2026-09-24)

1. **Turnstile:** yes. Injected from `public/js/main.js` in managed/invisible mode, with no `index.html` markup change
2. **Subscribe success text:** change to "Check your inbox to confirm" (in `main.js`)
3. **Email design:** navy header band with gold wordmark, light body
4. **Notification address:** Karl's EE inbox, using the typed subject prefixes above

---

## Docs to Update After Ship (read-only — logged in SHARED_FEEDBACK)

- `docs/ARCHITECTURE.md` — new models, routes, flows, env vars; remove `NOTIFICATION_EMAIL_ENDPOINT`
- `docs/TECH_STACK.md` — `worker/` package (deviation from repo structure), new deps
- `shared/SHARED_ADMIN_MODULES.md` — candidate Email + Newsletter modules
- `shared/SHARED_TECH_STACK.md` — Cloudflare Email Workers; "email capture service" decision made

---

## Follow-ups (outside this feature)

Found during PR A production testing (2026-09-24). Shipped in PR #12 and the rate-limit PR, except the
Cloudflare setting (Karl):

- **Rate limiting per visitor:** measured, then keyed on Railway's `X-Real-IP` instead of `trust proxy`.
  See `server/src/lib/clientIp.ts` and CLAUDE.md → Resolved
- **Log missing Turnstile token:** `verifyTurnstile` returns false silently on an empty token. Add
  `[turnstile] missing token` so stale-script and blocked-widget cases show up in logs
- **Log successful sends:** live mode only logs failures. Add one line per send (kind, masked recipient, resendId)
- **Clear `aa_subscribed` on unsubscribe:** the unsubscribe result page should run
  `localStorage.removeItem('aa_subscribed')` (same origin) so the home-page form re-enables for resubscribing
- **Cloudflare Browser Cache TTL:** Karl to set "Respect Existing Headers". The default 4h override kept
  the old `main.js` in browsers after deploy (subscribe 403s until the cache expired)
- **Admin notices from `notify@`** (`EMAIL_NOTIFY_FROM`) with **Reply-To** set to the person the notice is
  about (inquirer or subscriber; none for Deliverability). HTML layout kept (Karl, 2026-09-25). Context: the
  first `[AA Inquiry]`/`[AA Unsubscribe]` notices went to EE spam ("similar to messages identified as spam"),
  which is new-domain reputation, not an auth failure. Later notices and a Gmail-subscriber test landed fine.
  Karl adds a Gmail "never spam" filter for the domain
- **Proxy measurement (2026-09-25):** the temporary `GET /api/debug/request-ip` shipped in #12. Results:
  via Cloudflare, XFF = `<cloudflare ip>, <railway edge>` and X-Real-IP = visitor. Direct to Railway,
  XFF = `<visitor>, <railway edge>` and X-Real-IP = visitor. Spoofed XFF / X-Real-IP / CF-Connecting-IP were
  overwritten or rejected (Cloudflare error 1000). Endpoint removed in the rate-limit PR

## Status

- [x] Infrastructure (Cloudflare routing, Resend domain, DMARC, API key)
- [x] PR A — Email foundation: merged as PR #11, deployed 2026-09-24
  - [x] Cloudflare Turnstile widget created, keys in Railway (verified: tokenless POST → 403)
  - [x] Railway env set; `NOTIFICATION_EMAIL_ENDPOINT` removed
  - [x] Resend webhook configured (verified: webhook POSTs return 200, sent + delivered per email)
  - [x] Prod: subscribe → confirmation email → confirm → `[AA Subscriber]` notice; admin shows subscriber
  - [x] Prod: unsubscribe via tokened link works; resubscribe works (after clearing `aa_subscribed`)
  - [x] Prod: contact → ack received; inquiry in admin Inbox; notice delivered per webhook logs
  - [x] `[AA Inquiry]` notice arrived in EE (first one in Spam; see notify@ follow-up)
  - [x] Admin → Email → "Send test email" works (Karl, 2026-09-25)
  - [x] Admin → People: grandfathered subscribers show as confirmed; new signup shows pending (Karl, 2026-09-25)
- [x] Follow-up PRs: #12 (notify@, Reply-To, logging, resubscribe) + #13 (rate-limit client IP) + #14 (brand.ts)
- [x] PR C — Newsletter: merged #15 (+ #16 unsubscribe confirmation, #17 Settings). Before the first issue:
  - [ ] Karl: enter postal address in Admin → Settings → Newsletter
  - [ ] Prod: send test issue to self, check layout + `List-Unsubscribe` in Gmail "Show original"
  - [ ] Prod: send first issue ("You're on the list") to grandfathered subscribers
- [ ] PR B1 — Conversations inbox (reply, compose, search, statuses): code complete + locally tested 2026-09-30
- [ ] PR B2 — Inbound Worker (receive hello@ + replies into threads)

### Production testing notes (2026-09-24)

- Stale-script 403s: Cloudflare's 4h browser cache override kept old `main.js` after deploy. Fix is in Follow-ups
- To test the unsubscribe page, use the tokened link from the email (`/unsubscribe?t=…`). The page shown
  after confirming has no token in its URL
- `aa_subscribed` in localStorage disables the home-page form after subscribing (private window or
  DevTools to reset). Fix is in Follow-ups
- Replies to acknowledgements currently go to `hello@` → EE via catch-all, not linked in the app.
  PR B links them via `reply+c-<id>@` Reply-To and In-Reply-To. Pre-PR-B sends can be matched using
  `message_id` saved in `email_event.payload`

### Unsubscribe confirmation (Karl, 2026-09-30)

After any unsubscribe (list link, one-click, stop-all, or unticking on /preferences) the subscriber gets a
one-time `UNSUBSCRIBE_CONFIRM` email at their own address with a "Review my subscriptions" button
(→ /preferences). Purpose: if a forwarded newsletter's link was used by someone else, the owner finds out and
can undo it. Rules: transactional only (CAN-SPAM allows a single opt-out confirmation), max 1 per address per
10 min, never sent for complaint/bounce deactivations, and suppressed addresses are skipped by EmailService.

### Admin Settings + nav (Karl, 2026-09-30)

- **Settings** page (`Setting` table, registry in `server/src/lib/settings.ts`). First setting:
  `newsletter.postalAddress`, which replaces the `NEWSLETTER_POSTAL_ADDRESS` env var (still honored as a fallback).
  The queue pauses (it doesn't send non-compliant footers) if the address is cleared mid-send
- Nav: **Analytics** (renamed from Dashboard) · People · Inbox · Newsletter · **Settings**. The old Email page is
  now Settings → Email delivery. PR B turns Inbox into help-desk-style conversations
- People: client-side search (name, email, phone, notes, tags). Conversation search comes with PR B
  (Postgres full-text)
- Security fix: people API no longer returns `passwordHash` / `totpSecret`

### PR B design direction (Karl, 2026-09-30)

Shared-inbox / help-desk pattern (Help Scout, Front, Zendesk): three panes (conversation list | thread | person
sidebar from People). Statuses **Open** (needs you) · **Waiting** (you replied) · **Closed**. The list defaults to
Open, sorted by latest activity. Inbound → Open; your reply → Waiting (or "Send & close"); their reply reopens.
Everything is a conversation: contact form, hello@, newsletter replies, and **Compose** new threads. Full-text
search over subject, bodies and participants.
