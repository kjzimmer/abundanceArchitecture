# Shared Admin Modules
**Version:** 1.2
**Updated:** June 2026
**Applies to:** All sites — Future of Abundance suite + client/retail web projects
**Canonical location:** `abundanceArchitecture/shared/`
**Governance:** Do not edit in site repos. Changes are made in Claude.ai and pushed to all repos.
If CC identifies a problem or gap, append to `shared/SHARED_FEEDBACK.md` — never edit this file.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.2 | June 2026 | Admin UI layout section added; CF_ACCOUNT_ID marked optional; CF_ANALYTICS_TOKEN and CF_ZONE_ID clarified as the only required analytics vars |
| 1.1 | June 2026 | Added health-unveiled to source site string list |
| 1.0 | June 2026 | Initial canonical version — consolidates AA, FMW, MDFA admin patterns |

---

## Overview

Every site in the suite ships with the same admin foundation. This document is the canonical
backend contract — prescriptive about data models, API routes, auth pattern, and service
layer structure. Frontend implementation is intentionally non-prescriptive: each site
implements admin UI in whatever CSS framework it uses.

The six modules are:

1. **Auth** — hardened JWT with refresh tokens; first-run admin setup
2. **People CRM** — unified contact record for every person who interacts with the site
3. **Contact / Inquiries Inbox** — unified inbox for all inbound messages
4. **Analytics** — Cloudflare Zone Analytics + Web Analytics (RUM)
5. **Rate Limiting** — applied to all public-facing endpoints
6. **Admin UI Layout** — consistent left-nav structure across all sites

Set up in this order. Auth is a prerequisite for everything else.

---

## Core Architecture Principles

**Person as hub.** Every human who interacts with a site — subscriber, contact sender,
future account holder — is represented by a single `Person` record. All other records
attach to it as spokes. No duplicate contact records across features.

**Upsert on email.** Every public-facing form handler upserts a `Person` by email before
creating the child record. Never overwrite existing Person data on upsert — only create
if the record doesn't exist.

**Source site tagging.** Every record carries a `sourceSite` string
(e.g. `'free-market-watch'`). Use consistent kebab-case identifiers per site. This
enables cross-site queries when a shared accounts service is added later.

**Service layer owns all DB interactions.** Routes call services. Services own all
Prisma calls. No database logic in route files. This keeps routes thin and services
testable in isolation.

**Admin credentials are DB-backed.** Never store admin credentials in environment
variables. Credentials live on the `Person` model (`isAdmin`, `passwordHash`).

---

## Database Schema

The base schema applies to every site. Add site-specific spoke models as relations
on `Person` following the same hub-and-spoke pattern.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Person {
  id           String   @id @default(cuid())
  name         String?
  email        String   @unique
  phone        String?
  notes        String?
  tags         String[] @default([])
  isAdmin      Boolean  @default(false) @map("is_admin")
  passwordHash String?  @map("password_hash")
  totpSecret   String?  @map("totp_secret")   // null = TOTP not enabled
  totpEnabled  Boolean  @default(false) @map("totp_enabled")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  newsletter NewsletterSubscriber?
  contacts   ContactMessage[]
  sessions   RefreshToken[]
  // Add site-specific spoke relations here

  @@map("person")
}

model NewsletterSubscriber {
  id           String   @id @default(cuid())
  personId     String   @unique @map("person_id")
  person       Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
  active       Boolean  @default(true)
  sourceSite   String   @map("source_site")
  subscribedAt DateTime @default(now()) @map("subscribed_at")

  @@map("newsletter_subscriber")
}

model ContactMessage {
  id         String   @id @default(cuid())
  personId   String?  @map("person_id")
  person     Person?  @relation(fields: [personId], references: [id], onDelete: SetNull)
  name       String                       // denormalized — readable if Person deleted
  email      String                       // denormalized — readable if Person deleted
  phone      String?
  subject    String
  message    String
  read       Boolean  @default(false)
  sourceSite String   @map("source_site")
  createdAt  DateTime @default(now()) @map("created_at")

  @@map("contact_message")
}

model DailyAnalytics {
  id             String   @id @default(cuid())
  date           DateTime @unique
  site           String
  uniqueVisitors Int      @map("unique_visitors")
  pageViews      Int      @map("page_views")
  requests       Int
  bandwidthBytes BigInt   @map("bandwidth_bytes")
  createdAt      DateTime @default(now()) @map("created_at")

  @@map("daily_analytics")
}

