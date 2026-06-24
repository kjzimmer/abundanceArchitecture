# Shared Tech Stack
**Version:** 1.1
**Updated:** June 2026
**Applies to:** All sites — Future of Abundance suite + client/retail web projects
**Canonical location:** `abundanceArchitecture/shared/`
**Governance:** Do not edit in site repos. Changes are made in Claude.ai and pushed to all repos.
If CC identifies a problem or gap, append to `shared/SHARED_FEEDBACK.md` — never edit this file.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | June 2026 | Railway NODE_ENV/devDependencies gotcha; railway.toml vs railway.json note |
| 1.0 | June 2026 | Initial canonical version — consolidates AA, FMW, MDFA stack decisions |

---

## Core Philosophy

Custom-built applications over CMS platforms. The developer uses Claude Code as the primary
code generation tool and Claude.ai for architecture, planning, and documentation decisions.
CMSs are avoided because they create constraints that conflict with custom feature requirements.

The goal is a reusable, compounding stack — each site built faster and more consistently
than the last because the patterns, docs, and tooling are already decided.

---

## Development Toolchain

| Tool | Role |
|------|------|
| Claude Code | Primary code generation and editing — all feature development |
| Claude.ai | Architecture decisions, documentation, cross-site coordination |
| GitHub | Version control — one repo per site |
| Railway | Hosting and deployment — Node apps + managed Postgres |

### Version Control Discipline

- Feature branches for all new work
- Pull requests with brief descriptions even when working solo
- Never push directly to `main`
- Each site is an independent repository
- Shared utility code extracted into a dedicated shared repo when patterns repeat across 3+ sites

---

## Application Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | TypeScript | Required on all projects — no plain `.js` files in `src/` |
| Runtime | Node.js | Current LTS |
| Framework | Express 5 | Named wildcards required — see Gotchas below |
| Frontend | React 18 | Component-based; SSR considered per-site based on SEO needs |
| Build tool | Vite | Sub-path deployment requires `base` config — see Gotchas below |
| Database | PostgreSQL | Hosted on Railway |
| ORM | Prisma 6 | Type-safe, excellent Railway + PostgreSQL integration |
| Prisma workflow | `migrate dev` + `migrate deploy` | Never `db push` on production — see Database section |

### TypeScript Requirements

- All source files use `.ts` or `.tsx` — no `.js` in `src/`
- Strict mode enabled on all projects
- No use of `any` without an explicit comment explaining why
- All Express route handlers and service functions fully typed
- Build output to `dist/` — Railway runs compiled output

```json
// tsconfig.json baseline — server
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Repository Structure

Every site follows this structure exactly. Deviations require a documented reason
in the site's `docs/TECH_STACK.md`.

```
{site-repo}/
├── CLAUDE.md                        ← root level — session orientation + standing rules
├── .env.example                     ← committed; key names + descriptions, no values
├── .gitignore
├── package.json                     ← root: scripts only, no dependencies
├── railway.toml                     ← explicit build + start commands
│
├── client/                          ← React + Vite frontend
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   └── admin/               ← admin UI components live here
│       ├── pages/
│       ├── lib/
│       │   └── apiFetch.ts          ← auth header injection + 401 handling
│       ├── hooks/
│       ├── types/
│       │   └── index.ts
│       └── context/
│
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 ← Express entry point
│       ├── middleware/
│       │   └── auth.ts              ← requireAdmin middleware
│       ├── routes/                  ← thin route handlers; call services
│       ├── services/                ← all business logic + DB interactions
│       ├── lib/                     ← utilities, external API clients
│       ├── jobs/                    ← cron jobs (omit folder if site has none)
│       └── scripts/
│           └── seed-admin.ts        ← seeds first admin user
│
├── prisma/                          ← at repo root, shared by server
│   ├── schema.prisma                ← source of truth for DB schema
│   └── migrations/                  ← never delete migration files
│
├── docs/
│   ├── TECH_STACK.md                ← site-specific stack; deviations from shared
│   ├── ARCHITECTURE.md              ← schema, API routes, data flows, folder notes
│   ├── SITE_DESIGN.md               ← design system, CSS approach, component conventions
│   ├── CONTENT.md                   ← page/route inventory (content-heavy sites only)
│   ├── wip/                         ← features in flight; named {feature-name}.md
│   └── archive/                     ← completed wip files, superseded docs
│
└── shared/                          ← READ ONLY — managed externally via Claude.ai
    ├── SHARED_TECH_STACK.md         ← this file
    ├── SHARED_ADMIN_MODULES.md      ← canonical admin backend contracts
    └── SHARED_FEEDBACK.md           ← CC appends here; never edits other shared/ files
