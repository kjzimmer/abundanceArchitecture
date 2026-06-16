# Shared Tech Stack Decisions
*Version: 1.1*
*Last updated: June 2026*
*Applies to: All projects — Future of Abundance ecosystem and Client/Retail Web Dev*

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | March 2026 | Initial document |
| 1.1 | June 2026 | Added TypeScript as required language; added teaser page pattern |

---

## Core Philosophy

Custom-built applications over CMS platforms. The developer has a background in Node, Express, React, and relational databases and will use Claude Code as the primary code generation tool. CMSs are avoided because they create constraints that conflict with custom feature requirements. The goal is to build reusable patterns and a starter template that compounds in value across all projects.

---

## Development Toolchain

| Tool | Role | Notes |
|------|------|-------|
| Claude Code | Primary code generation and editing | All feature development done through Claude Code |
| Claude.ai | Planning, content generation, architecture decisions | This interface |
| GitHub | Version control, source of truth | One repo per site; shared-components repo when patterns emerge |
| Railway | Hosting and deployment | Node apps + Postgres; pipelines connected to GitHub |

### Version Control Discipline
- Feature branches for all new work
- Pull requests with brief descriptions even when solo
- Never push directly to main
- Each site is an independent repository
- Shared utility code extracted into a `shared-components` repo when patterns repeat across 3+ sites

---

## Application Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | TypeScript | Required on all projects — no plain .js files in src/ |
| Runtime | Node.js | Current LTS version |
| Framework | Express | Familiar, lightweight, sufficient for all planned use cases |
| Frontend | React | Component-based; SSR considered per-site based on SEO needs |
| Database | PostgreSQL | Hosted on Railway; relational model fits all planned data structures |
| ORM | To be decided per project | Prisma or Drizzle preferred for type safety |

### TypeScript Requirements
- All source files use `.ts` or `.tsx` extensions — no `.js` in `src/`
- `tsconfig.json` configured at project root with strict mode enabled
- Types defined in `src/types/` and shared across the application
- No use of `any` without an explicit comment explaining why
- All Express route handlers and service functions fully typed
- Build output to `dist/` — Railway runs the compiled output

```json
// tsconfig.json baseline
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

## Infrastructure

| Service | Role | Notes |
|---------|------|-------|
| Railway | App hosting + Postgres | Primary deployment target |
| Cloudflare | DNS, CDN, DDoS protection, SSL | Free tier sufficient; DNS management here, domain registration stays on Route 53 |
| AWS Route 53 | Domain registration only | Not used for DNS — Cloudflare handles nameservers |
| AWS S3 | General file/media storage | Used for info-heavy sites |
| Cloudinary | Image storage + transformation | Used for media-heavy sites (e.g. artist gallery); free tier: 25GB storage, 25GB bandwidth |

### DNS Setup Pattern
- Domains registered on Route 53
- Nameservers pointed to Cloudflare
- All DNS records, SSL, and CDN rules managed in Cloudflare

---

## Authentication

**Clerk** or **Auth.js** — do not roll custom auth.

- Clerk preferred for faster integration and managed sessions
- Auth.js acceptable if deeper control is needed
- Decision made per project at initiation

---

## Payments

### Near Term: Stripe
- Standard integration for USD transactions
- Clean abstraction layer required (see Payment Architecture below)

### Future: BTCPay Server
- Self-hosted on a separate small VPS (~$6-10/month)
- Connects directly to Bitcoin wallet — no third-party processor
- Lightning Network for smaller transactions
- Philosophy: Bitcoin is the medium of exchange, not USD. No fiat conversion. Purchaser handles any conversion on their end.
- BTCPay added alongside Stripe, not replacing it — customers choose payment method

### Payment Architecture (Critical)
All payment logic must sit behind a `PaymentService` interface from day one. No Stripe SDK calls scattered through application code. This ensures adding BTCPay Server later is an isolated change.

```
/services
  /payment
    PaymentService.ts        ← interface definition
    StripePaymentService.ts  ← Stripe implementation
    BtcPayService.ts         ← added later
```

---

## Teaser Page Pattern

Sites launch with a teaser page before full development begins. The teaser is a static HTML page served by Express — no database, no auth, no dynamic content required.

### Teaser Page Scope
- Single `index.html` served as a static file from Express
- Email capture form posts to a stub endpoint that returns success
  (wire to real email service — Mailchimp, ConvertKit, Buttondown — when chosen)
- Hero background image slot: `public/images/hero.jpg` — swap in final artwork when ready
- No React, no build step, no ORM for the teaser phase
- Upgrade path: teaser serves from same Express app that the full site will use;
  full site routes added alongside it when development begins

### Teaser File Structure
```
/
├── src/
│   └── server.ts          ← Express app; serves static files + email stub
├── public/
│   ├── index.html         ← teaser page (treat as final design, do not restyle)
│   ├── images/
│   │   └── hero.jpg       ← hero background (placeholder until artwork ready)
│   └── styles/            ← if CSS is extracted from HTML
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## Starter Template

Before building the second site, extract a starter template from the first completed site. This template should include:

- Express app scaffold with middleware configuration
- React frontend scaffold with routing
- PostgreSQL schema conventions and migration setup
- Auth integration (Clerk)
- Payment service abstraction
- Environment variable management pattern
- Railway deployment configuration
- Cloudflare DNS setup checklist
- GitHub Actions CI pipeline (basic lint + test)

Every subsequent site starts from this template, not from scratch.

---

## What Is Deliberately Not Built

The following are common CMS features that must be consciously decided on per project — they do not come for free in a custom stack:

- Image optimization pipeline
- SEO meta tags and sitemap generation
- RSS feed
- Page caching / cache invalidation
- Security patching (handled by keeping dependencies updated)
- Admin UI for content management

Each of these is either built when needed, handled by a focused library, or consciously deferred.

---

## Decisions Still Open

- SSR strategy: Next.js vs plain React + Express (decide at first site initiation based on SEO requirements)
- ORM: Prisma vs Drizzle (decide at first site initiation)
- Email: Resend or Postmark for transactional email (decide when first site needs it)
- Email capture service for teaser pages: Mailchimp, ConvertKit, or Buttondown (decide before teaser goes live)
