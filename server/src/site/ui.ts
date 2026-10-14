// src/site/ui.ts
// Small building blocks shared by the record pages: breadcrumbs, enum labels, record lists.

import type { Content } from '../content/load';
import type { EnumItem, Initiative, Question, VitalSign } from '../content/types';
import { html, Html, ph, text } from './html';
import { lockIcon } from './layout';

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

/** A single query-string value. Repeated keys (hidden current value + clicked button) resolve to the last */
export function queryValue(query: Record<string, unknown>, key: string): string {
  const v = query[key];
  const last = Array.isArray(v) ? v[v.length - 1] : v;
  return typeof last === 'string' ? last.trim() : '';
}

export function selectFilter(
  id: string, label: string, name: string, allLabel: string,
  options: { value: string; label: string }[], current: string,
): Html {
  return html`<div class="filter-field">
  <label for="${id}">${label}</label>
  <select id="${id}" name="${name}" data-autosubmit>
    <option value="">${allLabel}</option>
    ${options.map((o) => html`<option value="${o.value}"${o.value === current ? html` selected` : ''}>${o.label}</option>`)}
  </select>
</div>`;
}

export function domainOptions(c: Content): { value: string; label: string }[] {
  return c.domains.map((d) => ({ value: d.slug, label: d.name }));
}

/** "Members can …" notice with the lock, linking to Join (member actions are inactive in the draft) */
export function membersNotice(textLabel: string, linkLabel = 'Join'): Html {
  return html`<p class="members-notice"><span class="members-only-inline">${lockIcon}${textLabel}</span> <a href="/join">${linkLabel}</a></p>`;
}

/**
 * Related panel on every record page (brief §8): questions, vital signs, initiatives and learning material
 * sharing a domain (or, for initiatives, a form) with the record. Computed, never hand-maintained.
 */
export function relatedPanel(
  c: Content,
  tags: { domains?: string[]; forms?: string[] },
  exclude: { slug: string },
): Html {
  const r = c.related(tags, exclude);
  const domainNames = (tags.domains ?? []).map((s) => c.domain(s)?.name ?? s);
  const basis = [
    domainNames.length ? `the ${domainNames.join(' or ')} domain${domainNames.length > 1 ? 's' : ''}` : '',
    tags.forms?.length ? 'the same form' : '',
  ].filter(Boolean).join(' or ');
  return html`<div class="panel related">
  <h2>Related</h2>
  ${basis ? html`<p class="hint">Records sharing ${basis}</p>` : html`<p class="hint">${ph('[NO DOMAIN TAG YET]')}</p>`}
  <h3>Questions</h3>${questionList(r.questions)}
  <h3>Vital Signs</h3>${signList(c, r.signs)}
  <h3>Initiatives</h3>${initiativeList(c, r.initiatives)}
  <h3>Learn</h3>${noneYet('[LEARNING MATERIAL, AFTER FIRST LAUNCH]')}
</div>`;
}

/** Learning material has no collection yet (the Learn commons comes after first launch) */
export function learningPlaceholder(): Html {
  return html`<div class="record-group record-group-later">
  <h3>Learn</h3>
  <p class="after-launch">After first launch</p>
  <p>${ph('[LEARNING MATERIAL FROM THE COMMONS]')}</p>
</div>`;
}