```

### Service Layer Rule

Routes call services. Services own all Prisma interactions. No database calls in route files.
This makes services testable in isolation and keeps routes thin.

```
routes/contact.ts    → calls ContactService.createMessage()
services/ContactService.ts  → owns prisma.contactMessage.create()
```

---

## Database

### Prisma Version Pin

Pin to `prisma@6` and `@prisma/client@6`. Prisma 7 requires Node ≥20.19 — confirm local
dev Node version before upgrading. Railway runs Node 24 and handles either version.

Always use `provider = "prisma-client-js"` in the generator block:

```prisma
generator client {
  provider = "prisma-client-js"
}
```

The newer default `provider = "prisma-client"` generates output inside `src/` which
conflicts with `rootDir: ./src` in tsconfig.

### Migration Workflow

```bash
# Local development — creates migration file + applies to local DB
npx prisma migrate dev --name describe-the-change

# Production (Railway runs this at boot)
npx prisma migrate deploy

# Never use in production:
npx prisma db push     # bypasses migration history — local/prototyping only
```

Never delete migration files from `prisma/migrations/`. They are the complete history
of how the database was built and are required to reproduce the schema from scratch.

### Naming Conventions

- Model names: PascalCase (`Person`, `ContactMessage`)
- Field names: camelCase in schema (`sourceSite`), mapped to snake_case in DB (`@map("source_site")`)
- Table names: snake_case via `@@map("table_name")`
- All models include `createdAt` and `updatedAt` timestamps
- Primary keys: `cuid()` default

---

## Infrastructure

| Service | Role | Notes |
|---------|------|-------|
| Railway | App hosting + managed Postgres | Primary deployment target |
| Cloudflare | DNS, CDN, DDoS protection, SSL | All DNS managed here |
| AWS Route 53 | Domain registration only | Nameservers pointed to Cloudflare |
| Cloudflare R2 | Image/media storage | Media-heavy sites (S3-compatible) |
| AWS S3 | General file storage | Info-heavy sites |
| Cloudinary | Image storage + transformation | Alternative to R2; 25GB free tier |

### DNS Setup Pattern

1. Register domain on Route 53
2. Point nameservers to Cloudflare
3. Manage all DNS records, SSL, and CDN rules in Cloudflare

### Railway Configuration

Every repo uses `railway.toml` (not `railway.json`). Railway supports both formats —
`railway.toml` takes precedence if both exist. If a repo has `railway.json`, convert
it to `railway.toml` as part of the next transition session.

```toml
# railway.toml — required in every repo root
[build]
builder = "nixpacks"
buildCommand = "npm run build"