model RefreshToken {
  id        String   @id @default(cuid())
  personId  String   @map("person_id")
  person    Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
  tokenHash String   @unique @map("token_hash")  // bcrypt hash of the raw token
  expiresAt DateTime @map("expires_at")
  revokedAt DateTime? @map("revoked_at")         // null = still valid
  createdAt DateTime @default(now()) @map("created_at")

  @@map("refresh_token")
}
```

**Adding site-specific spoke models** (event registrations, orders, commissions, etc.):
follow the same pattern — foreign key to `Person`, `onDelete: Cascade` or `SetNull`
as appropriate, `sourceSite` field on records that need cross-site attribution.

---

## 1. Auth

### Pattern

Admin credentials live on the `Person` model (`isAdmin: true`, `passwordHash`).
Multiple admins are supported without touching environment variables. Credentials
follow the same backup/restore path as all other data.

### Hardened JWT — Required on All Sites

Two-token pattern. Never use a single long-lived access token in localStorage.

| Token | Expiry | Storage | Purpose |
|-------|--------|---------|---------|
| Access token | 15 minutes | Memory only (never persisted) | Authenticates API requests |
| Refresh token | 7 days | HttpOnly cookie | Obtains new access tokens |

The refresh token is stored as a bcrypt hash in the `RefreshToken` table — the raw
token is never stored. This enables explicit revocation on logout or credential change.

### Environment Variables

```env
JWT_SECRET=          # 64-byte random hex — required
                     # generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Middleware

```typescript
// server/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AdminPayload {
  sub: string;      // Person.id
  email: string;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request { admin?: AdminPayload; }
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  try {
    const payload = jwt.verify(
      header.slice(7),
      process.env.JWT_SECRET!
    ) as AdminPayload;
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}
```

### Auth Routes

```
POST /api/auth/login      Public — verify email + password, issue access + refresh tokens
POST /api/auth/refresh    Public — validate refresh token cookie, issue new access token
POST /api/auth/logout     requireAdmin — revoke refresh token, clear cookie
GET  /api/auth/me         requireAdmin — return token payload (session check)
```

### Login Flow

```typescript
// server/src/routes/auth.ts (abbreviated)
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../prisma';

// POST /api/auth/login
export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password required' });
  }

  const person = await prisma.person.findUnique({ where: { email: email.toLowerCase() } });
  if (!person?.isAdmin || !person.passwordHash) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, person.passwordHash);
  if (!valid) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  // If TOTP is enabled, require a valid code before issuing tokens
  if (person.totpEnabled) {
    const { totpCode } = req.body;
    if (!totpCode || !verifyTOTP(person.totpSecret!, totpCode)) {
      return res.status(401).json({ success: false, error: 'Invalid TOTP code' });
    }
  }

  // Issue access token (short-lived, memory only on client)
  const accessToken = jwt.sign(
    { sub: person.id, email: person.email, isAdmin: true },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );

  // Issue refresh token (long-lived, HttpOnly cookie)
  const rawRefresh = crypto.randomBytes(64).toString('hex');
  const tokenHash = await bcrypt.hash(rawRefresh, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { personId: person.id, tokenHash, expiresAt }
  });

  res.cookie('refresh_token', rawRefresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: expiresAt,
    path: '/api/auth/refresh',   // cookie only sent to refresh endpoint
  });

  res.json({ success: true, accessToken });
}
```

### Refresh Flow

```typescript
// POST /api/auth/refresh
export async function refresh(req, res) {
  const raw = req.cookies?.refresh_token;
  if (!raw) return res.status(401).json({ success: false, error: 'No refresh token' });

  // Find a valid (non-expired, non-revoked) token whose hash matches
  const tokens = await prisma.refreshToken.findMany({
    where: {
      expiresAt: { gt: new Date() },
      revokedAt: null,
    },
    include: { person: true },
  });

  let matched = null;
  for (const token of tokens) {
    if (await bcrypt.compare(raw, token.tokenHash)) {
      matched = token;
      break;
    }
  }

  if (!matched || !matched.person.isAdmin) {
    return res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }

  const accessToken = jwt.sign(
    { sub: matched.person.id, email: matched.person.email, isAdmin: true },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );

  res.json({ success: true, accessToken });
}
```

