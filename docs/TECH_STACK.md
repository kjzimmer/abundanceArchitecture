# Tech Stack — Abundance Architecture
*Site-specific additions and deviations from `shared/SHARED_TECH_STACK.md`.*
*Read SHARED_TECH_STACK.md first; this doc only covers what differs.*

---

## Version Pins

Both pins are driven by local development Node version (20.12.2 < 20.19 threshold).
Railway runs Node 24 and is compatible with both newer and pinned versions.

| Package | Pinned version | Reason |
|---------|---------------|--------|
| `prisma` / `@prisma/client` | `^6` | Prisma 7 requires Node ≥20.19 |
| `vite` / `@vitejs/plugin-react` | `^5` / `^4` | Vite 8 requires Node ≥20.19 |

When local Node is upgraded past 20.19, unpin both and upgrade together.

---

## Admin SPA Build Output

The Vite build output (`public/admin/`) is committed to git rather than being
gitignored and rebuilt at deploy time. This is intentional: Railway's build step
runs `npm run build` which rebuilds it anyway, but having it committed means the
site is always in a deployable state from any checkout.

**Implication:** After any change to admin source files, run `npm run build:admin`
and commit the updated `public/admin/` alongside the source changes.

---

## No Deviations

The following shared stack decisions apply to this site without deviation:

- TypeScript strict mode
- Express 5
- Prisma 6 with `migrate dev` / `migrate deploy` workflow
- `provider = "prisma-client-js"` in schema generator
- PostgreSQL on Railway
- bcryptjs + jsonwebtoken for admin auth
- express-rate-limit for public endpoints
- Cloudflare Zone Analytics