[deploy]
startCommand = "npx prisma migrate deploy && npm run start"
restartPolicyType = "on_failure"
healthcheckPath = "/api/health"
```

**Critical — `buildCommand` must be explicit.** Without it, Nixpacks auto-detects
`npm run build` correctly in development but fails silently in production. Railway
injects `NODE_ENV=production` at build time, which causes `npm install` to skip
`devDependencies`. If build tools (`tsc`, `vite`, `tsx`) are in `devDependencies`
rather than `dependencies`, the build silently serves stale compiled output from
the previous deploy instead of failing loudly.

**Rule: all build tools must be in `dependencies`, not `devDependencies`**, in both
`server/package.json` and `client/package.json`. This includes `typescript`, `vite`,
`tsx`, `@types/*`, and any other tool required at build time.

If a Railway deploy appears to succeed but the live site reflects old code, suspect
this issue first: check that `NODE_ENV=production` is set in Railway environment
variables and run a fresh deploy — if it then fails loudly, the missing dependency
is the cause.

### Root package.json Scripts Pattern

```json
{
  "scripts": {
    "build": "cd client && npm install && npm run build && cd ../server && npm install && npm run build",
    "start": "cd server && npm run start",
    "dev": "concurrently \"cd client && npm run dev\" \"cd server && npm run dev\"",
    "seed:admin": "npx tsx server/src/scripts/seed-admin.ts"
  }
}
```

---

## Authentication

Two distinct auth contexts across the suite. Never mix them.

### Admin Panel Auth — Existing Sites

DB-backed credentials on the `Person` model (`isAdmin`, `passwordHash`). bcryptjs for
hashing (cost factor 12), jsonwebtoken for sessions. Full spec in `shared/SHARED_ADMIN_MODULES.md`.

**Hardened JWT pattern — required on all sites:**
- Access token: 15-minute expiry
- Refresh token: 7-day expiry, stored in HttpOnly cookie
- Token blocklist table for explicit revocation on logout or credential change
- Login endpoint rate-limited (covered by global rate limiting — see below)

### Admin Panel Auth — New Sites

**Clerk** for all new projects initiated after June 2026, including the accounting app.
Clerk handles MFA, session management, device tracking, and audit logs.

### User-Facing Auth

**Clerk** when sites need public user accounts. Do not extend admin auth to public users.

### MFA

TOTP (Time-based One-Time Password) is the standard for sites requiring MFA.
Compatible with Google Authenticator, Authy, 1Password. Library: `otpauth`.
Required for: accounting app, any site handling financial or sensitive personal data.
Available for: any site — implement when the use case warrants it.

---

## Payments

### Stripe

Standard integration for USD transactions. Always abstract behind a `PaymentService`
interface — no Stripe SDK calls scattered through application code.

### BTCPay Server (future)

Self-hosted on a separate small VPS. Added alongside Stripe, not replacing it.
Customers choose payment method. Bitcoin as medium of exchange — no fiat conversion.

### Payment Architecture (required from day one)

```
server/src/services/payment/
  PaymentService.ts          ← interface definition
  StripePaymentService.ts    ← Stripe implementation
  BtcPayService.ts           ← added when needed
```

No payment provider SDK calls outside of these files.

---

## Rate Limiting

Apply `express-rate-limit` to all public-facing form endpoints:

```
10 requests per 15-minute window per IP
Applies to: POST /api/subscribe, POST /api/contact, POST /api/auth/login
```

For multi-instance deployments (Railway horizontal scaling), switch to a Redis-backed store.

---

## CSS / Styling

Not prescribed at the suite level. Each site uses whatever CSS approach fits its
design requirements. The decision is documented in the site's `docs/SITE_DESIGN.md`.

Current choices:
- AbundanceArchitecture: TBD
- FreeMarketWatch: CSS-in-JS (inline styles + CSS custom properties)
- mdFineArt: Tailwind CSS 3.4

When starting a new site, choose one and document it in `docs/SITE_DESIGN.md` before
writing any component code.

---

## External Services

| Service | Purpose | Decision point |
|---------|---------|----------------|
| Resend | Transactional email | Preferred over Postmark; decide before first email send |
| Clerk | Auth (new sites, user-facing) | Default for all new projects after June 2026 |
| Stripe | Payments | Standard — always behind PaymentService abstraction |
| BTCPay Server | Bitcoin payments | Add alongside Stripe when needed |
| Recharts | Admin analytics charts | Standard across all sites |
| node-cron | Scheduled jobs | Standard for sites with data pipelines |

---

## Gotchas — Read Before Every New Site

### Express 5 Wildcard Routes

Express 5 requires **named** wildcards. Bare `*` crashes at startup:

```typescript
// Wrong — crashes Express 5
app.get('/admin/*', handler);

// Correct
app.get('/admin/*path', handler);
```

This error only surfaces at runtime, not during TypeScript compilation.

### Vite Admin SPA Base Path

When the admin SPA is served at a sub-path (e.g. `/admin`), Vite must know the base path
or built asset references resolve from `/` instead of `/admin/`:

```typescript
// client/vite.config.ts
export default defineConfig({
  base: '/admin/',
  build: { outDir: '../public/admin' },
});
```

### Prisma Generator Provider

Always `provider = "prisma-client-js"` — not the newer `provider = "prisma-client"`.
The new default generates output inside `src/` which breaks `rootDir: ./src` in tsconfig.

### Railway NODE_ENV and devDependencies

Railway injects `NODE_ENV=production` at build time. This causes `npm install` to
skip `devDependencies`. If any build tool (`tsc`, `vite`, `tsx`, `@types/*`) is in
`devDependencies`, the build silently falls back to serving the previous deploy's
compiled output rather than failing loudly.

**Symptoms:** Railway deploy shows success, but the live site reflects old code.
No error in the build log. Adding `NODE_ENV=production` explicitly to Railway
environment variables will surface the real error on the next deploy.

**Fix:** Move all build-time tools from `devDependencies` to `dependencies` in
both `server/package.json` and `client/package.json`. Verify by setting
`NODE_ENV=production` in Railway and triggering a fresh deploy.

### Environment Variables

- Never commit `.env` — always commit `.env.example` with key names and descriptions
- Never hardcode secrets anywhere in source
- All required vars documented in `docs/ARCHITECTURE.md` for the site
- Railway injects `DATABASE_URL` and `PORT` automatically
- Always set `NODE_ENV=production` explicitly in Railway environment variables —
  do not rely on Railway injecting it silently

---

## Starter Template

Before building the second site of any new type, extract a starter template from the
first. The template includes:

- Express app scaffold with middleware
- React frontend scaffold with routing
- Prisma schema with Person-as-hub base models
- Admin auth integration
- Payment service abstraction
- Environment variable management pattern
- Railway + Cloudflare configuration
- CLAUDE.md + docs/ folder with correct structure

Every subsequent similar site starts from this template, not from scratch.

---

## What Is Deliberately Not Prescribed

These are common needs that must be consciously decided per project:

- Image optimization pipeline
- SEO meta tags and sitemap generation
- RSS feed
- Page caching / cache invalidation
- Admin UI for content management
- Email capture service (Mailchimp, ConvertKit, Buttondown — decide before first broadcast)
- SSR strategy (Next.js vs plain React + Express — decide at project initiation based on SEO needs)

Each is either built when needed, handled by a focused library, or consciously deferred.
The decision and its rationale go in the site's `docs/TECH_STACK.md`.