### Logout

```typescript
// POST /api/auth/logout — requireAdmin
export async function logout(req, res) {
  const raw = req.cookies?.refresh_token;
  if (raw) {
    // Revoke all matching tokens (bcrypt compare to find)
    const tokens = await prisma.refreshToken.findMany({
      where: { revokedAt: null, personId: req.admin!.sub }
    });
    for (const token of tokens) {
      if (await bcrypt.compare(raw, token.tokenHash)) {
        await prisma.refreshToken.update({
          where: { id: token.id },
          data: { revokedAt: new Date() }
        });
      }
    }
  }
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
  res.json({ success: true });
}
```

### Frontend Token Handling

```typescript
// client/src/lib/apiFetch.ts
let accessToken: string | null = null;  // memory only — never localStorage

export function setAccessToken(token: string) { accessToken = token; }
export function clearAccessToken() { accessToken = null; }

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<{ success: boolean; data: T }> {

  const res = await fetch(path, {
    ...options,
    credentials: 'include',   // sends HttpOnly refresh cookie automatically
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  // Access token expired — attempt silent refresh
  if (res.status === 401 && accessToken) {
    const refreshed = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshed.ok) {
      const { accessToken: newToken } = await refreshed.json();
      setAccessToken(newToken);
      // Retry original request with new token
      return apiFetch(path, options);
    } else {
      // Refresh failed — session expired
      clearAccessToken();
      window.location.href = '/admin/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  }
  return res.json();
}
```

### First-Run Admin Setup (Target Pattern)

The CLI seed script is a transitional tool. The target pattern requires no terminal
access to production:

1. **First-run detection** — on startup, if no `Person` with `isAdmin: true` exists,
   the app enters setup mode
2. **Temp password generation** — app generates a cryptographically random temporary
   password
3. **Email delivery** — app sends the temp password to `ADMIN_EMAIL` env var via Resend
4. **Forced password change** — admin logs in with temp password and is immediately
   redirected to a change-password flow; access token is not issued until password is changed
5. **Normal operation** — after password change, setup mode exits permanently

**Current interim pattern (until Resend is wired up):**

```bash
npm run seed:admin <email> <password>
# npx tsx server/src/scripts/seed-admin.ts <email> <password>
```

The seed script bcrypt-hashes the password (cost 12) and upserts a Person with
`isAdmin: true`. Safe to re-run to reset a password. When Resend is integrated,
replace the seed script with the first-run flow and remove the `seed:admin` script.

### TOTP / MFA (for sites requiring MFA)

Required for: accounting app, any site handling financial or sensitive personal data.
Available for: any site — implement when the use case warrants it.

Library: `otpauth` (npm). Implementation adds:
- `totpSecret` + `totpEnabled` fields on `Person` (already in base schema)
- `POST /api/auth/totp/setup` — generate secret, return QR code URI
- `POST /api/auth/totp/verify` — verify first code to confirm setup, set `totpEnabled: true`
- `POST /api/auth/totp/disable` — require password confirmation to disable
- Login route checks `totpEnabled` and requires `totpCode` in request body if true

---

## 2. People CRM

### What It Does

Maintains a unified contact record for every person who interacts with the site. Records
are created automatically via form upserts — no manual data entry required. The admin
view shows all people with activity summaries and a detail view with full history.

### Service Layer

```typescript
// server/src/services/PersonService.ts
import { prisma } from '../prisma';

export async function upsertPerson(
  email: string,
  name?: string,
  phone?: string
) {
  return prisma.person.upsert({
    where: { email: email.toLowerCase() },
    update: {},                          // never overwrite existing data on form submission
    create: {
      email: email.toLowerCase(),
      name: name ?? null,
      phone: phone ?? null,
    },
  });
}
```

### API Routes

```
GET    /api/people          [admin] All people with _count of related records
GET    /api/people/:id      [admin] Single person with full relation history
PATCH  /api/people/:id      [admin] Update name, phone, notes, tags
DELETE /api/people/:id      [admin] Delete person and cascade all relations
```

### Admin UI (implementation notes — not prescriptive)

Two-panel layout: scrollable list of person cards on the left (name, email, activity
badges), detail panel on the right (edit form, relation history). A "Copy subscriber
emails" button extracts active newsletter subscriber emails for manual broadcast use.

---

