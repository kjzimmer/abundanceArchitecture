# Reusable Admin Modules

A shared specification for admin capabilities designed to drop into any site in the FoA suite
(AbundanceArchitecture.world, HealthUnveiled.world, FreeMarketWatch.world, and any future sites).

The spec is prescriptive about **backend contracts** — data models, API routes, auth pattern,
service layer structure — and intentionally non-prescriptive about frontend implementation.
Each site implements the admin UI appropriate to its tech stack.

---

## Core Architecture Principles

**Person as hub.** Every human who interacts with a site — subscriber, contact sender, future
account holder — is represented by a single `Person` record. All other records attach to it as
spokes. No duplicate contact records across features; no orphaned data if a person unsubscribes.

**Upsert on email.** Every public-facing form handler upserts a `Person` by email before creating
the child record. The `Person` record is the canonical source of truth for contact data; child
records carry denormalized `name`/`email` fields only for display robustness if the Person is
later deleted.

**Source site tagging.** Every record that a person generates (subscription, contact message,
analytics event) carries a `source_site` string (e.g. `'abundance-architecture'`). This enables
cross-site queries when a shared accounts service is added later.

**Service layer, no DB logic in routes.** Each domain has a dedicated service file
(`PersonService`, `SubscriberService`, `ContactService`). Routes call services; services own all
Prisma interactions. This makes services testable in isolation and routes thin.

---

## Database Schema

```prisma
model Person {
  id           String   @id @default(cuid())
  name         String?
  email        String   @unique
  phone        String?
  notes        String?
  tags         String[] @default([])
  isAdmin      Boolean  @default(false) @map("is_admin")
  passwordHash String?  @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  newsletter NewsletterSubscriber?
  contacts   ContactMessage[]
  // Add site-specific relations here (registrations, orders, etc.)

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
  name       String                    // denormalized for display robustness
  email      String                    // denormalized for display robustness
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
```

**Adding site-specific spoke models** (e.g. event registrations, course enrollments, orders):
follow the same spoke pattern — `personId String @unique` or `personId String` (one-to-many),
foreign key to `Person`, `onDelete: Cascade` or `SetNull` as appropriate.

---

## 1. People CRM

### What it does

Maintains a unified contact record for every person who interacts with the site. Records are
created automatically via form upserts — no manual data entry required. The admin view shows
all people with activity summaries and a detail view with full history.

### Service layer

```typescript
// PersonService.ts — shared upsert helper used by all form handlers
export async function upsertPerson(email: string, name?: string, phone?: string) {
  return prisma.person.upsert({
    where: { email },
    update: {},                         // never overwrite existing data on form submission
    create: { email, name: name ?? null, phone: phone ?? null },
  });
}
```

### API routes

```
GET    /api/people          [admin] All people with _count of related records
GET    /api/people/:id      [admin] Single person with full relation history
PATCH  /api/people/:id      [admin] Update name, phone, notes, tags
DELETE /api/people/:id      [admin] Delete person and cascade all relations
```

### Admin UI (implementation notes)

The UI is a two-panel layout: a scrollable list of person cards on the left (showing name,
email, activity badges), and a detail panel on the right (edit form, newsletter status, message
history). A "Copy subscriber emails" button extracts all active newsletter subscriber emails
for manual broadcast use until a proper email tool is in place.

---

## 2. Contact / Inquiries Inbox

### What it does

A single inbox for all inbound contact messages. Unread messages are visually highlighted.
Admins expand messages inline and mark them read. New messages can trigger an optional
email notification (fire-and-forget; never blocks the API response).

### Service layer

```typescript
// ContactService.ts
export async function createMessage(input: ContactInput) {
  const person = await upsertPerson(input.email, input.name, input.phone);
  const msg = await prisma.contactMessage.create({
    data: { personId: person.id, ...input },
  });
  // Fire-and-forget notification — never await
  if (process.env.NOTIFICATION_EMAIL_ENDPOINT) {
    fetch(process.env.NOTIFICATION_EMAIL_ENDPOINT, { method: 'POST', ... })
      .catch((err) => console.error('[contact] notification failed:', err));
  }
  return msg;
}
```

### API routes

```
POST   /api/contact              Public — create message, upsert Person, trigger notification
GET    /api/contact              [admin] All messages, newest first
PATCH  /api/contact/:id/read    [admin] Mark a message read
```

### Validation (route layer)

Required fields: `name`, `email` (valid format), `subject`, `message`. `phone` is optional.
Validate at the route, not in the service.

### Public contact form

Add a contact form to the public site that POSTs to `/api/contact`. On success, replace the
form with a confirmation message. On failure, show an inline error without clearing the form.

### Admin UI (implementation notes)

A single-column inbox. Each item shows sender name, email, subject line, date, and an unread
indicator. Clicking an item expands the message body inline. Expanding an unread item
automatically marks it read. An unread count badge appears in the navigation.

For sites with multiple form types (inquiries, booking requests, registrations), normalize all
message types into a common `Item` shape in the frontend and group by category. Mark-read
applies only to `ContactMessage` records; other record types have their own status workflows.

---

## 3. Analytics (Cloudflare)

### What it does

Pulls traffic data from Cloudflare's Zone Analytics GraphQL API. No third-party analytics
service, no cookies, no tracking scripts required for basic visitor counts. Richer data
(top pages, referrers, device types) requires Cloudflare's Web Analytics beacon.

### Prerequisites

The site's domain must be proxied through Cloudflare (orange cloud in DNS). Zone Analytics
require this. Web Analytics (RUM) can work on any domain but requires a JS beacon in `<head>`.

### Environment variables

