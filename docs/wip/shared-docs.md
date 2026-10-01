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
- [x] R2 bucket `aa-files` (private) + token + Railway vars, verified 2026-10-01 (put, presigned get 200, unsigned get denied, delete)
- [x] Prod: Karl created "book collaboration" + uploaded a PDF (2026-10-01)
- [ ] Prod: view-only viewer + watermark check (PR "docs view-only")

## View-only + watermarking (Karl, 2026-10-01)

Goal: discourage copying (not DRM: a screen can always be photographed). Karl uploads PDFs, not editable
formats. Future: when R2 becomes the primary document repository, originals stay unmodified and every
served copy is stamped. That's exactly how this works already.

- **Per share `allowDownload`** (default **off** = view-only). Existing shares became view-only on deploy
- **Viewer** `/s/<token>/view/<fileId>`: self-hosted PDF.js (`/vendor/pdfjs`, no CDN) renders pages to canvas
  with lazy page rendering. No download/print controls, right-click, Ctrl+S/P and drag blocked, print CSS
  blanks the page, no text selection. Download button only when the share allows it
- **Server-side watermark** (`lib/watermark.ts`, pdf-lib): every PDF that leaves the server (view or
  download) is stamped with a large diagonal `watermarkText` (default `Confidential · {share name}`, max 80,
  WinAnsi-safe) plus a dated footer. Originals in storage are never modified. Any stamping failure
  (encrypted, corrupt) → not served (never falls back to the original)
- **Non-PDF files**: view-only share → hidden from collaborators (admin sees a note). Downloads allowed →
  downloadable but **not watermarked** (admin note)
- Watermark identifies the **share**, not the person. Per-person links would be needed to trace an individual
- Each view re-stamps, which is fine for docs of a few MB. Cache stamped copies if large files arrive

## Deferred: images (discussed 2026-10-01)

Today images are non-PDF files: hidden on view-only shares, unwatermarked download when downloads are on.
Workaround: put images into a PDF before uploading (they then get the viewer + watermark).
When needed: **JPG/PNG** → at serve time, wrap the image in a page sized to it with pdf-lib (`embedJpg`/`embedPng`),
stamp the same watermark, show in the same viewer (originals untouched, ~1h). **HEIC/WebP/GIF/TIFF** need
`sharp` (native image library) to convert/watermark, or convert before upload.
