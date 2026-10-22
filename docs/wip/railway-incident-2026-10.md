# Railway security incident: credential rotation (Oct 2026)

## Resume here

*Updated end of 2026-10-22.* The most dangerous outside credentials are dealt with (Resend, Square, AA admin
locked). Karl stopped for the night. **Start the next session by:**

1. Confirming with Karl which of these he finished on the night of the 22nd: Cloudflare GalleryProvisioning +
   four analytics tokens deleted; R2 tokens (gallery bucket, `aa-files`) deleted; Anthropic keys `livingSystems`
   (…NgAA, Organization scope) and `myGalleryWorks` (…ewAA) deleted. Keep `claude_code_key_karl.zimmer_qjoy`
   (Claude Code's own key, never in Railway). The commons key Railway used (…zwAA) is not in his Console list even
   with Status = All: either already deleted or in another organization; it expires 2026-11-19 regardless.
2. Checking Railway: dashboard and builds back? Karl runs `railway login` himself (browser).
3. Then, in order: database public-networking check (decides whether personal data may have been exposed);
   gallery WAF rule if builds are still out; rotate internal secrets and create new provider keys; deploy;
   remove the AA WAF rule after `JWT_SECRET` is rotated; reissue reviewer links (Karl, Hans Prahl, Natalie);
   review the other sites (HU, FMW, cfeEstimator, Personal Finance).
4. Afterwards: the post-incident review (last section of this file), which Karl wants to do.

**What happened:** Railway disclosed on 2026-10-21 that customer environment variables were accessed and
decrypted. Its guidance: revoke all environment variables stored in Railway, review service logs for unusual
activity. Builds were paused platform-wide (so new values can't be deployed until builds return), Railway is
rotating its own bucket credentials, and OAuth sessions were ended (the Railway CLI here needs `railway login`).
Sources: status.railway.com (incident QH8L8B3E), Railway's notice on X.

**Assume every value below is known to an attacker.** Non-secret settings (URLs, email addresses, zone ids,
modes, limits) need no action.

## Affected services

| Project / service | Environments |
|---|---|
| Abundance Architecture / `abundanceArchitecture` + Postgres | production, staging |
| knowledgeCommons / `livingSystems` + Postgres | production |

## 1. Revoke now, even though the feature stops until builds return

Revoking at the provider stops misuse immediately. The running services keep the old value, so the feature
breaks until the new value can be deployed. Accept that.

| Secret | Where held | Risk if misused | Action (Karl, in the provider's dashboard) | Done |
|---|---|---|---|---|
| `RESEND_API_KEY` | AA prod + staging | Sends email as abundancearchitecture.world (phishing) | Resend → API keys: delete, create new. Check Resend logs for sends you didn't make | ☑ all keys deleted 2026-10-22 (all sites); new key still to create |
| `ANTHROPIC_API_KEY` | commons | Runs up model costs | Claude Console → API keys: delete "knowledge commons", create new (Default scope, longer expiry). Check usage for unexpected spend | ☐ |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | AA prod (+ staging?) | Read/replace private shared documents in `aa-files` | Cloudflare → R2 → Manage API tokens: delete, create new (Object R/W, `aa-files` only). Railway's own bucket rotation does **not** cover Cloudflare R2 | ☐ |
| `CF_ANALYTICS_TOKEN` | AA prod | Reads analytics (more if the token has wider permissions) | Cloudflare → API tokens: check its permissions, roll it | ☐ |

## 2. Protect the admin panel until JWT_SECRET can be rotated

`JWT_SECRET` signs admin access tokens. With it, someone could forge an admin session and reach the CRM, inbox
and email sending. Rotating it needs a redeploy, so until builds return:

- ☑ (2026-10-22) Cloudflare WAF custom rule on abundancearchitecture.world ("Lock admin during Railway incident"): block every
  admin path except from Karl's IP. Admin API paths are not under one prefix: `/admin`, `/api/auth`, `/api/people`,
  `/api/analytics`, `/api/email`, `/api/newsletter`, `/api/settings`, `/api/inbox`, `/api/docs`, `/api/groups`
  (public share pages and webhooks are elsewhere). Remove after JWT_SECRET is rotated.
- ☐ Remove the production service's public `*.up.railway.app` domain (Settings → Networking) so traffic can't
  bypass Cloudflare and the WAF rule.

## Gallery (`mdFineArt` repo, Melody De Benedictis Fine Art / myGalleryWorks)

Secrets its code uses: `JWT_SECRET`, `DATABASE_URL`, `RESEND_API_KEY` (deleted), `R2_*`, `CF_API_TOKEN` (deploys its
Cloudflare Worker), `CF_ANALYTICS_TOKEN`, `ANTHROPIC_API_KEY`, `SQUARE_APP_SECRET`, `SQUARE_SANDBOX_TOKEN`. The
database also stores the seller's Square access token (`square_access_token`).

- ☑ Square (2026-10-22): application secret replaced (production) and sandbox token replaced; API logs and
  webhooks empty; seller account (bank, transactions, team, devices) shows nothing unusual. Still open: if the
  gallery database had public networking, revoke the app in the seller's Square account and reconnect after
  rotation. New secret to set in Railway when builds return
- ☐ `CF_API_TOKEN`: roll it (Cloudflare → My Profile → API Tokens), check its permissions
- ☐ R2 token, Anthropic key, analytics token: revoke and reissue
- ☐ WAF rule on the gallery zone: admin API uses `Authorization: Bearer` (header only, no cookies), so block
  `any(starts_with(http.request.headers["authorization"][*], "Bearer")) and not ip.src in {…}`. Include Melody's
  IP if she uses the admin
- ☐ When builds return: rotate `JWT_SECRET` and the rest in a session in the `mdFineArt` repo

## Other Railway projects (same exposure, separate repos)

Health Unveiled, Free Market Watch, Melody De Benedictis Fine Art, cfeEstimator, Personal Finance: each needs its
provider keys revoked, its database checked, its internal secrets rotated when builds return, and (if it has an
admin panel) a WAF rule like the one above. Resend keys for all sites were deleted 2026-10-22.

## 3. Databases (personal data)

AA's Postgres holds subscribers, contact messages, the People CRM, conversations and bcrypt hashes of admin
passwords. The commons' Postgres holds reviewers' private Holon sessions and emails.

- ☐ In each Postgres service, check whether **public networking (TCP proxy)** is on (a `DATABASE_PUBLIC_URL`
  variable exists). If it is, the leaked password allowed direct access from the internet: treat the data as
  potentially exposed. Turn public networking off if nothing needs it (the apps use the private network).
- ☐ Rotate each database password once the dashboard and builds are back (Railway's Postgres credentials, then
  the services' `DATABASE_URL` references update).
- ☐ Review Postgres logs for connections from unknown addresses.
- ☐ Change the AA admin password after rotation (hashes may have been read if the database was reached).
- ☐ If the AA database may have been accessed, consider whether subscribers or contacts need to be told
  (depends on where they live and what was exposed; take advice if in doubt).

## 4. Rotate when builds return (changing the value is the fix)

New values are generated here and set with the CLI, never printed.

| Secret | Where | Also update | Effect | Done |
|---|---|---|---|---|
| `JWT_SECRET` | AA prod (+ staging) | | Admin must log in again; then remove the WAF rule | ☐ |
| `RESEND_WEBHOOK_SECRET` | AA prod (+ staging) | Resend → Webhooks: roll the signing secret | Stops forged delivery events (fake bounces/suppressions) | ☐ |
| `INBOUND_WEBHOOK_SECRET` | AA prod | Cloudflare Worker `aa-email-worker` (`wrangler secret put`), same moment | Stops forged inbound mail into the admin Inbox | ☐ |
| `TURNSTILE_SECRET_KEY` | AA prod + staging | Cloudflare → Turnstile "AA forms": rotate secret | Bot checks can't be bypassed | ☐ |
| `REVIEW_LINK_SECRET` | AA staging, commons | | **Revokes every reviewer link**: reissue for Karl, Hans Prahl, Natalie | ☐ |
| `SITE_KEYS` / `COMMONS_SITE_KEY` | commons / AA staging | | AA's key to the commons | ☐ |
| `DATABASE_URL` | all | | From section 3 | ☐ |
| New `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `R2_*`, `CF_ANALYTICS_TOKEN` | as above | | From section 1: features work again | ☐ |

## 5. Review

- ☐ Railway service logs (AA prod, AA staging, commons) for unusual requests, especially `/api/admin`,
  `/api/auth`, `/api/inbound-email`, `/api/webhooks/resend`, `/api/v1`.
- ☐ Admin panel: outbound email log, People, Inbox for anything you didn't do.
- ☐ GitHub (kjzimmer) → Settings → Security log and the Railway GitHub app's access, as a precaution (Railway has
  not said GitHub tokens were exposed).

## Cloudflare API tokens (Karl's profile, reviewed 2026-10-22)

| Token | Used by | Plan |
|---|---|---|
| GalleryProvisioning (Zone edit + Workers Routes, all zones) | gallery `CF_API_TOKEN` | **Delete** (not needed now; can edit DNS for every site) |
| AA / HUV / mdFineArt / FMW Read analytics (1 zone each) | each site's `CF_ANALYTICS_TOKEN` | Delete now (analytics not critical); recreate when builds return |
| Global API Key | no site | Not exposed; leave |
| Cloudflare Agent Token 2026-10-01 (24+ permissions, all zones) | no site code | Probably not in Railway; delete if its use is unknown |

Gallery images are served from R2's public URL (`R2_PUBLIC_URL`); the R2 key is only for uploads and deletes, so
revoking it keeps the gallery up (uploads stop until rotation).

## Plan for the night of 2026-10-22 (Karl, minimal)

- ☐ Delete GalleryProvisioning and the four analytics tokens
- ☐ Delete the R2 tokens for the gallery bucket and `aa-files` (new ones later)
- ☐ Delete the Anthropic keys (commons, gallery)
- ☐ Optional: gallery WAF rule
- Next day / when builds return: database public-networking check, rotate internal secrets, create new provider
  keys, deploy, reissue reviewer links

## Log

- 2026-10-22: Incident found; Railway CLI signed out; this checklist written.
- 2026-10-22: Resend keys deleted (all sites). AA WAF rule deployed (IPv6 /64 + IPv4 advised). Square application
  secret and sandbox token replaced; Square API logs, webhooks and seller account clean.

## Post-incident review (to do, with Karl)

Karl's framing (2026-10-22): with many gallery customers or busy sites, this could have been a disaster. The
review should ask how to make the next provider breach a small event. Observations captured during the response,
as starting points (not conclusions):

**What made it harder**
- **No inventory of secrets.** Which keys each site holds, where each comes from and what it can do had to be
  rebuilt from code and `.env.example` files under time pressure, across seven Railway projects.
- **Everything in one place.** Every secret for every site lived in one provider; one breach exposed all of them
  at once, including payments (Square) and email sending (Resend).
- **Shared and over-broad credentials.** Resend keys were deleted for all sites at once (one action stopped email
  everywhere). The gallery's Cloudflare token could edit every zone, including other sites' DNS. An
  Organization-scoped Anthropic key (admin-level) existed for a job that needed a workspace key. A broad
  "Cloudflare Agent Token" exists with unclear use.
- **Rotation depended on the breached provider.** New secrets couldn't be deployed while Railway builds were
  paused, so the only immediate options were revoking (and losing features) or fencing (WAF rules).
- **Admin panels were open to the internet by default,** protected only by a signing secret stored in the
  breached provider. The fence (Cloudflare rule) had to be built during the incident, and the services' own
  `*.up.railway.app` addresses bypass Cloudflare.
- **Third-party tokens stored in the database in plain form** (the gallery's Square access token), so database
  exposure would mean payment-account exposure.
- **Unknowns that decide the severity:** whether databases had public networking on, and what logs exist to tell
  whether anything was accessed.
- **Out-of-band access:** the CLI was signed out, the Gmail connector wasn't authorized, and Railway's notices
  went to email, so the response started from Karl's reading rather than from tooling.

**What went well**
- Revoking at the provider (Resend, Square, Cloudflare, Anthropic) needed no Railway access and stopped misuse
  immediately.
- Square API logs and webhooks gave a clear "not used" answer quickly.
- Serving gallery images from R2's public URL meant revoking the upload key didn't take the gallery down.
- Low traffic and few users made breaking features acceptable.

**Ideas to evaluate**
- A secrets inventory per site (name, provider, scope, what breaks if revoked, how to rotate), kept in each repo
  without the values, plus a short incident runbook. Could be a shared doc across the FoA sites.
- Least privilege by default: one key per site and per environment; workspace-scoped keys; zone-scoped Cloudflare
  tokens; no admin-level keys in apps.
- Admin panels behind an identity layer that doesn't depend on the host (e.g. Cloudflare Access), and remove the
  public `*.up.railway.app` domains.
- Encrypt stored third-party tokens with a key held outside the database, or avoid storing them.
- Check and document database public networking; turn it off where unused.
- A secrets manager outside the hosting provider, or at least the ability to rotate without a fresh build.
- Alerts: provider status pages and security notices to a monitored channel; spend alerts at Anthropic and
  Resend; Square notifications.
- Customer communication: what to tell gallery customers or subscribers if data may have been exposed, and when.
