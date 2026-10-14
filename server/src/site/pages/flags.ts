// src/site/pages/flags.ts
// Owner-only list of records and files flagged `draft: true` or carrying a `note` (brief §9 "Draft flags").
// Reviewers never see this page or the flags.

import type { Content } from '../../content/load';
import { html } from '../html';
import type { PageBody } from './common';

const COLLECTION_LABELS: Record<string, string> = {
  file: 'Files',
  domains: 'Domains',
  questions: 'Questions',
  'vital-signs': 'Vital signs',
  initiatives: 'Initiatives',
  references: 'References',
};

export function flagsPage(c: Content): PageBody {
  const groups = Object.keys(COLLECTION_LABELS)
    .map((key) => ({ key, label: COLLECTION_LABELS[key], items: c.flags.filter((f) => f.collection === key) }))
    .filter((g) => g.items.length);

  return {
    title: 'Draft flags',
    body: html`<div class="page">
  <p class="eyebrow">Only you see this page</p>
  <h1>Draft flags</h1>
  <p>Records marked as drafts or carrying a note in <code>content/</code>. Edit the file, then deploy.
  ${c.warnings.length ? html`${c.warnings.length} content warnings below.` : ''}</p>
  ${c.warnings.length ? html`<section class="flag-group">
    <h2>Content warnings</h2>
    <ul class="flag-list">${c.warnings.map((w) => html`<li>${w}</li>`)}</ul>
  </section>` : ''}
  ${groups.map((g) => html`<section class="flag-group">
    <h2>${g.label} <span class="count">${g.items.length}</span></h2>
    <ul class="flag-list">
      ${g.items.map((f) => html`<li>
        ${f.href ? html`<a href="${f.href}">${f.label}</a>` : html`<strong>${f.label}</strong>`}
        ${f.draft ? html`<span class="chip">Draft</span>` : ''}
        ${f.note ? html`<p class="flag-note">${f.note}</p>` : ''}
      </li>`)}
    </ul>
  </section>`)}
</div>`,
  };
}
