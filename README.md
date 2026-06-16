# Abundance Architecture

Teaser landing page and Express server for [AbundanceArchitecture.world](https://abundancearchitecture.world).

This is phase one of the site: a static landing page served by a small TypeScript/Express
app, with an email capture form wired to a stub endpoint. No database, no auth, no React
build step yet — see [docs/CLAUDE.md](docs/CLAUDE.md) and
[docs/shared-tech-stack-v1.1.md](docs/shared-tech-stack-v1.1.md) for the fuller plan and
the upgrade path to the full dynamic site.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The dev server runs on `http://localhost:3000` (or `PORT` from `.env`) and restarts on
file changes.

Other scripts:

```bash
npm run build      # compile TypeScript to dist/
npm run start      # run the compiled server (what Railway runs)
npm run typecheck  # type-check without emitting output
```

## Environment Variables

See [.env.example](.env.example) for the current list:

| Variable   | Purpose                                  | Default       |
|------------|-------------------------------------------|---------------|
| `PORT`     | Port the Express server listens on        | `3000`        |
| `NODE_ENV` | `development` or `production`             | `development` |

## Project Structure

```
src/server.ts        Express app: static file serving + /api/subscribe + /health
public/index.html    Teaser landing page (approved design — do not restyle)
public/images/        Hero artwork drops in here when ready (no slot wired yet)
docs/adr/             Architecture decision records
railway.json          Explicit Railway build/start configuration
```

## API

- `GET /health` → `{ "status": "ok" }`
- `POST /api/subscribe` with JSON body `{ "email": string }`
  - `200 { "success": true }` on a valid email (logged to console; no email
    service is wired up yet — see [docs/adr/0001-teaser-express-server.md](docs/adr/0001-teaser-express-server.md))
  - `400 { "success": false, "error": "Invalid email" }` otherwise

## Deployment (Railway)

- Railway project: `foa-abundance-architecture`
- `main` branch deploys to production (AbundanceArchitecture.world)
- `staging` branch deploys to a staging environment
- Build command: `npm run build` · Start command: `npm run start`
  (configured explicitly in [railway.json](railway.json))
- Set `PORT` and `NODE_ENV=production` in the Railway service's environment variables

Connecting the GitHub repo to the Railway project (via the Railway dashboard's GitHub
integration) is a one-time manual step and isn't automated here.

## Workflow

Feature branches + pull requests for all changes; no direct pushes to `main` (see
[docs/adr/0002-bootstrap-commit-to-main.md](docs/adr/0002-bootstrap-commit-to-main.md)
for the one exception: this repo's initial scaffold commit).