## 3. Contact / Inquiries Inbox

### What It Does

A unified inbox for all inbound contact messages. Unread messages are visually
highlighted. Admins expand messages inline and mark them read. New messages trigger
an optional email notification (fire-and-forget — never blocks the API response).

### Service Layer

```typescript
// server/src/services/ContactService.ts
import { prisma } from '../prisma';
import { upsertPerson } from './PersonService';

interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  sourceSite: string;
}

export async function createMessage(input: ContactInput) {
  const person = await upsertPerson(input.email, input.name, input.phone);

  const msg = await prisma.contactMessage.create({
    data: {
      personId: person.id,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      subject: input.subject,
      message: input.message,
      sourceSite: input.sourceSite,
    },
  });

  // Fire-and-forget notification — never await, never block the response
  if (process.env.NOTIFICATION_EMAIL_ENDPOINT) {
    fetch(process.env.NOTIFICATION_EMAIL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: input.subject, from: input.email }),
    }).catch((err) => console.error('[contact] notification failed:', err));
  }

  return msg;
}
```

### API Routes

```
POST   /api/contact              Public — create message, upsert Person, trigger notification
GET    /api/contact              [admin] All messages, newest first
PATCH  /api/contact/:id/read     [admin] Mark a message read
```

### Validation (route layer, not service layer)

Required: `name`, `email` (valid format), `subject`, `message`. `phone` optional.
Validate in the route handler before calling the service.

### Admin UI (implementation notes — not prescriptive)

Single-column inbox. Each item: sender name, email, subject, date, unread indicator.
Expanding an item shows the full message body. Expanding an unread item automatically
marks it read. Unread count badge in navigation.

For sites with multiple form types (commissions, bookings, registrations): fetch all
endpoints in parallel (`Promise.all`), normalize into a common `Item` shape, group
by category. Mark-read applies only to `ContactMessage` records — other record types
have their own status workflows in dedicated admin sections.

---

## 4. Analytics (Cloudflare)

### What It Does

Pulls traffic data from Cloudflare's Zone Analytics GraphQL API. No third-party
analytics service, no cookies, no tracking scripts required for basic visitor counts.
Richer behavioral data (top pages, referrers, device types) requires Cloudflare Web
Analytics (RUM) — see below.

Daily aggregates are persisted to `DailyAnalytics` after each successful Cloudflare
fetch, giving retention beyond Cloudflare's 30-day window.

### Prerequisites

The site's domain must be proxied through Cloudflare (orange cloud in DNS). This is
required for Zone Analytics.

### Environment Variables

```env
CF_ANALYTICS_TOKEN=           # Cloudflare API token — required for Zone Analytics
                              # Dashboard → My Profile → API Tokens
                              # Use "Read analytics for a zone" template
                              # Scope to specific zone (one token per domain)
CF_ZONE_ID=                   # Cloudflare zone ID — required for Zone Analytics
                              # Cloudflare dashboard → domain overview → right sidebar
CF_ACCOUNT_ID=                # Cloudflare account ID — not currently used by analytics
                              # route; document here for completeness only
CF_WEB_ANALYTICS_SITE_TAG=    # Cloudflare Web Analytics site tag
                              # Dashboard → Web Analytics → your site → Advanced Options
                              # Requires Cloudflare Pro plan
                              # Leave unset if not on Pro — cards show setup notice
```

### API Route

```
GET /api/analytics?range=7|14|30    [admin]
```

- Accepts `range`: 7, 14, or 30 days. Defaults to 30, clamped to valid values.
- Queries Cloudflare GraphQL `httpRequests1dGroups` for daily aggregates
- After successful fetch, upserts each day into `DailyAnalytics`
- For ranges beyond 30 days, queries local `DailyAnalytics` table
- 15-minute in-memory cache — Cloudflare daily data doesn't change intra-day
- Returns `{ source: 'cloudflare' | 'local', totals, daily, countries, range }`
- Returns `{ source: 'unavailable', message }` if env vars not configured

```typescript
// Cloudflare GraphQL query — Zone Analytics
const query = `
  query($zoneTag: String!, $startDate: Date!, $endDate: Date!) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        httpRequests1dGroups(
          limit: 31
          filter: { date_geq: $startDate, date_leq: $endDate }
          orderBy: [date_ASC]
        ) {
          dimensions { date }
          uniq { uniques }
          sum {
            requests
            pageViews
            bytes
            countryMap { clientCountryName requests }
          }
        }
      }
    }
  }
