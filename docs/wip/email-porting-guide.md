# Email + Newsletter — Porting Guide
*How to bring AA's email and newsletter modules to another site (HealthUnveiled, FreeMarketWatch,
myGalleryWorks, future sites). AA is the reference implementation. Kept current as PR B / PR C ship.*
*Started: 2026-09-25. Feature spec: `docs/wip/email-newsletter.md`.*

---

## Strategy

1. **AA is the reference.** Build and prod-test everything here first
2. **Port by copying** to the second site (likely HealthUnveiled) using this guide. The copy shows which
   parts genuinely vary between sites
3. **Then extract** a shared package (private GitHub package or git dependency), per SHARED_TECH_STACK's
   "extract at 3+ sites" rule

Site-specific values live in **one file**, `server/src/lib/brand.ts`, plus env vars. If you find yourself
editing anything else to rebrand, that's a gap: move it into `brand.ts` and update this guide.

---

## Account / Project Layout (Karl, 2026-09-25)

| Group | Railway | Resend | Notes |
|-------|---------|--------|-------|
| AA family: AA, HealthUnveiled, FreeMarketWatch | **One Railway project**, one service per site | **One dedicated Resend account**, one domain per site | Plan: **shared database** for a single membership / tiered access across sites |
| myGalleryWorks | Separate project (Enterprise Edge) | Separate Resend account | Independent |

Resend free plan = 3 domains, 100/day, 3,000/month. The AA family fits 3 domains; move to **Pro ($20/mo,
10 domains, no daily cap)** when volume or a 4th domain requires it.

### Shared database implications (open, decide before porting)

- `NewsletterSubscriber.personId` is `@unique`, so one subscription per person. With a shared DB, a person
  subscribing to several sites needs **one row per (person, site)**. Also, confirm/unsubscribe tokens
  should be per subscription (already true)
- `OutboundEmail` should record which site sent it (a `sourceSite` column)
- `EmailSuppression` stays **global** (per address). A hard bounce is a property of the address, not the site
- **Migrations:** several services running `prisma migrate deploy` with separate histories against one DB
  will conflict. One service (or a shared schema package) must own the schema and migrations
- Membership and tier design is a separate feature. The email tables should just not block it

---

## Infrastructure Runbook (per domain)

Done for AA 2026-09-24/25. Repeat per site, in this order:

1. **Cloudflare Email Routing:** domain → Email → Email Routing → Onboard domain. Accept the auto-added
   MX (`route1/2/3.mx.cloudflare.net`) and SPF TXT on the root. Verify the destination address (the admin inbox)
   - Catch-all → destination for now. PR B changes it to the Worker
   - Test: email `hello@<domain>` **from a different account** (Gmail hides messages you sent yourself)
2. **Resend domain:** add the **root** domain (not `mail.` — the verified domain decides which addresses can
   send). Use the **Sign in to Cloudflare** (Domain Connect) option. It adds CNAME `send`, CNAME `rsend`, and
   TXT `resend._domainkey`, and touches nothing on the root. Turn **click and open tracking off**
3. **DMARC:** DNS → add TXT `_dmarc` = `v=DMARC1; p=none; rua=mailto:dmarc@<domain>`. After 2–4 weeks of
   clean reports, move to `p=quarantine`
4. **Resend API key:** Sending access, scoped to the domain. Name it `<code>-app`
5. **Turnstile:** Cloudflare → Turnstile → Add widget manually. Hostname = domain (+ `localhost` optional),
   mode **Managed**, pre-clearance off. **Set both keys, or neither**: a secret with no site key rejects every form
6. **Resend webhook:** endpoint `https://<domain>/api/webhooks/resend`, all `email.*` events → signing secret
7. **Cloudflare caching:** Caching → Configuration → Browser Cache TTL → **Respect Existing Headers**.
   Otherwise browsers keep the old `public/js/main.js` for 4h after deploys
