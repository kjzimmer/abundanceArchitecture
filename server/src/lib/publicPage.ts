// src/lib/publicPage.ts
// Minimal server-rendered pages (confirm / unsubscribe) styled from lib/brand.ts.
// Standalone — public/index.html is frozen and not touched.

import { escapeHtml } from './email/layout';
import { brand } from './brand';

const c = brand.colors;

interface PageInput {
  title: string;
  heading: string;
  message: string;           // plain text — escaped
  form?: {
    action: string;
    token: string;
    button: string;
  };
  // Trusted, already-escaped HTML rendered in place of `form` (e.g. the preferences form)
  customHtml?: string;
  // Clears the home page's "already subscribed" flag (public/js/main.js) so the
  // subscribe form re-enables in this browser after unsubscribing
  clearSubscribedFlag?: boolean;
  // Extra links under the content, e.g. "Manage preferences"
  links?: { href: string; label: string }[];
}

export function renderPublicPage({ title, heading, message, form, customHtml, clearSubscribedFlag, links = [] }: PageInput): string {
  const clearScript = clearSubscribedFlag
    ? `<script>try { localStorage.removeItem(${JSON.stringify(brand.subscribedStorageKey)}); } catch (e) {}</script>`
    : '';
  const formHtml = customHtml
    ? customHtml
    : form
    ? `<form method="post" action="${escapeHtml(form.action)}">
        <input type="hidden" name="t" value="${escapeHtml(form.token)}">
        <button type="submit">${escapeHtml(form.button)}</button>
      </form>`
    : `<a class="home" href="/">Return to ${escapeHtml(brand.domain)}</a>`;
  const linksHtml = links.length
    ? `<p class="links">${links.map((l) => `<a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`).join(' · ')}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} — ${escapeHtml(brand.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${escapeHtml(brand.fonts.googleFontsHref)}" rel="stylesheet">
<style>
  :root { --ink: ${c.ink}; --ink-light: ${c.inkLight}; --paper: ${c.paper}; --accent: ${c.accent};
          --accent-hover: ${c.accentHover}; --serif: ${brand.fonts.serif}; --sans: ${brand.fonts.sans}; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 18px; }
  body { min-height: 100vh; background: var(--paper); color: var(--ink); font-family: var(--serif);
         line-height: 1.7; -webkit-font-smoothing: antialiased; display: flex; flex-direction: column; }
  .masthead { background: var(--ink); padding: 1.5rem 2rem; box-shadow: 0 1px 6px rgba(0,0,0,0.18); }
  .masthead a { font-family: var(--sans); font-size: 0.75rem; font-weight: 500; letter-spacing: 0.12em;
                text-transform: uppercase; color: var(--paper); text-decoration: none; }
  main { flex: 1; width: 100%; max-width: 760px; margin: 0 auto; padding: 6rem 2rem 5rem; }
  h1 { font-weight: 400; font-size: clamp(2rem, 5vw, 2.8rem); line-height: 1.15; margin-bottom: 1.2rem; }
  p { color: var(--ink-light); font-size: 1.05rem; margin-bottom: 2rem; max-width: 34em; }
  button { background: var(--accent); color: #fff; border: none; border-radius: 2px; padding: 0.8rem 1.8rem;
           font-family: var(--sans); font-size: 0.72rem; font-weight: 500; letter-spacing: 0.1em;
           text-transform: uppercase; cursor: pointer; }
  button:hover { background: var(--accent-hover); }
  .home { font-family: var(--sans); font-size: 0.8rem; color: var(--accent); }
  .links { margin-top: 2rem; font-family: var(--sans); font-size: 0.8rem; }
  .links a { color: var(--accent); }
  .lists { list-style: none; margin: 0 0 2rem; padding: 0; border-top: 1px solid rgba(26,25,23,0.12); }
  .lists li { border-bottom: 1px solid rgba(26,25,23,0.12); }
  .lists label { display: flex; gap: 0.9rem; align-items: flex-start; padding: 1rem 0; cursor: pointer; }
  .lists input { margin-top: 0.45rem; width: 1.05rem; height: 1.05rem; accent-color: var(--accent); flex-shrink: 0; }
  .lists strong { display: block; font-weight: 400; font-size: 1.1rem; }
  .lists span { display: block; color: var(--ink-light); font-size: 0.92rem; }
  .saved { font-family: var(--sans); font-size: 0.8rem; color: var(--accent); margin-bottom: 1.5rem; }
  .secondary { background: transparent; color: var(--ink-light); border: 1px solid rgba(26,25,23,0.2); margin-left: 0.5rem; }
  .secondary:hover { background: transparent; color: var(--ink); }
</style>
</head>
<body>
<header class="masthead"><a href="/">${escapeHtml(brand.name)}</a></header>
<main>
  <h1>${escapeHtml(heading)}</h1>
  <p>${escapeHtml(message)}</p>
  ${formHtml}
  ${linksHtml}
</main>
${clearScript}
</body>
</html>`;
}