`;
```

**Critical:** `$zoneTag: String!` must use capital-S `String` — lowercase `string`
is a GraphQL type error that Cloudflare rejects silently.

### Admin UI — Six Cards (implementation notes — not prescriptive)

**Always implement all six cards.** Never show mock/placeholder data. If data is
unavailable, show a clear setup notice instead.

| Card | Data Source | Condition |
|------|-------------|-----------|
| Unique Visitors | Zone Analytics | Always available |
| Page Views | Zone Analytics | Always available |
| Total Requests | Zone Analytics | Always available |
| Device Types | Web Analytics (RUM) | Requires Pro + `CF_WEB_ANALYTICS_SITE_TAG` |
| Top Pages | Web Analytics (RUM) | Requires Pro + `CF_WEB_ANALYTICS_SITE_TAG` |
| Top Referrers | Web Analytics (RUM) | Requires Pro + `CF_WEB_ANALYTICS_SITE_TAG` |

Range selector (7d / 14d / 30d) triggers a fresh API fetch and updates all Zone
Analytics cards. Line chart shows Unique Visitors + Page Views over the selected range.
Country breakdown: proportional bars, top 8 countries by request share.

When `CF_WEB_ANALYTICS_SITE_TAG` is not set or site is not on Cloudflare Pro, the
three RUM cards display: *"Requires Cloudflare Pro plan + Web Analytics setup.
See docs/ARCHITECTURE.md for configuration steps."*

### Web Analytics Beacon (when on Cloudflare Pro)

```html
<!-- Add once to index.html <head> -->
<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
  data-cf-beacon='{"token": "CF_WEB_ANALYTICS_SITE_TAG"}'></script>
```

The RUM dataset uses `rumPageloadEventsAdaptiveGroups` — a separate GraphQL query
from Zone Analytics. Implement as a second query in the analytics route when
`CF_WEB_ANALYTICS_SITE_TAG` is set.

---

## 5. Rate Limiting

Apply to all public-facing endpoints using `express-rate-limit`:

```typescript
// server/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

export const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,                      // 10 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — try again later' },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts — try again later' },
});
```

Apply in route registration:

```typescript
// Applies to all public form endpoints + login
app.post('/api/subscribe', formLimiter, subscribeHandler);
app.post('/api/contact', formLimiter, contactHandler);
app.post('/api/auth/login', loginLimiter, loginHandler);
```

For multi-instance deployments (Railway horizontal scaling), switch to a Redis-backed
store (`rate-limit-redis`). Single-instance deployments use in-memory store.

---

## Shared Environment Variables

Every site using these modules requires:

```env
# Required
DATABASE_URL=                        # PostgreSQL connection string (Railway injects automatically)
JWT_SECRET=                          # 64-byte random hex string

# Optional — contact notification
NOTIFICATION_EMAIL_ENDPOINT=         # Fire-and-forget POST on contact submission

# Optional — Cloudflare analytics (CF_ANALYTICS_TOKEN + CF_ZONE_ID required for Zone Analytics)
CF_ANALYTICS_TOKEN=                  # Zone Analytics API token
CF_ZONE_ID=                          # Cloudflare zone ID
CF_ACCOUNT_ID=                       # Not currently used — documented for completeness
CF_WEB_ANALYTICS_SITE_TAG=           # Web Analytics site tag (Pro plan required)

# Transitional — remove when first-run flow is implemented
ADMIN_EMAIL=                         # Used by seed-admin script only
```

---

## 6. Admin UI Layout

The admin panel uses a consistent layout across all sites. CC must follow this structure
regardless of which CSS framework the site uses. Consistency matters because the same
person administers all sites — zero relearning when switching between them.

### Overall Structure

Two-column layout: fixed left navigation + scrollable main content area.

```
┌─────────────────┬────────────────────────────────────┐
│                 │                                    │
│   Left Nav      │   Main Content Area                │
│   (240px)       │                                    │
│                 │   Page Title          [Actions]    │
│   Site Name     │   ─────────────────────────────    │
│   ─────────     │                                    │
│   Dashboard     │   {module content}                 │
│   People        │                                    │
│   Inbox         │                                    │
│   {site-       │                                    │
│    specific}    │                                    │
│                 │                                    │
│   ─────────     │                                    │
│   Logout        │                                    │
└─────────────────┴────────────────────────────────────┘
```

