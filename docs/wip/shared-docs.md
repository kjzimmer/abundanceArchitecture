# Shared Docs — WIP Spec
*Quick way to share internal documents with a few collaborators via unguessable links, without a
collaborator account level. Started 2026-09-30.*

---

## Decisions (Karl, 2026-09-30)

| Topic | Decision |
|-------|----------|
| Collaborator access | **View + download only.** Only the admin creates folders and uploads (admin → Documents) |
| Links | **Separate secret link per share** (e.g. "Book reviewers", "Advisors"); revoke or regenerate independently |
| Storage | **Cloudflare R2** (S3-compatible). Also to be reused for newsletter images + the logo signature |

## Model

```prisma
model Share        { name, token (64 hex, unique), active, lastAccessAt?, folders[], files[] }
model SharedFolder { shareId, parentId? (null = share root), name }  // @@unique([shareId, parentId, name])
model SharedFile   { shareId, folderId? (null = share root), name, contentType, size, storageKey }
```

- `storageKey` = `shares/<shareId>/<fileId>/<sanitized-name>` in the bucket. Deleting a share, folder or file
  deletes its objects
- **Revoke** = `active=false` (link shows "not available"). **Regenerate link** = new token, old link dies

## Public side

- `GET /s/<token>`: server-rendered page (brand styling) listing the share's folders + files, `?f=<folderId>`
  for subfolders, breadcrumbs. `noindex`, `Referrer-Policy: no-referrer` (the token must not leak via Referer),
  `Cache-Control: no-store`, rate limited
- `GET /s/<token>/file/<fileId>`: R2 → 302 to a 5-minute presigned URL (`Content-Disposition: attachment`).
  Local driver → streamed by the server
- Unknown, revoked or regenerated token → the same generic "This link isn't available" 404, so it doesn't reveal
  whether a share exists

## Admin

- Nav **Documents**: shares list → share view (folder tree + files), create/rename/delete folders, upload
  (multiple files, max 50 MB each), delete files, copy link, revoke/restore, regenerate link, delete share
- API `/api/docs/*` (requireAdmin)

## Storage abstraction

`server/src/lib/storage.ts`: `put / getDownloadUrl / delete`. Drivers: `r2` (prod) and `local` (dev + tests,
`server/.storage/`, gitignored). `STORAGE_DRIVER=r2|local` (default: r2 if R2 vars are set, else local).

## Env (R2)

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
Setup (Karl): Cloudflare → R2 → create bucket `aa-files` (private, no public access) → Manage R2 API tokens →
Create token, **Object Read & Write**, scoped to that bucket → copy Access Key ID, Secret, Account ID → Railway.

## Status

- [x] Code + local test (local driver), 2026-09-30: share/folder/upload/browse/download, UTF-8 names, security headers, token checks (bad, cross-share, revoked, regenerated), 50 MB limit, object cleanup on delete
- [ ] R2 bucket + token + Railway vars
- [ ] Prod test: create share, upload, open link in a private window, download, revoke
