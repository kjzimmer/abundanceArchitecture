# ADR-0004: One Railway project per site; no shared mega-project

- Status: Accepted
- Date: 2026-06-16

## Context

The FoA ecosystem currently has three sites: AbundanceArchitecture.world (this repo),
FreeMarketWatch.world (live, separate repo), and HealthUnveiled.world (in development).
All three may eventually need to share subscriber/user data. Railway supports putting
multiple app services into one project, which would give private networking between them.

## Decision

Keep one Railway project per site (the status quo). If/when cross-site data sharing is
needed, stand up a dedicated internal "accounts" service in its own project and have
each site call it over HTTPS — rather than merging existing projects.

## Consequences

- **Why not merge into one project now:** FreeMarketWatch is already live in its own
  project; migrating it would disrupt a live site for no gain today. More critically,
  the shared tech stack explicitly applies to client/retail web dev too — client projects
  must remain fully isolated (separate billing, separate infra, transferable). Merging
  personal FoA sites into one project sets a precedent that conflicts with client work.
- **Path to sharing when it's needed:** a lightweight accounts service (its own repo,
  its own Railway project) that the other sites call via HTTPS gives shared data access
  without private-network coupling and without restructuring existing projects. This also
  seeds the real identity/auth layer (Clerk integration) when that work begins.
- If all three FoA sites needed sharing urgently today, the simpler shortcut would be
  to expose the shared Postgres with Railway's public TCP proxy and pass the connection
  string to the other services — but that means the DB is internet-reachable, which is
  a weaker security posture than the accounts-service approach.
