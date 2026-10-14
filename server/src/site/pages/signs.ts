// src/site/pages/signs.ts
// Vital Signs overview and one sign. No sign has a reading yet: none is shown, and none may be invented.
// A sign that lives on another site (FreeMarketWatch) links out.

import type { Content } from '../../content/load';
import type { VitalSign } from '../../content/types';
import { citationNote } from '../citation';
import { html, ph, text } from '../html';
import { lockIcon } from '../layout';
import { breadcrumb, domainLinks, enumLabel, relatedPanel } from '../ui';
import type { PageBody } from './common';

// The Home card's wording for Vital Signs
const INTRO = 'A small set of measures, read regularly, asking one question: are we moving toward abundance or away from it?';

function reading(s: VitalSign) {
  return text(s.reading, '[NO READING YET]');
}

function externalLink(s: VitalSign) {
  if (!s.externalUrl) return '';
  const host = new URL(s.externalUrl).hostname.replace(/^www\./, '');
  return html`<a class="text-link" href="${s.externalUrl}" rel="noopener">See it on ${host}</a>`;
}

export function signsPage(c: Content): PageBody {
  return {
    title: 'Vital Signs',
    body: html`<div class="page page-wide">
  ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'Vital Signs' }])}
  <h1>Vital Signs</h1>
  <p class="intro">${INTRO}</p>
  <ul class="cards cards-2 sign-cards">
    ${c.signs.map((s) => html`<li class="card">
      <h2><a href="/vital-signs/${s.slug}">${s.name}</a></h2>
      <p class="card-text">${text(s.definition, '[DEFINITION]')}</p>
      <dl class="facts">
        <dt>Latest reading</dt><dd>${reading(s)}</dd>
        <dt>Status</dt><dd>${enumLabel(c.enums.vitalSignStatuses, s.status)}</dd>
      </dl>
      ${externalLink(s)}
    </li>`)}
  </ul>
</div>`,
  };
}

export function signPage(c: Content, s: VitalSign): PageBody {
  const next = c.signs[(c.signs.indexOf(s) + 1) % c.signs.length];
  const sources = s.sources ?? [];

  return {
    title: s.name,
    body: html`<div class="page page-wide">
  ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'Vital Signs', href: '/vital-signs' }, { label: s.name }])}
  <h1>${s.name}</h1>
  <p class="tags">
    ${s.domains.length
      ? s.domains.map((d) => html`<a class="chip" href="/domains/${d}">Domain: ${c.domain(d)?.name ?? d}</a>`)
      : html`<span class="chip">Domain: ${ph('[NOT YET CHOSEN]')}</span>`}
    <span class="chip chip-accent">${enumLabel(c.enums.vitalSignStatuses, s.status)}</span>
  </p>

  <div class="with-aside">
    <div class="main-col">
      <section><h2>Definition</h2><p>${text(s.definition, '[DEFINITION]')}</p></section>
      <section><h2>Latest reading</h2><p>${reading(s)}</p>${externalLink(s)}</section>
      <section><h2>Basis</h2><p>${text(s.basis)}</p></section>
      <section><h2>How often it is read</h2><p>${text(s.cadence, '[HOW OFTEN IT IS READ]')}</p></section>
      <section><h2>Method</h2><p>${text(s.method, '[METHOD]')}</p></section>
      <section><h2>Sources</h2>
        ${sources.length
          ? html`<ul class="source-list">${sources.map((k) => {
              const cite = c.citation(k);
              return html`<li>${cite ? cite.claim.claim : k} ${citationNote(c, k)}</li>`;
            })}</ul>`
          : html`<p>${ph('[SOURCES]')}</p>`}
      </section>
    </div>
    <aside class="aside-col">
      <div class="panel panel-members">
        <h2>${lockIcon} Help develop a sign</h2>
        <p>Data and methods, open to members. <span class="after-launch">After first launch</span></p>
        <a href="/join">Become a member</a>
      </div>
      ${relatedPanel(c, { domains: s.domains }, s)}
    </aside>
  </div>

  <nav class="page-foot" aria-label="Vital Signs">
    <a href="/vital-signs">All vital signs</a>
    <a href="/vital-signs/${next.slug}">Next: ${next.name}</a>
  </nav>
</div>`,
  };
}
