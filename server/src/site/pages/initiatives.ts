// src/site/pages/initiatives.ts
// The Initiatives register (wireframe Initiatives.dc.html) and one initiative (InitiativeDetail.dc.html).
// Filters are a plain GET form: they work without JavaScript and the filtered view has a shareable address.

import type { Content } from '../../content/load';
import type { Initiative } from '../../content/types';
import { html, ph, text } from '../html';
import { lockIcon } from '../layout';
import {
  breadcrumb, domainLinks, domainOptions, enumLabel, formLabels, membersNotice, queryValue, relatedPanel, selectFilter,
} from '../ui';
import type { PageBody } from './common';

// Wording from the wireframe
const INTRO = "A register of real attempts to build abundance structures, ours and other people's, and what each is teaching.";

export function initiativesPage(c: Content, query: Record<string, unknown>): PageBody {
  const f = {
    form: queryValue(query, 'form'),
    domain: queryValue(query, 'domain'),
    stage: queryValue(query, 'stage'),
    whose: queryValue(query, 'whose'),
    q: queryValue(query, 'q'),
  };
  const needle = f.q.toLowerCase();
  const rows = c.initiatives.filter((i) =>
    (!f.form || i.forms.includes(f.form)) &&
    (!f.domain || i.domains.includes(f.domain)) &&
    (!f.stage || i.stage === f.stage) &&
    (!f.whose || i.whose === f.whose) &&
    (!needle || [i.name, i.whatItIs, i.leavesInCommon].some((t) => t?.toLowerCase().includes(needle))));

  const formButton = (value: string, label: string) =>
    html`<button type="submit" name="form" value="${value}" aria-pressed="${f.form === value ? 'true' : 'false'}">${label}</button>`;

  return {
    title: 'Initiatives',
    body: html`<div class="page page-wide">
  ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'Initiatives' }])}
  <div class="page-head">
    <div>
      <h1>Initiatives</h1>
      <p class="intro">${INTRO}</p>
    </div>
    ${membersNotice('Members can propose initiatives.')}
  </div>

  <div class="with-aside">
    <div class="main-col">
      <form class="filters" method="get" action="/initiatives">
        <input type="hidden" name="form" value="${f.form}">
        <fieldset class="toggle-group">
          <legend>Form</legend>
          ${formButton('', 'All')}
          ${c.enums.forms.map((fm) => formButton(fm.id, fm.label))}
        </fieldset>
        <div class="filter-row">
          ${selectFilter('f-domain', 'Domain', 'domain', 'All twelve domains', domainOptions(c), f.domain)}
          ${selectFilter('f-stage', 'Stage', 'stage', 'All stages',
            c.enums.initiativeStages.map((s) => ({ value: s.id, label: s.label })), f.stage)}
          ${selectFilter('f-who', 'Whose', 'whose', 'Ours and watching',
            c.enums.whose.map((w) => ({ value: w.id, label: w.label })), f.whose)}
          <div class="filter-field">
            <label for="f-search">Search</label>
            <input id="f-search" type="search" name="q" value="${f.q}" placeholder="Search the register">
          </div>
          <div class="filter-field filter-apply"><button type="submit" class="button button-outline">Apply</button></div>
        </div>
      </form>

      <div class="table-scroll">
        <table class="data-table stack">
          <thead><tr>
            <th scope="col">Initiative</th><th scope="col">Form</th><th scope="col">Domain</th>
            <th scope="col">Stage</th><th scope="col">Leaves in common</th>
          </tr></thead>
          <tbody>
            ${rows.length ? rows.map((i) => html`<tr>
              <th scope="row"><a href="/initiatives/${i.slug}">${i.name}</a>
                <span class="chip">${enumLabel(c.enums.whose, i.whose)}</span></th>
              <td data-label="Form">${formLabels(c, i.forms)}</td>
              <td data-label="Domain">${domainLinks(c, i.domains)}</td>
              <td data-label="Stage">${enumLabel(c.enums.initiativeStages, i.stage)}</td>
              <td data-label="Leaves in common">${text(i.leavesInCommon)}</td>
            </tr>`) : html`<tr><td colspan="5">No initiatives match these filters. <a href="/initiatives">Clear filters</a></td></tr>`}
          </tbody>
        </table>
      </div>
      <p class="hint result-count" role="status">${rows.length} shown.</p>
    </div>

    <aside class="aside-col">
      <div class="panel">
        <h2>How an initiative moves</h2>
        <ol class="stages-explained">
          ${c.enums.initiativeStages.map((s) => html`<li><strong>${s.label}.</strong> ${s.description}</li>`)}
        </ol>
      </div>
      <div class="panel">
        <h2>From the latest report</h2>
        <p>${ph('[WHAT CHANGED IN INITIATIVES THIS MONTH]')}</p>
      </div>
      <div class="panel panel-members">
        <h2>${lockIcon} Working groups</h2>
        <p>Members working on an initiative together. <span class="after-launch">After first launch</span></p>
      </div>
    </aside>
  </div>
</div>`,
  };
}

