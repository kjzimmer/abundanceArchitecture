# Railway security incident: credential rotation (Oct 2026)

## Resume here

*Updated 2026-10-23 afternoon (day 3). Karl is back tonight.* **Done today:** JWT rotation live on all six services;
Resend recovered (four new per-service keys); admin access restored on every site and the Cloudflare admin locks
deleted; review links and the AA↔commons key rotated, new links in
`C:\Users\karlz\claudeSites\review-links-2026-10-23.txt` for Karl to send to Hans and Natalie.

**Start tonight with:**
1. Karl: send Hans and Natalie their new links, then delete the links file. Confirm the AA admin **test email**
   (Email → Send test email) and the staging test comment (`[AA Review] /learn`) both arrived.
2. **Personal Finance (still urgent, not done):** Plaid secret + Clerk secret key; check Plaid activity and Clerk users;
   whose bank accounts are connected?
3. AA email secrets: Resend webhook signing secret (Karl rotates in Resend, pastes into AA production
   `RESEND_WEBHOOK_SECRET`); inbound secret (Claude sets Railway + Cloudflare Worker together via wrangler).
4. Gallery: change admin password; OK to delete the plain-text `ADMIN_PASSWORD` variable on `mdFineArt`.
5. Remaining keys (features still off): R2 (gallery uploads, AA shared docs), Anthropic (commons Holon, gallery
   AI), Cloudflare analytics per site, Turnstile secret (AA prod + staging), database passwords, FMW CoinGecko/FRED;
   precautionary admin password changes; cfeEstimator's extra Railway domains.
6. Restructure this file into Karl's review sections, then the **After Action Review**.

*Status at end of day 1 (2026-10-22 night):* **Containment is complete.** Every outside credential that was in Railway is
revoked, all databases are private, Square is clean, and all three admin panels are locked to Karl's IP. What
remains needs Railway builds (rotation and deploys), then the After Action Review Karl wants. Status by step:

1. ☑ Confirmed by Karl, night of 2026-10-22: Cloudflare GalleryProvisioning + four analytics tokens deleted; R2
   tokens (gallery bucket, `aa-files`) deleted; Anthropic keys `livingSystems` (…NgAA, Organization scope) and
   `myGalleryWorks` (…ewAA) deleted. Kept `claude_code_key_karl.zimmer_qjoy` (Claude Code's own key, never in
   Railway). The commons key Railway used (…zwAA) is not in his Console list even with Status = All: treated as
   gone; it expires 2026-11-19 regardless. **Effect until rotation:** no email on any site, no Holon, no gallery AI
   features or image uploads, no AA shared-document viewing, no analytics pages. Public sites and gallery images
   stay up.
2. ☑ Railway CLI logged in again (Karl, 2026-10-22).
3. ☑ Database public networking (2026-10-22): **7 of 8 Postgres databases had a public TCP proxy** (AA production,
   AA staging, gallery, health Unveiled, Free Market Watch, cfeEstimator, Personal Finance; only knowledgeCommons
   was private). Every app connects over the private network and all local dev uses localhost, so Karl removed
   all seven proxies; re-check confirmed all private. **Logs** (`railway logs --service Postgres`, about 15–22 Oct
   retained; three were empty, probably restarted when the proxy was removed): no failed password attempts
   anywhere; automated scanner probes on the gallery (16 Oct), FMW (15–16 Oct) and AA staging (15–21 Oct).
   Postgres does not log successful logins here, so **no evidence of access, but not proof**. Whether to tell
   gallery customers / AA subscribers is Karl's decision (few users; record the reasoning in the review).
   Check script (prints no secrets): `scratchpad/dbcheck.sh` from the 2026-10-22 session; it links each project
   from a scratch folder and classifies `RAILWAY_TCP_PROXY_DOMAIN` / `DATABASE_URL` hosts.
4. ☑ (2026-10-22) Admin panels locked by Cloudflare custom rules ("Lock admin during Railway incident"), each
   allowing only Karl's IPv6 /64 and IPv4: **abundancearchitecture.world** (admin path list, see section 2),
   **melodydebenedictis.com** and **mygalleryworks.com** (gallery: block any `Authorization: Bearer` request,
   since its admin API is header-authenticated). Melody's IP was not added (she should treat the gallery admin as
   offline until rotation, or add her IP). Remove all three rules after the `JWT_SECRET`s are rotated.
