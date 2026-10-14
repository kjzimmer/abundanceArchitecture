// src/site/ui.ts
// Small building blocks shared by the record pages: breadcrumbs, enum labels, record lists.

import type { Content } from '../content/load';
import type { EnumItem, Initiative, Question, VitalSign } from '../content/types';
import { html, Html, ph, text } from './html';

export function breadcrumb(items: { label: string; href?: string }[]): Html {
  return html`<nav class="breadcrumb" aria-label="Breadcrumb"><ol>
  ${items.map((i) => html`<li>${i.href ? html`<a href="${i.href}">${i.label}</a>` : html`<span aria-current="page">${i.label}</span>`}</li>`)}
</ol></nav>`;
}

/** Label for an enum id; an unknown or missing id renders as a placeholder */
export function enumLabel(list: EnumItem[], id: string | null | undefined): Html {
  const item = id ? list.find((e) => e.id === id) : undefined;
  return item ? html`${item.label}` : ph('[NOT YET SET]');
}

export function formLabels(c: Content, forms: string[] | null | undefined): Html {
  if (!forms || !forms.length) return ph('[FORM]');
  return html`${forms.map((f, i) => html`${i ? ', ' : ''}${enumLabel(c.enums.forms, f)}`)}`;
}

export function domainLinks(c: Content, slugs: string[]): Html {
  if (!slugs.length) return ph('[DOMAIN]');
  return html`${slugs.map((s, i) => {
    const d = c.domain(s);
    return html`${i ? ', ' : ''}${d ? html`<a href="/domains/${d.slug}">${d.name}</a>` : s}`;
  })}`;
}

/** Shown where a computed list has nothing yet */
export function noneYet(label = '[NONE YET]'): Html {
  return html`<p class="list-empty">${ph(label)}</p>`;
}

export function questionList(qs: Question[]): Html {
  if (!qs.length) return noneYet();
  return html`<ul class="record-list">${qs.map((q) => html`<li><a href="/questions/${q.slug}">${q.question}</a></li>`)}</ul>`;
}

export function signList(c: Content, signs: VitalSign[]): Html {
  if (!signs.length) return noneYet();
  return html`<ul class="record-list">${signs.map((s) => html`<li>
    <a href="/vital-signs/${s.slug}">${s.name}</a>
    <span class="meta">${s.reading ? text(s.reading) : enumLabel(c.enums.vitalSignStatuses, s.status)}</span>
  </li>`)}</ul>`;
}

export function initiativeList(c: Content, list: Initiative[]): Html {
  if (!list.length) return noneYet();
  return html`<ul class="record-list">${list.map((i) => html`<li>
    <a href="/initiatives/${i.slug}">${i.name}</a>
    <span class="meta">${enumLabel(c.enums.whose, i.whose)} · ${enumLabel(c.enums.initiativeStages, i.stage)}</span>
  </li>`)}</ul>`;
}

/** Learning material has no collection yet (the Learn commons comes after first launch) */
export function learningPlaceholder(): Html {
  return html`<div class="record-group record-group-later">
  <h3>Learn</h3>
  <p class="after-launch">After first launch</p>
  <p>${ph('[LEARNING MATERIAL FROM THE COMMONS]')}</p>
</div>`;
}