```env
CF_ANALYTICS_TOKEN=    # API token — "Read analytics for a zone" template, scoped to this domain
CF_ZONE_ID=            # Cloudflare dashboard → domain overview → right sidebar
CF_ACCOUNT_ID=         # Same location as Zone ID
CF_WEB_ANALYTICS_SITE_TAG=   # Optional — enables top pages / referrers / device data
```

Scope each token to a single zone. A leaked token cannot read other sites' data.

### API route

```
GET /api/analytics?range=30    [admin]
```

Accepts `range`: 7, 14, or 30 days. Queries `httpRequests1dGroups` for daily aggregates.
Aggregates country data across all days. Uses a 15-minute in-memory cache to avoid hammering
the Cloudflare API.

After a successful Cloudflare fetch, upserts each day's aggregate into `DailyAnalytics` for
retention beyond Cloudflare's 30-day limit.

Returns `{ source: 'cloudflare', totals, daily, countries }` on success.
Returns `{ source: 'unavailable', message: '...' }` if env vars are not configured.

**GraphQL variable type note:** `$zoneTag: String!` must use capital-S `String` — lowercase
`string` is a GraphQL type error that Cloudflare rejects silently.

### Web Analytics beacon (optional)

```html
<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
  data-cf-beacon='{"token": "CF_WEB_ANALYTICS_SITE_TAG"}'></script>
```

Add once to the site's `<head>`. Enables `rumPageloadEventsAdaptiveGroups` data —
a separate GraphQL query from Zone Analytics.

### Admin UI (implementation notes)

Range selector (7d / 14d / 30d), stat cards (Unique Visitors, Page Views, Requests), a daily
visitors bar/line chart, and a country breakdown with proportional bars. If env vars are not
configured, the tab shows an instructional notice rather than failing or showing mock data.

---

## 4. Auth

### Pattern

Admin credentials are stored in the database on the `Person` record (`isAdmin`, `passwordHash`).
This allows multiple admins without touching environment variables and keeps credentials in the
same backup/restore path as the rest of the data.

JWT is used for stateless session management. The `JWT_SECRET` env var is the signing key — it
must be set in every environment (Railway variable, local `.env`).

### Middleware

```typescript
// middleware/auth.ts
export function requireAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(header.slice(7), process.env.JWT_SECRET!);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

Apply to all admin-only routes. Public routes (`POST /api/subscribe`, `POST /api/contact`)
do not use this middleware.

### Routes

```
POST /api/auth/login    Public — verifies email+password, returns JWT (7d expiry)
```

### Seed script

```bash
npm run seed:admin <email> <password>
# or directly:
npx tsx scripts/seed-admin.ts <email> <password>
```

Bcrypt-hashes the password (cost 12), upserts a Person with `isAdmin: true`. Safe to re-run
to reset a password. The script uses `dotenv` internally — no `--env-file` flag needed. On
Railway, env vars are injected automatically; locally, a `.env` file is loaded if present.

### Frontend token handling

Store the JWT in `localStorage`. Attach it as `Authorization: Bearer <token>` on all admin
API calls. On 401, clear the token and redirect to login. Never store credentials.

---

## 5. Rate Limiting

Apply rate limiting to all public-facing form endpoints to prevent spam. A simple in-memory
limiter (e.g. `express-rate-limit`) is sufficient for single-instance deployments:

```
10 requests per 15-minute window per IP on POST /api/subscribe and POST /api/contact
```

For multi-instance deployments (Railway horizontal scaling), switch to a Redis-backed store.

---

## Shared Environment Variables

Every site using these modules needs:

```env
DATABASE_URL=                  # PostgreSQL connection string
JWT_SECRET=                    # Random 32+ char string for JWT signing
NOTIFICATION_EMAIL_ENDPOINT=   # Optional — fire-and-forget contact notification
CF_ANALYTICS_TOKEN=            # Optional — Cloudflare analytics
CF_ZONE_ID=                    # Optional — Cloudflare analytics
CF_ACCOUNT_ID=                 # Optional — Cloudflare analytics
CF_WEB_ANALYTICS_SITE_TAG=     # Optional — Cloudflare RUM beacon
```

---

## Deployment Gotchas

### Express 5 wildcard routes

Express 5 uses `path-to-regexp` v8+ which requires **named** wildcards. Bare `*` is invalid
and crashes the server at startup with `PathError: Missing parameter name`.

```typescript
// Wrong — crashes Express 5
app.get(['/admin', '/admin/*'], handler);

// Correct
app.get(['/admin', '/admin/*path'], handler);
```

This error only surfaces at runtime, not during TypeScript compilation.

### Vite admin SPA base path

When the admin SPA is served at a sub-path (e.g. `/admin`), Vite must be told the base path
so that built asset references resolve correctly. Without `base`, the HTML references
`/assets/...` (root-relative) but the files live at `/admin/assets/...`.

```typescript
// admin/vite.config.ts
export default defineConfig({
  base: '/admin/',
  // ...
});
```

This affects both local dev (proxy must forward `/admin` correctly) and the production build.

---

## Adapting Per Site

1. **Schema**: Add site-specific spoke models as relations on `Person`. Update the
   `PersonService` include object to load them in the People admin detail view.
2. **Source site string**: Use a consistent kebab-case identifier per site
   (`abundance-architecture`, `health-unveiled`, `free-market-watch`).
3. **Contact categories**: If the site has multiple form types (inquiry, registration, booking),
   add them as separate models and normalize them into the inbox's `Item` shape in the frontend.
4. **Analytics**: Copy the analytics route as-is — no site-specific references. Add the
   four CF env vars to Railway for the new site's zone.
5. **Admin UI**: Implement using whatever frontend stack the site uses. The backend contracts
   (API routes, response shapes, auth header) are identical across all sites.
