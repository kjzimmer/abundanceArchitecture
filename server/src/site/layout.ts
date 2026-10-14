// src/site/layout.ts
// Page shell for every site-draft page: draft banner, menu, footer. Menu and footer order are fixed by
// the brief (docs/wip/site-draft/BRIEF.md §5). Styles: public/site/site.css (teaser tokens carried over).

import { brand } from '../lib/brand';
import { html, Html } from './html';
import type { Reviewer } from './review';

export const MENU: { href: string; label: string }[] = [
  { href: '/domains', label: 'Domains' },
  { href: '/questions', label: 'Questions' },
  { href: '/learn', label: 'Learn' },
  { href: '/vital-signs', label: 'Vital Signs' },
  { href: '/initiatives', label: 'Initiatives' },
  { href: '/book', label: 'Book' },
  { href: '/report', label: 'Report' },
];

const FOOTER: { href: string; label: string; external?: boolean }[] = [
  { href: '/about', label: 'About' },
  { href: '/ask', label: 'Ask a question' },
  { href: '/references', label: 'References' },
  { href: '/licence', label: 'Licence' },
  { href: 'https://freemarketwatch.world', label: 'FreeMarketWatch.world', external: true },
];

export interface PageInput {
  /** <title> prefix; omit on Home */
  title?: string;
  /** Request path, for the current menu item */
  path: string;
  reviewer: Reviewer | null;
  /** Number of flagged records, shown to the owner only */
  flagCount?: number;
  body: Html;
}

/** The members-only lock used beside inactive member actions */
export const lockIcon = html`<svg class="lock" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>`;

export function renderPage({ title, path, reviewer, flagCount, body }: PageInput): string {
  const current = (href: string) => path === href || path.startsWith(href + '/');
  const pageTitle = title ? `${title} — ${brand.name}` : brand.name;

  return `<!DOCTYPE html>
${html`<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${pageTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/site/site.css">
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="draft-banner" role="note">
  <span>Draft for review. Not yet public.</span>
  ${reviewer?.role === 'owner'
    ? html`<a href="/review/flags">Draft flags${flagCount != null ? html` (${flagCount})` : ''}</a>`
    : ''}
</div>
<header class="masthead">
  <a class="masthead-title" href="/">${brand.name}</a>
  <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu">Menu</button>
  <nav id="site-menu" class="site-menu" aria-label="Main">
    <ul class="menu-sections">
      ${MENU.map((m) => html`<li><a href="${m.href}"${current(m.href) ? html` aria-current="page"` : ''}>${m.label}</a></li>`)}
    </ul>
    <div class="menu-account">
      <a href="/sign-in"${current('/sign-in') ? html` aria-current="page"` : ''}>Sign in</a>
      <a class="button-join" href="/join">Join</a>
    </div>
  </nav>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <ul>
    ${FOOTER.map((f) => f.external
      ? html`<li><a href="${f.href}" rel="noopener">${f.label} <span aria-hidden="true">↗</span></a></li>`
      : html`<li><a href="${f.href}">${f.label}</a></li>`)}
  </ul>
</footer>
<script src="/site/site.js" defer></script>
</body>
</html>`}`;
}