function stageTracker(c: Content, i: Initiative) {
  const stages = c.enums.initiativeStages;
  const current = stages.find((s) => s.id === i.stage);
  return html`<div class="stage-tracker">
  <p class="label">${current ? `Stage ${current.order} of ${stages.length}` : ph('[STAGE]')}</p>
  <ol>
    ${stages.map((s) => html`<li${s.id === i.stage ? html` aria-current="step" class="current"` : s.order < (current?.order ?? 0) ? html` class="done"` : ''}>
      <span class="stage-n">${s.order}</span> ${s.label}${s.id === i.stage ? html` <span class="now">now</span>` : ''}
    </li>`)}
  </ol>
</div>`;
}

export function initiativePage(c: Content, i: Initiative): PageBody {
  const next = c.initiatives[(c.initiatives.indexOf(i) + 1) % c.initiatives.length];
  const log = i.statusLog?.length ? i.statusLog : [{ date: '[DATE]', entry: '[STATUS UPDATE, WRITTEN BY THE OWNER]' }];
  const showOwner = i.whose === 'ours' || i.owner !== undefined;

  return {
    title: i.name,
    body: html`<div class="page page-wide">
  ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'Initiatives', href: '/initiatives' }, { label: i.name }])}
  <h1>${i.name}</h1>
  <p class="tags">
    ${i.forms.map((fm) => html`<a class="chip" href="/initiatives?form=${fm}">Form: ${enumLabel(c.enums.forms, fm)}</a>`)}
    ${i.domains.map((d) => html`<a class="chip" href="/domains/${d}">Domain: ${c.domain(d)?.name ?? d}</a>`)}
    <span class="chip chip-accent">${enumLabel(c.enums.whose, i.whose)}</span>
    ${showOwner ? html`<span class="chip">Owner: ${text(i.owner, '[OWNER NAME]')}</span>` : ''}
  </p>
  ${stageTracker(c, i)}

  <div class="with-aside">
    <div class="main-col">
      <section><h2>What it is</h2><p>${text(i.whatItIs)}</p></section>
      <section><h2>Why it matters</h2><p>${text(i.whyItMatters, '[WHICH ABUNDANCE STRUCTURE THIS HELPS EMERGE, AND HOW]')}</p></section>
      <section><h2>What it leaves in common</h2>
        <p>${text(i.leavesInCommon)}${i.licence !== undefined ? html`. <span class="meta-inline">Licence: ${text(i.licence, '[LICENCE]')}</span>` : ''}</p>
      </section>
      <section><h2>Status log</h2>
        <ol class="status-log">
          ${log.map((e) => html`<li><span class="log-date">${text(e.date, '[DATE]')}</span><span>${text(e.entry)}</span></li>`)}
        </ol>
      </section>
      <section><h2>What we're learning</h2><p>${text(i.whatWeAreLearning, '[WHAT HAS EMERGED SO FAR, INCLUDING WHAT DID NOT WORK]')}</p></section>
      <section class="panel panel-members">
        <h2>${lockIcon} Discussion</h2>
        <p>Anyone can read the discussion. Members can add to it. <span class="after-launch">After first launch</span></p>
        <p>Join to take part in this discussion. <a href="/join">Become a member</a></p>
      </section>
    </div>

    <aside class="aside-col">
      <div class="panel">
        <h2>Follow this initiative</h2>
        <p>Status changes arrive in the monthly report.</p>
        <a class="text-link" href="/report">Get the report by email</a>
      </div>
      <div class="panel panel-members">
        <h2>${lockIcon} Working group</h2>
        <p>Members can join the group working on this. <span class="after-launch">After first launch</span></p>
      </div>
      ${relatedPanel(c, { domains: i.domains, forms: i.forms }, i)}
    </aside>
  </div>

  <nav class="page-foot" aria-label="Initiatives">
    <a href="/initiatives">Back to the register</a>
    <a href="/initiatives/${next.slug}">Next: ${next.name}</a>
  </nav>
</div>`,
  };
}
