# CLAUDE.md — Abundance Architecture Web Project
*For Claude Code sessions on the foa-abundance-architecture repository*

---

## What This Project Is

AbundanceArchitecture.world is the hub site for a long-term public inquiry into the
structural conditions required for human flourishing. It is the home of the book
*Abundance Architecture* (in development) and the parent site to two related properties:
FreeMarketWatch.world and HealthUnveiled.world.

The current build goal is a teaser landing page — a static page that introduces the
project, signals intellectual seriousness, and captures email signups while full
development proceeds.

---

## Current Task: Teaser Landing Page

### Scope
Deploy a teaser page at AbundanceArchitecture.world. This is a static HTML page
served by Express. No database, no auth, no React build step required for this phase.

### The HTML File
The file `public/index.html` is the final design. It was designed externally and
approved. **Treat it as pixel-perfect spec — do not restyle, restructure, or
"improve" the design.** Your job is to wire it into the Express app and deploy it,
not to redesign it.

### What Needs to Be Built
1. Express app in TypeScript (`src/server.ts`) that:
   - Serves `public/` as static files
   - Has a `POST /api/subscribe` endpoint that accepts `{ email: string }`,
     validates it, logs it, and returns `{ success: true }` (stub — no email
     service wired yet)
   - Has a health check at `GET /health` returning `{ status: 'ok' }`
2. `package.json` with all dependencies and scripts
3. `tsconfig.json` per the shared tech stack TypeScript requirements
4. `.env.example` documenting all environment variables
5. `README.md` with local setup and deployment instructions
6. Railway deployment configuration

### Hero Image
The hero background image slot is `public/images/hero.jpg`. This file does not
exist yet — artwork is being generated separately. Leave the slot wired in the
HTML as-is. When the image is ready it drops into that path with no code changes.

### Email Form
The form in `index.html` submits to `POST /api/subscribe`. Wire it to the stub
endpoint. Do not integrate an email service yet — that decision is pending.
The stub should:
- Validate that email is present and is a valid email format
- Log the submission to console (for Railway log visibility)
- Return `{ success: true }` on valid submission
- Return `{ success: false, error: 'Invalid email' }` on invalid submission

---

## Tech Stack for This Project

See `shared-tech-stack.md` for full details. Key points:

- **TypeScript required** — all source files `.ts`, strict mode, no `any` without comment
- **Node.js** current LTS
- **Express** for the server
- **Railway** for hosting — GitHub integration for automated deploys
- **No database** for teaser phase
- **No auth** for teaser phase
- **No React** for teaser phase — pure static HTML

---

## Repository Structure

```
foa-abundance-architecture/
├── src/
│   └── server.ts
├── public/
│   ├── index.html          ← teaser page — DO NOT MODIFY
│   ├── images/
│   │   └── hero.jpg        ← placeholder slot; file not present yet
│   └── (any extracted CSS if needed)
├── docs/
│   └── adr/                ← ADRs go here; create ADR-001 for any significant decisions
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── CHANGELOG.md
```

---

## Coding and Documentation Standards

See `coding-and-documentation-standards.md` for full standards. Key points:

- Every file gets a header comment explaining its purpose and role
- Non-obvious decisions get inline comments explaining *why*, not *what*
- Any significant architectural decision gets an ADR in `docs/adr/`
- `.env.example` documents every environment variable
- `README.md` must include: what this is, local setup steps, environment variables,
  deployment instructions

---

## Deployment

- Railway project: `foa-abundance-architecture`
- Branch `main` deploys to production at AbundanceArchitecture.world
- Branch `staging` deploys to staging environment
- Railway start command: `npm run start` (runs compiled JS from `dist/`)
- Build command: `npm run build` (runs `tsc`)

### Required Environment Variables
```
PORT=3000
NODE_ENV=production
```
Document any additions in `.env.example`.

---

## What Not to Change

- `public/index.html` — final design, do not touch
- The visual design — typography, colors, layout are approved and final
- The copy — all text content in the HTML is approved and final

---

## ADR Guidance for This Session

If you make any decision that affects how this project will be built or extended —
choice of middleware, project structure deviations, how the email stub is designed —
write a brief ADR in `docs/adr/`. The template is in `coding-and-documentation-standards.md`.

The goal is that a future Claude Code session opening this repo cold can read the
ADRs and understand why things are the way they are without having to reverse-engineer
the code.

---

## Related Projects

- `foa-free-market-watch` — FreeMarketWatch.world, live
- `foa-health-unveiled` — HealthUnveiled.world, teaser page coming
- Both sites share the same tech stack and coding standards
