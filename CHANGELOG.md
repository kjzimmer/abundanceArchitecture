# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Initial teaser landing page scaffold: Express/TypeScript server, static
  `public/index.html`, `POST /api/subscribe` stub, `GET /health`, Railway
  deploy config.
- Subscriber persistence: Postgres via Prisma 6, `people` table with
  `SubscriptionStatus` enum and `source_site` forward-compat column.
- `SubscriberService` wrapping all DB writes; route layer calls the service,
  not Prisma directly.
- Client-side subscribe form (`public/js/main.js`): fetch POST, localStorage
  gate for returning subscribers, inline error display.
- Server/client code split: `src/db.ts`, `src/routes/subscribe.ts`,
  `src/services/SubscriberService.ts` extracted from the original `server.ts`.
