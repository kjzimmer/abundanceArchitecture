// src/routes/sharePages.ts
// Public document shares at /s/<token> (docs/wip/shared-docs.md). Read-only, view-first:
//   /s/<token>                 folder listing (PDFs open in the viewer)
//   /s/<token>/view/<fileId>   in-site PDF viewer — no download/print controls
//   /s/<token>/raw/<fileId>    watermarked PDF bytes for the viewer (server-stamped, never the original)
//   /s/<token>/file/<fileId>   download — only when the share allows it (PDFs watermarked)
// The token is the only credential: no-referrer keeps it out of Referer headers, noindex keeps pages
// out of search engines, no-store keeps them out of shared caches.

import { Router, Request, Response, NextFunction } from 'express';
import * as Docs from '../services/SharedDocsService';
import * as storage from '../lib/storage';
import { WatermarkError } from '../lib/watermark';
import { renderPublicPage } from '../lib/publicPage';
import { escapeHtml } from '../lib/email/layout';
import { brand } from '../lib/brand';

const router = Router();

router.use('/s', (_req: Request, res: Response, next: NextFunction) => {
  res.set({
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store',
  });
  next();
});

const UNAVAILABLE = {
  title: 'Not available',
  heading: 'This link isn’t available',
  message: 'It may have been mistyped, or access may have ended. Please check with the person who shared it.',
};

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type ShareRow = NonNullable<Awaited<ReturnType<typeof Docs.shareByToken>>>;
type FileRow = NonNullable<Awaited<ReturnType<typeof Docs.publicFile>>>;

/** Resolves token + file, or renders the generic 404 and returns null. */
async function resolve(req: Request<{ token: string; fileId: string }>, res: Response): Promise<{ share: ShareRow; file: FileRow } | null> {
  const share = await Docs.shareByToken(req.params.token.toLowerCase());
  const file = share ? await Docs.publicFile(share.id, req.params.fileId) : null;
  if (!share || !file) {
    res.status(404).type('html').send(renderPublicPage(UNAVAILABLE));
    return null;
  }
  return { share, file };
}

function cannotPreview(res: Response) {
  res.status(422).type('html').send(renderPublicPage({
    title: 'Preview not available',
    heading: 'This document can’t be previewed',
    message: 'Please ask the person who shared it for another copy.',
  }));
}

// ─── Listing ─────────────────────────────────────────────────────────────────

router.get('/s/:token', async (req: Request<{ token: string }>, res: Response) => {
  const share = await Docs.shareByToken(req.params.token.toLowerCase());
  if (!share) {
    res.status(404).type('html').send(renderPublicPage(UNAVAILABLE));
    return;
  }
  const folderId = typeof req.query.f === 'string' && req.query.f ? req.query.f : null;
  const listing = await Docs.publicListing(share.id, folderId);
  if (!listing) {
    res.status(404).type('html').send(renderPublicPage(UNAVAILABLE));
    return;
  }

  const base = `/s/${share.token}`;
  const crumbs = [`<a href="${base}">${escapeHtml(share.name)}</a>`,
    ...listing.crumbs.map((c) => `<a href="${base}?f=${encodeURIComponent(c.id)}">${escapeHtml(c.name)}</a>`)].join(' / ');

  const fileRow = (f: (typeof listing.files)[number]) => {
    const meta = `${size(f.size)} · ${f.createdAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}`;
    if (Docs.isPdf(f)) {
      return `<li><a class="row" href="${base}/view/${encodeURIComponent(f.id)}"><span class="icon">📄</span><span class="nm">${escapeHtml(f.name)}</span><span class="meta">${meta}</span></a></li>`;
    }
    if (share.allowDownload) {
      return `<li><a class="row" href="${base}/file/${encodeURIComponent(f.id)}"><span class="icon">📎</span><span class="nm">${escapeHtml(f.name)}</span><span class="meta">download · ${meta}</span></a></li>`;
    }
    return `<li><span class="row muted"><span class="icon">📎</span><span class="nm">${escapeHtml(f.name)}</span><span class="meta">preview not available</span></span></li>`;
  };

  const rows = [
    ...listing.folders.map((f) =>
      `<li><a class="row" href="${base}?f=${encodeURIComponent(f.id)}"><span class="icon">📁</span><span class="nm">${escapeHtml(f.name)}</span><span class="meta"></span></a></li>`),
    ...listing.files.map(fileRow),
  ].join('');

  const html = `
    <style>
      .crumbs { font-family: var(--sans); font-size: 0.8rem; margin: -0.5rem 0 1.5rem; color: var(--ink-light); }
      .crumbs a { color: var(--accent); text-decoration: none; }
      .files { list-style: none; margin: 0; padding: 0; border-top: 1px solid rgba(26,25,23,0.12); }
      .files li { border-bottom: 1px solid rgba(26,25,23,0.12); }
      .row { display: flex; align-items: baseline; gap: 0.75rem; padding: 0.8rem 0.25rem; color: var(--ink); text-decoration: none; }
      a.row:hover { background: rgba(45,74,45,0.05); }
      .muted { color: var(--ink-light); }
      .icon { flex-shrink: 0; }
      .nm { flex: 1; min-width: 0; word-break: break-word; }
      .meta { font-family: var(--sans); font-size: 0.75rem; color: var(--ink-light); white-space: nowrap; }
      .empty { font-family: var(--sans); font-size: 0.85rem; color: var(--ink-light); }
    </style>
    <p class="crumbs">${crumbs}</p>
    ${rows ? `<ul class="files">${rows}</ul>` : '<p class="empty">This folder is empty.</p>'}`;

  res.type('html').send(renderPublicPage({
    title: share.name,
    heading: listing.crumbs.at(-1)?.name ?? share.name,
    message: 'Shared privately and confidentially. Please don’t forward this link.',
    customHtml: html,
  }));
});

