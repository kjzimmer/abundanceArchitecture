# CLAUDE.md — Abundance Architecture Web Project
*For Claude Code sessions on the abundanceArchitecture repository*

---

## What This Project Is

AbundanceArchitecture.world is the hub site for a long-term public inquiry into the
structural conditions required for human flourishing. It is the home of the book
*Abundance Architecture* (in development) and the parent site to two related properties:
FreeMarketWatch.world and HealthUnveiled.world. Together these form the Future of Abundance
(FoA) suite.

The teaser landing page is live. The current build phase is the admin foundation — subscriber
management, contact inbox, analytics, and admin auth — which is also being designed as a
reusable pattern across all FoA sites (see `docs/REUSABLE_ADMIN_MODULES.md`).

---

## Current State

- **Teaser page** live at AbundanceArchitecture.world — `public/index.html`
- **Subscribe form** — `POST /api/subscribe`, persists to `NewsletterSubscriber` via Person hub
- **Contact form** — `POST /api/contact`, persists to `ContactMessage` via Person hub
- **Admin panel** — React SPA at `/admin`, protected by DB-based JWT auth
- **People CRM** — unified contact records auto-created from all form submissions
- **Analytics** — Cloudflare Zone Analytics via GraphQL, retained in `DailyAnalytics` table
- **Admin seed** — `npm run seed:admin <email> <password>`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Runtime | Node.js (Railway runs 24.x) |
| Framework | Express 5 |
| Admin frontend | React 19 + Vite 5 (SPA at `/admin`) |
| Database | PostgreSQL via Railway |
| ORM | Prisma 6 (`provider = "prisma-client-js"`) |
| Auth | bcryptjs + jsonwebtoken (DB-stored admin credentials) |
| Rate limiting | express-rate-limit |

### Critical version constraints

- **Prisma 6** — pinned because Prisma 7 requires Node >=20.19; local Node may be older
- **Vite 5** — pinned because Vite 8 requires Node >=20.19
- **Prisma generator must be `provider = "prisma-client-js"`** — the new default
  `provider = "prisma-client"` generates to `src/generated/` which breaks `rootDir: ./src`

### Express 5 wildcard routes

Express 5 requires **named** wildcards — bare `*` crashes at startup:

```typescript
// Wrong
app.get('/admin/*', handler);

// Correct
app.get('/admin/*path', handler);
```

### Vite sub-path deployment

The admin SPA is served at `/admin`, so `vite.config.ts` must set `base: '/admin/'`.
Without it, asset paths resolve from `/` (root) instead of `/admin/` and the page is blank.

---

## Repository Structure

```
abundanceArchitecture/
├── src/
│   ├── server.ts              ← Express entry point
│   ├── db.ts                  ← Prisma client singleton
│   ├── middleware/
│   │   └── auth.ts            ← requireAdmin JWT middleware
│   ├── routes/
│   │   ├── auth.ts            ← POST /api/auth/login
│   │   ├── subscribe.ts       ← POST /api/subscribe
│   │   ├── contact.ts         ← POST /api/contact + admin routes
│   │   ├── people.ts          ← admin-only CRUD
│   │   └── analytics.ts       ← Cloudflare GraphQL + DailyAnalytics cache
│   └── services/
│       ├── PersonService.ts   ← upsertPerson hub helper
│       ├── SubscriberService.ts
│       └── ContactService.ts
├── admin/                     ← React admin SPA (Vite)
│   ├── index.html
│   ├── vite.config.ts         ← base: '/admin/', outDir: ../public/admin
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api.ts             ← apiFetch wrapper + token management
│       └── components/
│           ├── Login.tsx
│           ├── AdminLayout.tsx
│           ├── AdminPeople.tsx
│           ├── AdminContact.tsx
│           └── AdminAnalytics.tsx
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── scripts/
│   └── seed-admin.ts          ← CLI admin seeder (uses dotenv internally)
├── public/
│   ├── index.html             ← teaser page — DO NOT RESTYLE
│   ├── js/main.js             ← subscribe + contact form handlers
│   ├── images/
│   └── admin/                 ← Vite build output (committed)
├── docs/
│   ├── CLAUDE.md              ← this file
│   ├── REUSABLE_ADMIN_MODULES.md ← suite-wide admin spec
│   ├── shared-tech-stack-v1.1.md
│   └── adr/
├── railway.json
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Scripts

```bash
npm run dev:server    # tsx watch src/server.ts (loads .env)
npm run dev:admin     # vite dev server on :5173 with /api proxy to :3000
npm run build         # prisma generate + tsc + vite build (Railway uses this)
npm run start         # node dist/server.js (Railway uses this)
npm run seed:admin    # npx tsx scripts/seed-admin.ts <email> <password>
```

---

## Environment Variables

```env
DATABASE_URL=                  # PostgreSQL (set by Railway automatically)
JWT_SECRET=                    # 32+ char random string — required
PORT=                          # set by Railway automatically
NOTIFICATION_EMAIL_ENDPOINT=   # optional — fire-and-forget contact notification
CF_ANALYTICS_TOKEN=            # Cloudflare API token (Read analytics for zone)
CF_ZONE_ID=                    # Cloudflare zone ID
CF_ACCOUNT_ID=                 # Cloudflare account ID
CF_WEB_ANALYTICS_SITE_TAG=     # optional — Cloudflare RUM beacon data
```

---

## Deployment

- **Railway project**: foa-abundance-architecture
- **Domain**: AbundanceArchitecture.world (DNS via Cloudflare)
- **Branch `main`** → auto-deploy to production
- **Build**: `npm run build` (via `railway.json`)
- **Start**: `npx prisma migrate deploy && npm run start` (via `railway.json`)

Migrations run automatically at boot. Schema changes go through `prisma migrate dev`
locally first, then the migration file is committed and Railway applies it on next deploy.

---

## What Not to Change

- `public/index.html` — final approved design, do not restyle or restructure
- All copy in the HTML — content is approved and final
- The visual design (typography, colors, layout) is approved and final

---

## Related Projects (FoA Suite)

- `abundanceArchitecture` — this repo, AbundanceArchitecture.world
- `healthUnveiled` — HealthUnveiled.world
- `freeMarketWatch` — FreeMarketWatch.world

All three sites share the same tech stack and admin module design. See
`docs/REUSABLE_ADMIN_MODULES.md` for the backend/schema/API spec that applies across
all sites. Frontend implementation varies per site.

---

## ADR Index

| ADR | Decision |
|-----|----------|
| 0001 | Express server for teaser (vs static hosting) |
| 0002 | Bootstrap commit directly to main |
| 0003 | Subscriber persistence approach |
| 0004 | Railway topology — separate projects per site |