5. ☐ **When Railway builds return** (still paused at 2026-10-22 03:00 UTC), project by project, gallery first:
   generate and set new internal secrets (`JWT_SECRET`, webhook secrets incl. the AA Worker's, Turnstile,
   review-link secrets, AA's commons site key, database passwords); Karl creates new provider keys (Resend per site,
   R2 per bucket, Anthropic for the commons and gallery, Cloudflare analytics per site, gallery provisioning only
   if needed, Square app secret already new); deploy and test each site; remove the three admin-lock rules;
   reissue reviewer links (Karl, Hans Prahl, Natalie); review HU, FMW, cfeEstimator and Personal Finance code for
   any other providers.
6. ☐ Decide whether to notify gallery customers / AA subscribers (see step 3).
7. ☐ **After Action Review** with Karl: the last section of this file ("Post-incident review") holds the timeline
   material, observations and ideas gathered during the response.

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

- ☑ (2026-10-22, see Resume here) In each Postgres service, check whether **public networking (TCP proxy)** is on (a `DATABASE_PUBLIC_URL`
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

- ☑ Delete GalleryProvisioning and the four analytics tokens
- ☑ Delete the R2 tokens for the gallery bucket and `aa-files` (new ones later)
- ☑ Delete the Anthropic keys (commons, gallery)
- ☐ Optional: gallery WAF rule (not done)
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

### Added to the review, 2026-10-22
- 7 of 8 databases were reachable from the internet although no app or local setup needed it (the Postgres
  template's default). Public by default turned a secrets leak into a possible data leak.
- Postgres logs kept about a week and didn't record successful logins, so "was data read?" can't be answered.
  Consider enabling connection logging and longer log retention or export.

### Response timeline (for the After Action Review)

| When (Karl's time, 2026-10-21/22) | What |
|---|---|
| 21 Oct, 07:24 UTC | Railway starts investigating; dashboard, API and CLI unavailable from 09:28 UTC; builds paused |
| 21 Oct, 22:10 UTC | Railway publishes its security notice: revoke all environment variables |
| Evening 22 Oct | Karl raises it in this session; CLI found signed out; secrets inventory rebuilt from code |
| | Resend: all keys deleted (all sites) |
| | AA admin locked by Cloudflare rule (WAF menu renamed "Security rules": took some finding) |
| | Square: app secret + sandbox token replaced; API logs, webhooks, seller account clean |
| | Cloudflare tokens reviewed: GalleryProvisioning + 4 analytics tokens deleted; R2 tokens deleted |
| | Anthropic: Organization-scoped and gallery keys deleted; Claude Code key kept |
| | Railway login restored; 7 of 8 databases found publicly reachable; proxies removed; logs checked |
| | Gallery admin locked on melodydebenedictis.com and mygalleryworks.com; all rules allow IPv6 /64 + IPv4 |

- Containment took one evening, with a fair amount of time spent finding dashboard screens and reconstructing
  which site used which credential.

## Recovery log (from 2026-10-22, day 2)

- **Builds:** Railway restored builds for Pro and Enterprise first (22 Oct 12:30 UTC); Hobby, Free and Trial still
  pending. A test rotation on AA staging set the variable but no deploy ran, so Karl's projects are on a tier
  still waiting. Plan (option 3): stage everything now, deploy when builds return. Railway has published rotation
  guides; no post-mortem yet.
- **JWT secrets staged (unique per site and environment, generated in the shell, never printed),
  `--skip-deploys`:** AA production, AA staging, mdFineArt, healthUnveiled, FMW `web`, cfeEstimator. Each
  service needs a redeploy when builds return (`railway redeploy` or the dashboard). Rotation logs everyone out
  once; passwords stay the same.
- **Passwords to change (precaution, databases were public; hashes may have been copied):** admin accounts on AA,
  the gallery, HU, FMW, cfeEstimator, and any reused elsewhere. The gallery additionally has an unused
  **`ADMIN_PASSWORD` in plain text in Railway**: change the gallery admin password; delete the variable (Karl to OK).
- **Variable inventory, all services (names only, 2026-10-22):**

| Service | Secrets beyond DATABASE_URL | Notes |
|---|---|---|
| AA prod | JWT, RESEND, RESEND_WEBHOOK, INBOUND_WEBHOOK, TURNSTILE_SECRET, R2, CF_ANALYTICS | |
| AA staging | JWT, RESEND, TURNSTILE_SECRET, REVIEW_LINK_SECRET, COMMONS_SITE_KEY, CF_ANALYTICS | |
| mdFineArt | JWT, ADMIN_PASSWORD, ANTHROPIC, CF_API_TOKEN, CF_ANALYTICS, R2, RESEND, SQUARE_APP_SECRET | |
| myGalleryWorks-business | RESEND | |
| healthUnveiled | JWT, CF_ANALYTICS | |
| FMW web | JWT, CF_ANALYTICS, COINGECKO_API_KEY, FRED_API_KEY | data APIs, low value |
| cfeEstimator | JWT, ANTHROPIC | Anthropic key already dead (401) |
| personal_finance | **PLAID_SECRET**, **CLERK_SECRET_KEY**, ANTHROPIC | Anthropic key dead (401); **Plaid + Clerk urgent** |
| livingSystems (commons) | ANTHROPIC, REVIEW_LINK_SECRET, SITE_KEYS | |

- **Personal Finance (urgent, found day 2):** Plaid secret + public database (likely holding Plaid access tokens)
  could allow reading connected bank accounts. Rotate the Plaid secret and Clerk secret key; check Plaid activity
  and Clerk users.

### Day 3 (2026-10-23)

- Railway builds restored for all tiers (22 Oct 23:22 UTC). Railway: redeploying pre-incident deployments fails,
  so each service needs a **fresh build** (`railway redeploy --from-source`); pre-incident API/CLI tokens were
  invalidated. Preliminary incident report promised, not yet published.
- Before deploying, checked each service's last deployed commit against its branch head on GitHub: all identical,
  so fresh builds shipped no new code.
- **JWT rotation live** on all six services (AA staging, AA production, mdFineArt, healthUnveiled, FMW, cfeEstimator):
  fresh builds succeeded, every site responds. All old sessions invalid; same passwords.
- cfeEstimator has four public `*.up.railway.app` domains: clean up (review item).
- Email recovery under way: one Resend key per service, sending-only, limited to its domain (AA production, AA
  staging → abundancearchitecture.world; gallery, myGalleryWorks business → mygalleryworks.com); Karl pastes keys
  straight into Railway. Then AA's Resend webhook signing secret and the inbound Worker secret, deploy, test.
- **Resend recovered (day 3):** new sending-only keys, one per service, each limited to its domain, pasted by Karl
  straight into Railway (auto-deployed): AA production and AA staging (abundancearchitecture.world);
  `mdFineArt` gallery app and `myGalleryWorks-business` (mygalleryworks.com). Keys are per app, not per
  gallery: the gallery app is multi-tenant. HU, FMW, cfeEstimator, Personal Finance have no Resend key (by design
  for now). Staging verified: a test reviewer comment produced an `[AA Review]` email accepted by Resend.
- **Follow-ups noted:** (1) reviewer comments exist only as emails: consider pointing staging's comment
  notifications at hello@ so they land in production's admin Inbox (test self-domain handling first), rather than
  staging writing to production's database; (2) a real staging subdomain in Resend when staging is formalized;
  (3) if galleries later send from their own domains, the platform key needs domain-management rights: design
  that deliberately.
- Still to rotate for AA email: Resend webhook signing secret (prod), inbound Worker secret (Railway + Worker).
- **Admin access restored (day 3):** Karl deleted all three Cloudflare admin-lock rules after JWT rotation (his
  Starlink IPv6 prefix and shared IPv4 had changed overnight, so the lock blocked him: IP allow-lists fit badly
  with Starlink). AA admin: logout + password login works. AA silently re-logged in first because its 7-day
  refresh token is a random value checked against a hash in the database, not signed with `JWT_SECRET` (expected,
  safe). Gallery admin and platform admin (`melodydebenedictis.com/app-admin`, gated by `isAppAdmin` in the JWT)
  work. `mygalleryworks.com` is the business page (no admin).
- **Follow-ups noted:** (4) a "sign out everywhere" action (revoke all refresh tokens) for rotation runbooks;
  (5) move the platform admin to its own myGalleryWorks address with a second factor before onboarding customers
  (Karl agrees; fine for now).
- **Review links and AA↔commons key rotated (day 3):** new unique `REVIEW_LINK_SECRET` on AA staging and on the
  commons, and a new AA site key (one value set as AA staging `COMMONS_SITE_KEY` and in the commons' `SITE_KEYS`);
  generated in the shell, never printed. Checked deployed commit = branch head first (no code shipped), then fresh
  builds of AA staging and the commons: both SUCCESS. Verified: old AA link cookie refused (403); new owner link
  works; AA → commons link-through works with the new key; new commons steward link works (Sessions opens).
  New links for Karl (AA owner + commons steward), Hans Prahl and Natalie (natalie@nrhythm.co) are in
  `C:\Users\karlz\claudeSites\review-links-2026-10-23.txt` (outside any repo): Karl sends them and deletes the file.
