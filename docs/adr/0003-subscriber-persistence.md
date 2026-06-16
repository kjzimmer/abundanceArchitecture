# ADR-0003: Subscriber persistence via Postgres + Prisma 6, scoped per site

- Status: Accepted
- Date: 2026-06-16

## Context

The teaser phase initially had no database (documented as "No database for teaser phase"
in CLAUDE.md). As the project moved to production, persisting subscriber emails became
the first real data requirement. Options considered:

- **Formspree** (used on a sibling FoA site): third-party form backend, fast to wire
  but ties the subscriber list to an external service with no schema control.
- **Self-hosted Postgres**: aligned with the existing Railway Postgres plugin already
  provisioned in the project.

For the ORM, the shared tech stack doc lists Prisma and Drizzle as preferred options;
Prisma was chosen per the user's stated preference.

## Decision

- Use the Railway Postgres instance (already provisioned in `foa-abundance-architecture`).
- Prisma 6 for schema management and the DB client (generated into `src/generated/prisma/`,
  which is gitignored and regenerated on every `npm install` and `npm run build`).
- `people` table scoped to this site only (see ADR-0004 on cross-site topology). A
  `source_site` column defaults to `'abundance-architecture'` for forward-compatibility
  if rows are ever migrated to a shared DB.
- Migrations run at boot via `npx prisma migrate deploy` (see `railway.json`), so no
  separate migration step is required in the Railway deployment pipeline.
- Subscriber persistence is wrapped in `SubscriberService` (mirroring the `PaymentService`
  pattern in the shared tech stack doc), so the route layer stays independent of whether
  the backing store is Postgres, a third-party email API, or both simultaneously later.

## Consequences

- Dropping Formspree means subscriber data stays in infrastructure we control.
- Running `prisma migrate deploy` at startup means the app won't start if the DB is
  unreachable or if a migration fails — acceptable at current scale, revisit if
  blue-green deploys become needed.
- `DATABASE_URL` must be set in the Railway app service's environment (via Variable
  Reference to the Postgres plugin) and in the local `.env` for development.
- Prisma 6 requires Node >=20.19 or >=22. Production Railway runs a current LTS Node
  image that satisfies this. Local development currently uses Node 20.12.2 (below the
  Prisma 7 threshold), so Prisma is pinned to `^6` in `package.json`.