8. **Gmail (admin inbox):** filter `from:(@<domain>)` → Never send to Spam, plus labels by `subject:"<CODE> Inquiry"` etc.
   New domains land in spam at first ("similar to messages identified as spam" = reputation, not auth)

Verify DNS from anywhere: `curl -s "https://dns.google/resolve?name=<name>&type=<TYPE>"`.

---

## Code to Copy (as of PR A + follow-ups)

| Path | Notes |
|------|-------|
| `server/src/lib/brand.ts` | **Edit per site**: siteKey, name, code, domain, tagline, senders, colors, fonts, storage key |
| `server/src/lib/email/` | `config.ts`, `layout.ts`, `templates.ts`: brand-driven, copy as-is |
| `server/src/lib/publicPage.ts` | Confirm/unsubscribe page shell, brand-driven |
| `server/src/lib/turnstile.ts` | As-is |
| `server/src/lib/clientIp.ts` | As-is on Railway (reads `X-Real-IP`). **Needed even without email**: fixes per-visitor rate limiting |
| `server/src/services/EmailService.ts`, `EmailWebhookService.ts` | As-is |
| `server/src/services/SubscriberService.ts`, `ContactService.ts` | Merge with the site's existing versions |
| `server/src/routes/subscription.ts`, `webhooks.ts`, `email.ts` | As-is. Contact/subscribe routes: add the Turnstile check |
| `server/src/index.ts` | Webhook route **before** `express.json()`; limiters with `clientIp`; `/api/public-config`; urlencoded for `/confirm` + `/unsubscribe` |
| `server/src/scripts/preview-emails.ts` | Dev tool: real previews via `EMAIL_MODE=redirect` |
| `prisma/schema.prisma` | `NewsletterSubscriber` additions, `OutboundEmail`, `EmailEvent`, `EmailSuppression`, enums |
| `prisma/migrations/*_email_foundation` | Adapt: includes the grandfathering backfill for existing subscribers |
| `public/js/main.js` | Turnstile injection + "check your inbox". Storage key must match `brand.subscribedStorageKey` |
| `client/src/components/AdminEmail.tsx` + nav entry | Admin Email page |

Server dependency: `resend` (its `webhooks.verify()` covers Svix, so no `svix` package).

## Env Vars

See `.env.example` (Email + Turnstile sections): `EMAIL_MODE=live`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`,
`EMAIL_FROM`, `EMAIL_NOTIFY_FROM`, `ADMIN_NOTIFY_EMAIL`, `PUBLIC_BASE_URL`, `TURNSTILE_SITE_KEY`,
`TURNSTILE_SECRET_KEY`. **Set them before the first deploy with this code**: without `EMAIL_MODE=live`
the site runs in log mode and confirmations never send.

## Production Test Checklist

1. `/api/public-config` returns the site key. A tokenless `POST /api/subscribe` → 403
2. Subscribe (private window) → confirmation email → Confirm → `[CODE Subscriber]` notice
3. Tokened `/unsubscribe?t=…` → Unsubscribe → `[CODE Unsubscribe]` notice → resubscribe works
4. Contact form → acknowledgement + `[CODE Inquiry]` (Reply-To = sender)
5. Admin → Email → Send test email. Rows move `sent` → `delivered` (webhook working)
6. Admin → People: existing subscribers confirmed, new signups pending
7. Railway logs: no `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`

## Gotchas Found on AA

- **Prisma client location:** `prisma generate` auto-installs `@prisma/client` at the repo root and edits root
  package.json. A stale `server/node_modules/.prisma` placeholder makes types `any`. See SHARED_FEEDBACK
- **Don't use `trust proxy` for rate limiting on Cloudflare → Railway**: X-Forwarded-For holds Cloudflare's IP.
  Use `clientIp()` (X-Real-IP)
- **Page after confirming has no token in its URL.** Test unsubscribe from the emailed link
- **Test with non-admin addresses** (e.g. a personal Gmail) to judge real subscriber deliverability
