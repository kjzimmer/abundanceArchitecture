// src/routes/sharePages.ts
// Public, read-only document shares at /s/<token> (docs/wip/shared-docs.md).
// The token is the only credential: no-referrer keeps it out of Referer headers when a file is
// opened, noindex keeps pages out of search engines, no-store keeps them out of shared caches.

import { Router, Request, Response, NextFunction } from 'express';
import * as Docs from '../services/SharedDocsService';
import * as storage from '../lib/storage';
import { renderPublicPage } from '../lib/publicPage';
import { escapeHtml } from '../lib/email/layout';

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

  const rows = [
    ...listing.folders.map((f) =>
      `<li><a class="row" href="${base}?f=${encodeURIComponent(f.id)}"><span class="icon">📁</span><span class="nm">${escapeHtml(f.name)}</span><span class="meta"></span></a></li>`),
    ...listing.files.map((f) =>
      `<li><a class="row" href="${base}/file/${encodeURIComponent(f.id)}"><span class="icon">📄</span><span class="nm">${escapeHtml(f.name)}</span><span class="meta">${size(f.size)} · ${f.createdAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}</span></a></li>`),
  ].join('');

  const html = `
    <style>
      .crumbs { font-family: var(--sans); font-size: 0.8rem; margin: -0.5rem 0 1.5rem; color: var(--ink-light); }
      .crumbs a { color: var(--accent); text-decoration: none; }
      .files { list-style: none; margin: 0; padding: 0; border-top: 1px solid rgba(26,25,23,0.12); }
      .files li { border-bottom: 1px solid rgba(26,25,23,0.12); }
      .row { display: flex; align-items: baseline; gap: 0.75rem; padding: 0.8rem 0.25rem; color: var(--ink); text-decoration: none; }
      .row:hover { background: rgba(45,74,45,0.05); }
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
    message: 'Shared privately. Please don’t forward this link.',
    customHtml: html,
  }));
});

router.get('/s/:token/file/:fileId', async (req: Request<{ token: string; fileId: string }>, res: Response) => {
  const share = await Docs.shareByToken(req.params.token.toLowerCase());
  const file = share ? await Docs.publicFile(share.id, req.params.fileId) : null;
  if (!share || !file) {
    res.status(404).type('html').send(renderPublicPage(UNAVAILABLE));
    return;
  }
  try {
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
    console.error('[docs] download failed:', err);
    res.status(500).type('html').send(renderPublicPage({ title: 'Error', heading: 'Download failed', message: 'Please try again in a moment.' }));
  }
});

export default router;
