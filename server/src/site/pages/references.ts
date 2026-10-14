// src/site/pages/references.ts
// References (wireframe References.dc.html) and one reference. Evidence status belongs to each claim, not to
// the source, so it is shown per claim. "Cited on" is computed from the pages that actually cite the claim.

import type { Content } from '../../content/load';
import type { Claim, Reference } from '../../content/types';
import { evidenceLabel } from '../citation';
import { html, Html, ph, text } from '../html';
import { breadcrumb, domainOptions, queryValue, relatedPanel, selectFilter } from '../ui';
import type { PageBody } from './common';

// Wording from the wireframe
const INTRO = 'Every source this site relies on, what we use it to support, and where it is cited. The book draws on the same list.';
const ACROSS = 'across';
const ACROSS_LABEL = 'Across domains';

/** A readable name for a site path that cites a claim */
function pageLink(c: Content, path: string): Html {
  let label: string = path;
  if (path === '/') label = 'Home';
  else {
    const [, section, slug] = path.split('/');
    if (section === 'questions') label = c.question(slug)?.question ?? path;
    else if (section === 'vital-signs') label = c.sign(slug)?.name ?? path;
    else if (section === 'initiatives') label = c.initiative(slug)?.name ?? path;
    else if (section === 'domains') label = c.domain(slug)?.name ?? path;
  }
  return html`<a href="${path}">${label}</a>`;
}

function citedOnList(c: Content, r: Reference, claim: Claim): Html {
  const paths = c.citedOn(r, claim);
  return paths.length ? html`${paths.map((p, i) => html`${i ? ', ' : ''}${pageLink(c, p)}`)}` : ph('[NOT YET CITED ON A PAGE]');
}

function domainNames(c: Content, r: Reference): string {
  return r.domains.length ? r.domains.map((d) => c.domain(d)?.name ?? d).join(', ') : ACROSS_LABEL;
}

function sourceLink(r: Reference): Html {
  return r.url
    ? html`<a class="text-link" href="${r.url}" rel="noopener">Open the source</a>`
    : html`<p>${ph('[NO LINK TO THE SOURCE YET]')}</p>`;
}

function claimFacts(c: Content, r: Reference, claim: Claim): Html {
  return html`<dl class="facts">
  <dt>Cited on</dt><dd>${citedOnList(c, r, claim)}</dd>
  <dt>Evidentiary status of the claim</dt><dd>${evidenceLabel(c, claim.status)}</dd>
</dl>`;
}

export function referencesPage(c: Content, query: Record<string, unknown>): PageBody {
  const f = {
    domain: queryValue(query, 'domain'),
    kind: queryValue(query, 'kind'),
    status: queryValue(query, 'status'),
    q: queryValue(query, 'q'),
  };
  const needle = f.q.toLowerCase();
  const rows = c.references
    .map((r, i) => ({ r, n: i + 1 }))
    .filter(({ r }) =>
      (!f.domain || (f.domain === ACROSS ? r.domains.length === 0 : r.domains.includes(f.domain))) &&
      (!f.kind || r.kind === f.kind) &&
      (!f.status || r.claims.some((cl) => cl.status === f.status)) &&
      (!needle || [r.citation, r.shortCitation, ...r.claims.map((cl) => cl.claim)].some((t) => t.toLowerCase().includes(needle))));

  return {
    title: 'References',
    body: html`<div class="page page-wide">
  ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'References' }])}
  <h1>References</h1>
  <p class="intro">${INTRO}</p>

  <ul class="cards cards-3 evidence-levels">
    ${c.enums.evidentiaryStatuses.map((e) => html`<li class="card">
      <p class="card-label">${e.label}</p>
      <p class="card-text">${e.description}</p>
    </li>`)}
  </ul>

  <form class="filters" method="get" action="/references">
    <div class="filter-row">
      ${selectFilter('r-domain', 'Domain', 'domain', 'All domains',
        [{ value: ACROSS, label: ACROSS_LABEL }, ...domainOptions(c)], f.domain)}
      ${selectFilter('r-kind', 'Kind of source', 'kind', 'All kinds',
        c.enums.sourceKinds.map((k) => ({ value: k, label: k })), f.kind)}
      ${selectFilter('r-status', 'Evidentiary status', 'status', 'Any status',
        c.enums.evidentiaryStatuses.map((e) => ({ value: e.id, label: e.label })), f.status)}
      <div class="filter-field">
        <label for="r-search">Search</label>
        <input id="r-search" type="search" name="q" value="${f.q}" placeholder="Author, title or claim">
      </div>
      <div class="filter-field filter-apply"><button type="submit" class="button button-outline">Apply</button></div>
    </div>
  </form>

  <div class="reference-list">
    ${rows.length ? rows.map(({ r, n }) => html`<article class="card reference">
      <div>
        <p class="meta">${n} · ${r.kind} · ${domainNames(c, r)}</p>
        <h2><a href="/references/${r.slug}">${r.citation}</a></h2>
        ${r.claims.map((cl) => html`<p><span class="label-inline">We use it to support:</span> ${cl.claim}</p>`)}
        ${sourceLink(r)}
      </div>
      <div class="reference-facts">
        ${r.claims.map((cl) => claimFacts(c, r, cl))}
        <dl class="facts"><dt>How we read it</dt><dd>${text(r.howRead, '[IN FULL OR SUMMARY ONLY]')}</dd></dl>
      </div>
    </article>`) : html`<p>No references match these filters. <a href="/references">Clear filters</a></p>`}
  </div>
  <p class="hint result-count" role="status">${rows.length} shown.</p>
</div>`,
  };
}

export function referencePage(c: Content, r: Reference): PageBody {
  return {
    title: r.shortCitation,
    body: html`<div class="page page-wide">
  ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'References', href: '/references' }, { label: r.shortCitation }])}
  <p class="eyebrow">${r.kind}</p>
  <h1 class="question-title">${r.shortCitation}</h1>
  <p class="tags">
    ${r.domains.length
      ? r.domains.map((d) => html`<a class="chip" href="/domains/${d}">Domain: ${c.domain(d)?.name ?? d}</a>`)
      : html`<span class="chip">${ACROSS_LABEL}</span>`}
    <span class="chip">How we read it: ${text(r.howRead, '[IN FULL OR SUMMARY ONLY]')}</span>
  </p>

  <div class="with-aside">
    <div class="main-col">
      <section><h2>Citation</h2><p>${r.citation}</p>${sourceLink(r)}</section>
      <section><h2>What we use it to support</h2>
        ${r.claims.map((cl) => html`<div class="card claim">
          <p class="claim-text">${cl.claim}</p>
          ${claimFacts(c, r, cl)}
        </div>`)}
      </section>
    </div>
    <aside class="aside-col">
      ${relatedPanel(c, { domains: r.domains }, r)}
    </aside>
  </div>

  <nav class="page-foot" aria-label="References">
    <a href="/references">All references</a>
  </nav>
</div>`,
  };
}