// ─── Viewer ──────────────────────────────────────────────────────────────────

router.get('/s/:token/view/:fileId', async (req: Request<{ token: string; fileId: string }>, res: Response) => {
  const found = await resolve(req, res);
  if (!found) return;
  const { share, file } = found;
  if (!Docs.isPdf(file)) {
    cannotPreview(res);
    return;
  }

  const base = `/s/${share.token}`;
  const back = file.folderId ? `${base}?f=${encodeURIComponent(file.folderId)}` : base;
  const raw = `${base}/raw/${encodeURIComponent(file.id)}`;
  const c = brand.colors;
  // JSON for the inline script, with "<" escaped so content can't close the <script> tag
  const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(file.name)} — ${escapeHtml(brand.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #4b4d50; font-family: ${brand.fonts.sans}; -webkit-user-select: none; user-select: none; }
  header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 1rem; padding: 0.65rem 1rem;
           background: ${c.ink}; color: ${c.paper}; font-size: 0.85rem; }
  header a { color: ${c.paper}; text-decoration: none; opacity: 0.8; white-space: nowrap; }
  header a:hover { opacity: 1; }
  header .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
  header .dl { border: 1px solid rgba(238,234,224,0.4); border-radius: 3px; padding: 0.3rem 0.7rem; opacity: 1; }
  #pages { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 18px 12px 40px; }
  canvas { display: block; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,0.45); max-width: 100%; }
  #status { color: #e8e8e8; text-align: center; padding: 3rem 1rem; font-size: 0.95rem; }
  .note { color: #bbb; font-size: 0.72rem; text-align: center; padding-bottom: 1.5rem; }
  @media print { body * { display: none !important; } body::after { content: "Printing is disabled for this document."; display: block; padding: 2rem; } }
</style>
</head>
<body oncontextmenu="return false">
<header>
  <a href="${escapeHtml(back)}">← ${escapeHtml(share.name)}</a>
  <span class="name">${escapeHtml(file.name)}</span>
  ${share.allowDownload ? `<a class="dl" href="${escapeHtml(`${base}/file/${file.id}`)}">Download</a>` : ''}
</header>
<div id="status">Loading document…</div>
<div id="pages"></div>
<p class="note">Confidential — shared privately. Please don’t copy or redistribute.</p>
<script type="module">
  import * as pdfjs from '/vendor/pdfjs/pdf.min.mjs';
  pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';

  // Discourage saving/printing (not DRM — just friction)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['s', 'p'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => e.preventDefault());

  const status = document.getElementById('status');
  const pagesEl = document.getElementById('pages');
  const width = () => Math.min(900, window.innerWidth - 24);

  try {
    const pdf = await pdfjs.getDocument({ url: ${js(raw)}, isEvalSupported: false }).promise;
    status.remove();
    const first = await pdf.getPage(1);
    const ratio = first.getViewport({ scale: 1 }).height / first.getViewport({ scale: 1 }).width;

    // Placeholders sized like page 1; each page renders when scrolled near (keeps big docs light)
    for (let n = 1; n <= pdf.numPages; n++) {
      const cv = document.createElement('canvas');
      cv.dataset.page = String(n);
      cv.style.width = width() + 'px';
      cv.style.height = Math.round(width() * ratio) + 'px';
      pagesEl.appendChild(cv);
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const io = new IntersectionObserver(async (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const cv = entry.target;
        io.unobserve(cv);
        const page = await pdf.getPage(Number(cv.dataset.page));
        const base = page.getViewport({ scale: 1 });
        const cssW = width();
        const viewport = page.getViewport({ scale: (cssW / base.width) * dpr });
        cv.width = viewport.width;
        cv.height = viewport.height;
        cv.style.width = cssW + 'px';
        cv.style.height = Math.round((cssW * base.height) / base.width) + 'px';
        await page.render({ canvas: cv, canvasContext: cv.getContext('2d'), viewport }).promise;
      }
    }, { rootMargin: '1200px 0px' });
    pagesEl.querySelectorAll('canvas').forEach((cv) => io.observe(cv));
  } catch (err) {
    status.textContent = 'This document can’t be previewed. Please ask the person who shared it for another copy.';
  }
</script>
</body>
</html>`);
});

router.get('/s/:token/raw/:fileId', async (req: Request<{ token: string; fileId: string }>, res: Response) => {
  const found = await resolve(req, res);
  if (!found) return;
  const { share, file } = found;
  if (!Docs.isPdf(file)) {
    res.status(404).end();
    return;
  }
  try {
    const pdf = await Docs.stampedPdf(share, file);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdf.length),
      'Content-Disposition': 'inline',
    });
    res.end(pdf);
  } catch (err) {
    if (err instanceof WatermarkError) {
      console.warn(`[docs] cannot stamp ${file.id}: ${err.message}`);
      res.status(422).end();
      return;
    }
    console.error('[docs] raw failed:', err);
    res.status(500).end();
  }
});

// ─── Download (only when the share allows it) ────────────────────────────────

router.get('/s/:token/file/:fileId', async (req: Request<{ token: string; fileId: string }>, res: Response) => {
  const found = await resolve(req, res);
  if (!found) return;
  const { share, file } = found;

  if (!share.allowDownload) {
    res.status(403).type('html').send(renderPublicPage({
      title: 'View only',
      heading: 'Downloads are turned off',
      message: 'This share is view-only.',
      links: Docs.isPdf(file) ? [{ href: `/s/${share.token}/view/${file.id}`, label: 'View the document' }] : [],
    }));
    return;
  }

  try {
    if (Docs.isPdf(file)) {
      // Downloads are watermarked too — the original never leaves the server
      const pdf = await Docs.stampedPdf(share, file);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.length),
        'Content-Disposition': storage.contentDisposition(file.name),
      });
      res.end(pdf);
      return;
    }
    const url = await storage.downloadUrl(file.storageKey, file.name, file.contentType);
    if (url) {
      res.redirect(302, url);
      return;
    }
    res.set({ 'Content-Type': file.contentType, 'Content-Length': String(file.size), 'Content-Disposition': storage.contentDisposition(file.name) });
    storage.localReadStream(file.storageKey)
      .on('error', () => { if (!res.headersSent) res.status(404).end(); })
      .pipe(res);
  } catch (err) {
    if (err instanceof WatermarkError) {
      cannotPreview(res);
      return;
    }
    console.error('[docs] download failed:', err);
    res.status(500).type('html').send(renderPublicPage({ title: 'Error', heading: 'Download failed', message: 'Please try again in a moment.' }));
  }
});

export default router;
