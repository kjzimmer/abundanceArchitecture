# Abundance Architecture

Teaser landing page and Express server for [AbundanceArchitecture.world](https://abundancearchitecture.world).

This is phase one of the site: a static landing page served by a TypeScript/Express app,
with a working email capture form backed by Postgres. No auth, no React build step yet —
see [docs/CLAUDE.md](docs/CLAUDE.md) and
[docs/shared-tech-stack-v1.1.md](docs/shared-tech-stack-v1.1.md) for the fuller plan and
the upgrade path to the full dynamic site.

## Local Setup

```bash
npm install          # also runs prisma generate via postinstall
cp .env.example .env # then fill in DATABASE_URL and PORT
```

Create a local Postgres database (e.g. `abundance_architecture_dev`), set its connection
string as `DATABASE_URL` in `.env`, then run the initial migration:

```bash
npx prisma migrate dev
npm run dev
```

The dev server runs on `http://localhost:3000` (or `PORT` from `.env`) and restarts on
file changes.

Other scripts:

```bash
npm run build      # prisma generate + compile TypeScript to dist/
npm run start      # run the compiled server (what Railway runs)
npm run typecheck  # type-check without emitting output
```

## Environment Variables

See [.env.example](.env.example) for the full list:

| Variable       | Purpose                                                        | Default        |
|----------------|----------------------------------------------------------------|----------------|
| `PORT`         | Port the Express server listens on                             | `3000`         |
| `NODE_ENV`     | `development` or `production`                                  | `development`  |
| `DATABASE_URL` | PostgreSQL connection string                                   | *(required)*   |

## Project Structure

```
src/
  server.ts              Express entry point: mounts routes and static serving
  db.ts                  Singleton PrismaClient
  routes/subscribe.ts    POST /api/subscribe route
  services/
    SubscriberService.ts  Subscriber persistence logic (swap email provider here)
public/
  index.html             Teaser landing page (approved design — do not restyle)
  js/main.js             Client-side subscribe form + localStorage gate
  images/                Hero artwork drops in here when ready
prisma/
  schema.prisma          People model + SubscriptionStatus enum
  migrations/            Migration history committed to the repo
docs/adr/               Architecture decision records
railway.json            Explicit Railway build/start configuration
```

## API

- `GET /health` → `{ "status": "ok" }`
- `POST /api/subscribe` with JSON body `{ "email": string }`
  - `200 { "success": true }` — new or reactivated subscriber written to `people` table
  - `400 { "success": false, "error": "Invalid email" }` — missing or malformed email
  - `500 { "success": false, "error": "Server error" }` — database error

## Deployment (Railway)

- Railway project: `foa-abundance-architecture`
- `main` branch → production (AbundanceArchitecture.world)
- `staging` branch → staging environment
- Build command: `npm run build` · Start command: `npx prisma migrate deploy && npm run start`
  (both configured explicitly in [railway.json](railway.json))

**Required Railway setup (one-time manual steps):**
1. Connect this GitHub repo to the Railway project via the dashboard's GitHub integration.
2. Add the Railway Postgres service's `DATABASE_URL` as a Variable Reference in the app
   service's Variables panel (Railway dashboard → app service → Variables → Add Reference).
3. Set `NODE_ENV=production` in the app service's variables.

## Workflow

Feature branches + pull requests for all changes; no direct pushes to `main` (see
[docs/adr/0002-bootstrap-commit-to-main.md](docs/adr/0002-bootstrap-commit-to-main.md)
for the one exception: the initial scaffold commit).
