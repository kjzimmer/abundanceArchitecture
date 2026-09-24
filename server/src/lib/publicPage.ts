// src/lib/publicPage.ts
// Minimal server-rendered pages (confirm / unsubscribe) using the teaser page's design tokens.
// Standalone — public/index.html is frozen and not touched.

import { escapeHtml } from './email/layout';

interface PageInput {
  title: string;
  heading: string;
  message: string;           // plain text — escaped
  form?: {
    action: string;
    token: string;
    button: string;
  };
}

export function renderPublicPage({ title, heading, message, form }: PageInput): string {
  const formHtml = form
    ? `<form method="post" action="${escapeHtml(form.action)}">
        <input type="hidden" name="t" value="${escapeHtml(form.token)}">
        <button type="submit">${escapeHtml(form.button)}</button>
      </form>`
    : `<a class="home" href="/">Return to abundancearchitecture.world</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} — Abundance Architecture</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  /* Tokens mirror public/index.html :root */
  :root { --ink: #1a1917; --ink-light: #6b6764; --paper: #eeeae0; --accent: #2d4a2d;
          --serif: 'EB Garamond', Georgia, serif; --sans: 'Inter', system-ui, sans-serif; }
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
  button:hover { background: #1e3a1e; }
  .home { font-family: var(--sans); font-size: 0.8rem; color: var(--accent); }
</style>
</head>
<body>
<header class="masthead"><a href="/">Abundance Architecture</a></header>
<main>
  <h1>${escapeHtml(heading)}</h1>
  <p>${escapeHtml(message)}</p>
  ${formHtml}
</main>
</body>
</html>`;
}
