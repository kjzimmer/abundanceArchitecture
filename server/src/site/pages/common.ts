// src/site/pages/common.ts
// Small pages shared across the draft: not found, Sign in (inactive until member accounts exist),
// and the temporary stub for sections still to be built.

import { html, ph, Html } from '../html';

export interface PageBody {
  title?: string;
  body: Html;
}

export function notFoundPage(): PageBody {
  return {
    title: 'Not found',
    body: html`<div class="page">
  <h1>Not found</h1>
  <p>There is no page at this address. <a href="/">Go to the home page</a>.</p>
</div>`,
  };
}

export function signInPage(): PageBody {
  return {
    title: 'Sign in',
    body: html`<div class="page">
  <h1>Sign in</h1>
  <p class="after-launch">After first launch</p>
  <p>Member accounts are not open yet. <a href="/join">Become a founding member</a>.</p>
</div>`,
  };
}

/** Placeholder for a section not yet built in this draft (replaced stage by stage) */
export function stubPage(title: string): PageBody {
  return {
    title,
    body: html`<div class="page">
  <h1>${title}</h1>
  <p>${ph('[PAGE STILL TO BE BUILT IN THIS DRAFT]')}</p>
</div>`,
  };
}
