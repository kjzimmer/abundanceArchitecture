# Architecture — Abundance Architecture
*DB schema, API routes, data flows, and folder notes.*
*For stack decisions see `shared/SHARED_TECH_STACK.md` and `docs/TECH_STACK.md`.*
*For admin module contracts see `shared/SHARED_ADMIN_MODULES.md`.*

---

## Data Model

Source of truth: `prisma/schema.prisma`. Summary below.

### Person (hub)

Every human who interacts with the site — subscriber, contact sender, admin — is a
single `Person` record. All other records attach as spokes.

```
person
  id            cuid, pk
  email         unique — upsert key for all form submissions
  name          optional
  phone         optional
  notes         optional — admin-editable
  tags          string[] — admin-editable
  is_admin      boolean, default false
  password_hash optional — set only for admin accounts
  created_at / updated_at
```

### NewsletterSubscriber (spoke)

One-to-one with Person. Created when someone submits the subscribe form.

```
newsletter_subscriber
  id            cuid, pk
  person_id     fk → person (cascade delete)
  active        boolean, default true — set false on unsubscribe
  source_site   'abundance-architecture'
  subscribed_at
```

### ContactMessage (spoke)

One-to-many with Person. Created when someone submits the contact form.

```
contact_message
  id            cuid, pk
  person_id     fk → person (set null on delete) — nullable
  name          denormalized — readable if Person deleted
  email         denormalized — readable if Person deleted
  phone         optional
  subject
  message
  read          boolean, default false
  source_site   'abundance-architecture'
  created_at
```

### DailyAnalytics

Persists Cloudflare Zone Analytics daily aggregates beyond Cloudflare's 30-day window.

```
daily_analytics
  id              cuid, pk
  date            unique — one row per calendar day per site
  site            'abundance-architecture'
  unique_visitors
  page_views
  requests
  bandwidth_bytes bigint
  created_at
```

### Pending (PR3 — Auth Hardening)

The following models are in `shared/SHARED_ADMIN_MODULES.md` but not yet in the
schema. They will be added via migration in PR3:

- `RefreshToken` — stores bcrypt-hashed refresh tokens for explicit revocation
- `Person.totp_secret` / `Person.totp_enabled` — TOTP/MFA fields

---

## API Routes

### Public

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| POST | `/api/subscribe` | subscribeRouter | Rate limited (formLimiter) |
| POST | `/api/contact` | contactRouter | Rate limited (formLimiter) |
| POST | `/api/auth/login` | authRouter | Rate limited (loginLimiter) |
| GET | `/api/health` | inline | Health check for Railway |
| GET | `/health` | inline | Legacy alias — kept for backwards compat |

### Admin (requireAdmin middleware — Bearer JWT)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/api/contact` | contactRouter | All messages, newest first |
| PATCH | `/api/contact/:id/read` | contactRouter | Mark message read |
| GET | `/api/people` | peopleRouter | All people with _count |
| GET | `/api/people/:id` | peopleRouter | Single person with full history |
| PATCH | `/api/people/:id` | peopleRouter | Update name, phone, notes, tags |
| DELETE | `/api/people/:id` | peopleRouter | Delete + cascade |
| GET | `/api/analytics` | analyticsRouter | `?range=7\|14\|30` |

### SPA Catch-all

| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin` | Serves `public/admin/index.html` |
| GET | `/admin/*path` | Serves `public/admin/index.html` (named wildcard required by Express 5) |

---

## Data Flows

### Subscribe form submission

```
POST /api/subscribe { email }
  → validate email format
  → SubscriberService.subscribe(email)
      → PersonService.upsertPerson(email)     ← creates Person if new
      → prisma.newsletterSubscriber.upsert    ← creates or reactivates
  → { success: true, isNew: boolean }
```

### Contact form submission

```
POST /api/contact { name, email, phone?, subject, message }
  → validate required fields
  → ContactService.createMessage(input)
      → PersonService.upsertPerson(email, name, phone)
      → prisma.contactMessage.create
      → fire-and-forget: NOTIFICATION_EMAIL_ENDPOINT (if set)
  → { success: true }
```

### Admin login

```
POST /api/auth/login { email, password }
  → prisma.person.findUnique(email)
  → verify isAdmin + passwordHash
  → bcrypt.compare(password, hash)
  → jwt.sign({ personId, email }, JWT_SECRET, { expiresIn: '7d' })
  → { token, name, email }
```

*Note: 7-day single access token stored in localStorage is the current implementation.
This will change in PR3 to hardened JWT (15-min access + 7-day HttpOnly refresh).*

### Analytics fetch

```
GET /api/analytics?range=30
  → check 15-min in-memory cache
  → if miss: Cloudflare GraphQL httpRequests1dGroups query
      → upsert each day into DailyAnalytics
  → return { source, totals, daily, countries }
  → if CF env vars absent: return { source: 'unavailable' }
```

---

## Environment Variables

```env
# Required
DATABASE_URL=              # PostgreSQL (Railway injects automatically)
JWT_SECRET=                # 64-char+ random hex — generate with:
                           # node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
PORT=                      # Railway injects automatically

# Optional — contact notification
NOTIFICATION_EMAIL_ENDPOINT=   # Fire-and-forget POST on contact submission

# Optional — Cloudflare analytics
# CF_ANALYTICS_TOKEN + CF_ZONE_ID required for Zone Analytics charts
CF_ANALYTICS_TOKEN=        # API token (Read analytics for zone template, scoped to this zone)
CF_ZONE_ID=                # Cloudflare dashboard → domain overview → right sidebar
CF_ACCOUNT_ID=             # Not currently used by analytics route; documented for completeness
CF_WEB_ANALYTICS_SITE_TAG= # Web Analytics site tag — requires Cloudflare Pro plan

# Railway build environment
NODE_ENV=production        # Must be set explicitly in Railway — do not rely on auto-injection
```

---

## Folder Notes

```
server/
  package.json       — server dependencies (all build tools in dependencies, not devDependencies)
  tsconfig.json      — rootDir: ./src, outDir: ./dist
  src/
    index.ts         — Express entry point; registers all routers
    db.ts            — Prisma client singleton
    middleware/
      auth.ts        — requireAdmin: verifies Bearer JWT
    routes/
      auth.ts        — POST /api/auth/login
      subscribe.ts   — POST /api/subscribe
      contact.ts     — POST /api/contact + admin GET/PATCH
      people.ts      — admin CRUD (all routes use requireAdmin)
      analytics.ts   — Cloudflare GraphQL + DailyAnalytics cache
    services/
      PersonService.ts     — upsertPerson hub helper
      SubscriberService.ts
      ContactService.ts
    scripts/
      seed-admin.ts  — CLI admin seeder; uses dotenv internally
  dist/              — compiled output (gitignored); entry point: dist/index.js

client/              — React + Vite admin SPA
  package.json       — client dependencies (all build tools in dependencies, not devDependencies)
  index.html         — Vite entry point
  vite.config.ts     — base: '/admin/', outDir: ../public/admin
  tsconfig.json
  src/
    main.tsx
    App.tsx          — token check → Login or AdminLayout
    api.ts           — apiFetch wrapper; token stored in localStorage (pre-PR3)
    components/
      Login.tsx
      AdminLayout.tsx    — top-tab nav (pre-Module 6 migration)
      AdminPeople.tsx
      AdminContact.tsx
      AdminAnalytics.tsx

prisma/
  schema.prisma
  migrations/        — never delete these

public/
  index.html         — teaser page — DO NOT TOUCH
  js/main.js         — subscribe + contact form handlers
  images/
  admin/             — Vite build output (committed to git)
```

### Path note for server index.ts

`__dirname` at runtime is `server/dist/`. Static files are served with `path.join(__dirname, '..', '..', 'public')` — two levels up to reach the repo root's `public/`.

---

## Source Site String

All records from this site use `source_site = 'abundance-architecture'`.
