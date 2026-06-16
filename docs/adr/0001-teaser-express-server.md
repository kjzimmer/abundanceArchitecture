# ADR-0001: Teaser served by a single Express app, with a stub subscribe endpoint

- Status: Accepted
- Date: 2026-06-16

## Context

The site will eventually be a full-stack dynamic React app. For now we need only a
static teaser landing page with an email capture form, per the shared teaser-page
pattern (`docs/shared-tech-stack-v1.1.md`). The form needs *some* backend to post to,
but no email service has been chosen yet.

## Decision

- Serve `public/index.html` as a static file from a single Express/TypeScript app
  (`src/server.ts`), rather than deploying it as a pure static site.
- Add a `POST /api/subscribe` endpoint that validates the email format, logs the
  submission to stdout (visible in Railway logs), and returns
  `{ success: true }` / `{ success: false, error: 'Invalid email' }`. It does not
  call any email service.
- Add a `GET /health` endpoint for Railway health checks.

## Consequences

- The same Express app this teaser runs on is the one the full site will grow into —
  no migration to a different server later, just more routes added alongside it.
- Subscribe submissions are not currently persisted or emailed anywhere beyond the
  Railway log stream. Wiring a real email service (Mailchimp/ConvertKit/Buttondown,
  per the still-open decision in the shared tech stack doc) only requires changing
  the body of this one handler.
