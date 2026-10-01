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
- [x] Prod: view-only viewer + server-side watermark verified by Karl (#24); watermark darkened to gray 0.4 /
      opacity 0.3 after review (#25), 2026-10-01
- **Shipped:** PRs #23 (shares + R2), #24 (view-only viewer + watermark), #25 (darker watermark)

## Open items (paused 2026-10-01; Karl to decide when to resume)

1. **Video for draft reviews** (likely needed soon: 2-min shorts reviewed by collaborators before final
   versions). Discussed options:
   - **A. R2 + in-site player (recommended for drafts):** direct browser→R2 presigned upload (needs bucket
     CORS; files ~50–200 MB exceed the 50 MB server upload path), player with download/PiP/right-click
     disabled, Range-request streaming for seeking. Export review cuts as **MP4 (H.264)**: HEVC/MOV doesn't
     play in Chrome on Windows. Watermark = **"DRAFT · Confidential" burned in by Karl's editor** at export
   - **B. Cloudflare Stream** (~$5/mo min): adaptive streaming, auto-transcoding, signed/expiring playback,
     domain lock, watermark profiles. Better fit later for **public** videos on the site
   - Open question for Karl: editor export format/size; which option
2. **Images:** see "Deferred: images" below (JPG/PNG → wrap in watermarked PDF page for the viewer)
3. **Watermark strength per share** (light/medium/strong) if one fixed level stops fitting
4. **Per-person links** (e.g. "Book collaboration · Jane Smith") so a leaked copy identifies the individual
5. **Cache stamped PDFs** in R2 if large files make per-view stamping slow
6. **Porting:** add a shared-docs section to `email-porting-guide.md` (or its own guide) before HU/FMW
7. When Karl confirms it's done: notify for archiving this spec

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