### Left Navigation

- **Width:** 240px fixed
- **Site name/logo** at top — links to public site in a new tab
- **Module links** in standard order (see below) — full-width, active state clearly indicated
- **Logout button** pinned to bottom of nav
- Nav is always visible — no collapsing on desktop
- Mobile behavior: per-site decision; document in `docs/SITE_DESIGN.md`

### Standard Module Order

Every site implements modules in this order in the nav. Site-specific modules
are inserted after Inbox:

1. Dashboard (analytics overview)
2. People
3. Inbox
4. {site-specific modules — e.g. Commissions, Market Data, Events}
5. Settings (if implemented)

### Main Content Area

- **Page title** — top left of content area, matches nav item name
- **Action buttons** — top right of content area (e.g. "Copy subscriber emails", "Mark all read")
- **Content** below the title/action row

### Module Layout Patterns

**Table modules (People, Inbox):**
- Full-width table or card list
- Most recent first (default sort)
- Unread / active state: visual indicator on the row (bold, accent color, or dot)
- Row click or expand: reveals detail — either inline expand or right-side detail panel
- Empty state: clear message, never a blank table

**Analytics (Dashboard):**
- Range selector (7d / 14d / 30d) at top right
- Six cards in a responsive grid (3×2 on desktop, 2×3 on tablet, 1×6 on mobile)
- Line chart below cards: Unique Visitors + Page Views over selected range
- Country breakdown below chart: proportional bars, top 8 countries

**Detail views (People detail, message expand):**
- Edit form for editable fields (name, phone, notes, tags)
- Read-only history of related records (messages sent, subscription status)
- Destructive actions (delete) require confirmation — either a modal or inline confirm step

### What Varies Per Site

- Color scheme — admin palette does not need to match the public site
- Typography — per site's design system
- CSS framework — Tailwind, CSS-in-JS, plain CSS: per `docs/SITE_DESIGN.md`
- Site-specific module sections beyond the standard five

### What Never Varies

- Left nav, 240px, with site name at top and logout at bottom
- Standard module order in nav
- Page title top left, actions top right
- No mock data — empty states use messaging, not placeholder content
- Confirmation required for all destructive actions

---

## Adapting Per Site

1. **Schema:** Add site-specific spoke models as relations on `Person`. Update
   `PersonService` include object to load them in the People admin detail view.

2. **Source site string:** Use consistent kebab-case per site:
   - `abundance-architecture`
   - `free-market-watch`
   - `md-fine-art`
   - `health-unveiled`

3. **Contact categories:** If the site has multiple form types (inquiry, commission,
   booking), add them as separate models with their own status workflows. Normalize
   into a common `Item` shape in the admin inbox frontend.

4. **Analytics:** Copy the analytics route as-is — no site-specific references beyond
   env vars. Add the four `CF_*` env vars to Railway for each site's zone.

5. **Admin UI:** Implement using whatever frontend stack the site uses. The backend
   contracts (API routes, response shapes, auth header) are identical across all sites.

6. **TOTP:** Implement when the site's use case warrants it. The `totpSecret` and
   `totpEnabled` fields are in the base schema — no migration needed to add TOTP later.

---

## Deployment Gotchas

### Express 5 Wildcard Routes

Express 5 requires named wildcards. Bare `*` crashes at startup:

```typescript
// Wrong — crashes Express 5
app.get(['/admin', '/admin/*'], handler);

// Correct
app.get(['/admin', '/admin/*path'], handler);
```

### Vite Admin SPA Base Path

```typescript
// client/vite.config.ts
export default defineConfig({
  base: '/admin/',
  build: { outDir: '../public/admin' },
});
```

Without `base: '/admin/'`, built asset paths resolve from `/` instead of `/admin/`
and the page loads blank.

### Refresh Token Cookie Path

The refresh token cookie must set `path: '/api/auth/refresh'` — this restricts the
cookie to only the refresh endpoint and prevents it from being sent on every API
request, which would be a security and performance issue.

### Prisma Generator

Always `provider = "prisma-client-js"` in the generator block. The newer default
`provider = "prisma-client"` generates output inside `src/` which conflicts with
`rootDir: ./src` in tsconfig and breaks the build.
